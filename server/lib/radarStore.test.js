import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const head = vi.fn();
const get = vi.fn();

class BlobPreconditionFailedError extends Error {
  constructor() {
    super('Vercel Blob: Precondition failed: ETag mismatch.');
    this.name = 'BlobPreconditionFailedError';
  }
}

vi.mock('@vercel/blob', () => ({ put, head, get, BlobPreconditionFailedError }));

const { radarStore } = await import('./radarStore.js');

describe('radar store on vercel blob', () => {
  beforeEach(() => {
    put.mockReset();
    head.mockReset();
    get.mockReset();
    radarStore.configure({ driver: 'vercel_blob' });
  });

  afterEach(() => { radarStore.configure({ driver: 'memory' }); });

  it('recovers from a stale ETag instead of failing every later write', async () => {
    // A mismatch used to be permanent: nothing refreshed the stale ETag, so the
    // radar could never persist a snapshot again once it happened.
    radarStore.writeSnapshot({ items: [{ id: 'a' }], fetchedAt: '2026-07-30T00:00:00.000Z' });
    radarStore.remoteEtag = 'stale-etag';
    head.mockResolvedValue({ etag: 'current-etag' });
    put
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: 'written-etag' });

    await radarStore.flush();

    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[0][2].ifMatch).toBe('stale-etag');
    expect(put.mock.calls[1][2].ifMatch).toBe('current-etag');
    expect(radarStore.remoteEtag).toBe('written-etag');
  });

  it('writes the pending snapshot on retry, not the remote one', async () => {
    // Refreshing the ETag must not reload remote state: doing so would write
    // back the document being replaced and silently drop the new snapshot.
    radarStore.writeSnapshot({ items: [{ id: 'novo' }], fetchedAt: '2026-07-30T00:00:00.000Z' });
    radarStore.remoteEtag = 'stale-etag';
    head.mockResolvedValue({ etag: 'current-etag' });
    put
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: 'written-etag' });

    await radarStore.flush();

    expect(get).not.toHaveBeenCalled();
    expect(JSON.parse(put.mock.calls[1][1]).snapshot.items).toEqual([{ id: 'novo' }]);
  });

  it('drops the precondition on the last attempt so a snapshot always lands', async () => {
    radarStore.writeSnapshot({ items: [{ id: 'a' }], fetchedAt: '2026-07-30T00:00:00.000Z' });
    radarStore.remoteEtag = 'stale-etag';
    head.mockResolvedValue({ etag: 'moving-target' });
    put
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockRejectedValueOnce(new BlobPreconditionFailedError())
      .mockResolvedValueOnce({ etag: 'written-etag' });

    await radarStore.flush();

    expect(put).toHaveBeenCalledTimes(3);
    expect(put.mock.calls[2][2].ifMatch).toBeUndefined();
  });

  it('propagates failures that are not a precondition mismatch', async () => {
    radarStore.remoteEtag = null;
    put.mockRejectedValue(new Error('blob_token_invalid'));
    await expect(radarStore.flush()).rejects.toThrow('blob_token_invalid');
    expect(put).toHaveBeenCalledTimes(1);
  });
});
