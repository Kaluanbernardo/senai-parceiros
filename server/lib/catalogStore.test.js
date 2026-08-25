import { afterEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const head = vi.fn();
class BlobPreconditionFailedError extends Error {}

vi.mock('@vercel/blob', () => ({ put, head, BlobPreconditionFailedError }));

import { normalizeCatalogStoreState } from './catalogStore.js';
import { catalogStore } from './catalogStore.js';

afterEach(() => {
  put.mockReset();
  head.mockReset();
  catalogStore.configure({ driver: 'memory' });
});

describe('catalog store migrations', () => {
  it('migrates all rollback metadata from legacy school batches', () => {
    const state = normalizeCatalogStoreState({
      committedBatches: {
        legacy: {
          batchId: 'legacy',
          category: 'school',
          targets: [{ category: 'school', result: { id: 's-1', instituicao: 'Escola' } }],
          applied: [{ category: 'school', id: 's-1', rowHash: 'hash' }],
          appliedRecords: [{ id: 's-1', instituicao: 'Escola' }],
          beforeByCategory: { school: { records: [{ id: 's-1', instituicao: 'Escola antiga' }], rowHashes: ['old'] } },
        },
      },
    });
    const batch = state.committedBatches.legacy;

    expect(batch.category).toBe('organization');
    expect(batch.targets[0]).toMatchObject({ category: 'organization', result: { categoria: 'Pessoa Jurídica', subtipo: 'Instituição de ensino' } });
    expect(batch.applied[0].category).toBe('organization');
    expect(batch.appliedRecords[0]).toMatchObject({ categoria: 'Pessoa Jurídica', subtipo: 'Instituição de ensino' });
    expect(batch.beforeByCategory.organization).toMatchObject({ rowHashes: ['old'], records: [expect.objectContaining({ subtipo: 'Instituição de ensino' })] });
  });
});

describe('catalog store remote writes', () => {
  it('never falls back to an unconditional overwrite after an ETag conflict', async () => {
    put.mockRejectedValue(new BlobPreconditionFailedError('etag mismatch'));
    catalogStore.configure({ driver: 'vercel_blob' });
    catalogStore.remoteEtag = 'stale-etag';

    await expect(catalogStore.flush({ attempts: 3 })).rejects.toMatchObject({
      message: 'catalog_store_conflict',
      status: 409,
    });

    expect(put).toHaveBeenCalled();
    expect(put.mock.calls.every(([, , options]) => options.ifMatch === 'stale-etag')).toBe(true);
  });
});
