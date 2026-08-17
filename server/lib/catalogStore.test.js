import { describe, expect, it } from 'vitest';
import { normalizeCatalogStoreState } from './catalogStore.js';

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
