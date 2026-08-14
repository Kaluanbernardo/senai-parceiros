import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const put = vi.fn();
const head = vi.fn();

class BlobPreconditionFailedError extends Error {
  constructor() {
    super('Vercel Blob: Precondition failed: ETag mismatch.');
    this.name = 'BlobPreconditionFailedError';
    this.statusCode = 412;
  }
}

vi.mock('@vercel/blob', () => ({ get, put, head, BlobPreconditionFailedError }));

const { AtomicJsonStore } = await import('./atomicJsonStore.js');

function blobResult(count, etag) {
  return {
    statusCode: 200,
    stream: new Response(JSON.stringify({ entries: { count } })).body,
    blob: { etag },
  };
}

describe('AtomicJsonStore on Vercel Blob', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    head.mockReset();
  });

  it('survives a Blob propagation window longer than the old four attempts', async () => {
    const store = new AtomicJsonStore({
      name: 'test',
      emptyState: () => ({ entries: {} }),
      normalizeState: (value) => value,
    });
    store.configure({ driver: 'vercel_blob', blobPath: 'test/usage.json' });

    get
      .mockResolvedValueOnce(blobResult(10, 'etag-1'))
      .mockResolvedValueOnce(blobResult(11, 'etag-2'))
      .mockResolvedValueOnce(blobResult(12, 'etag-3'))
      .mockResolvedValueOnce(blobResult(13, 'etag-4'))
      .mockResolvedValueOnce(blobResult(14, 'etag-5'));
    put
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: 'etag-written' });

    await expect(store.update((state) => {
      state.entries.count = Number(state.entries.count || 0) + 1;
      return state;
    })).resolves.toEqual({ entries: { count: 15 } });

    expect(get).toHaveBeenCalledTimes(5);
    expect(put).toHaveBeenCalledTimes(5);
    expect(JSON.parse(put.mock.calls[4][1])).toEqual({ entries: { count: 15 } });
    expect(put.mock.calls[4][2]).toMatchObject({ allowOverwrite: true, ifMatch: 'etag-5' });
  });

  it('recovers the current ETag with head when the content response omits it', async () => {
    const store = new AtomicJsonStore({
      name: 'test',
      emptyState: () => ({ entries: {} }),
      normalizeState: (value) => value,
    });
    store.configure({ driver: 'vercel_blob', blobPath: 'test/usage.json' });

    get.mockResolvedValue(blobResult(20, null));
    head.mockResolvedValue({ etag: 'etag-from-head' });
    put.mockResolvedValue({ etag: 'etag-written' });

    await store.update((state) => {
      state.entries.count += 1;
      return state;
    });

    expect(head).toHaveBeenCalledWith('test/usage.json');
    expect(put.mock.calls[0][2]).toMatchObject({ allowOverwrite: true, ifMatch: 'etag-from-head' });
  });

  it('normalizes the quoted ETag returned by get before a conditional write', async () => {
    const store = new AtomicJsonStore({
      name: 'test',
      emptyState: () => ({ entries: {} }),
      normalizeState: (value) => value,
    });
    store.configure({ driver: 'vercel_blob', blobPath: 'test/usage.json' });

    get.mockResolvedValue(blobResult(30, '"etag-current"'));
    head.mockResolvedValue({ etag: 'etag-current' });
    put.mockImplementation(async (_pathname, _body, options) => {
      if (options.ifMatch !== 'etag-current') throw new BlobPreconditionFailedError();
      return { etag: 'etag-written' };
    });

    await expect(store.update((state) => {
      state.entries.count += 1;
      return state;
    }, { retries: 1 })).resolves.toEqual({ entries: { count: 31 } });

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][2]).toMatchObject({ allowOverwrite: true, ifMatch: 'etag-current' });
  });
});
