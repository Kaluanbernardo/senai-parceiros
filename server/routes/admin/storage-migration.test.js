import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(() => ({ role: 'admin' })),
  requireSameOrigin: vi.fn(() => true),
  buildMigrationPlan: vi.fn(),
  applyMigrationPlan: vi.fn(),
  readPilotDocument: vi.fn(),
  writePilotDocument: vi.fn(),
}));

vi.mock('../../lib/cookies.js', () => ({ requireSession: mocks.requireSession }));
vi.mock('../../lib/http.js', () => ({
  requireSameOrigin: mocks.requireSameOrigin,
  methodNotAllowed: (res) => res.status(405).json({ error: 'method_not_allowed' }),
}));
vi.mock('../../lib/storageMigration.js', () => ({
  buildMigrationPlan: mocks.buildMigrationPlan,
  applyMigrationPlan: mocks.applyMigrationPlan,
  readPrivateBlobJson: vi.fn(),
}));
vi.mock('../../lib/supabase.js', () => ({
  readPilotDocument: mocks.readPilotDocument,
  writePilotDocument: mocks.writePilotDocument,
}));

const { default: handler } = await import('./storage-migration.js');

function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

const plan = [{
  key: 'catalog-store', blobPath: 'catalog.json', action: 'conflict', sourceHash: 'source', targetHash: 'target',
  targetVersion: 3, source: { present: true, people: 2 }, target: { present: true, people: 1 },
  sourceState: { records: { person: [{ id: 1 }, { id: 2 }] } }, targetState: { records: { person: [{ id: 1 }] } },
}];

describe('admin storage migration route', () => {
  beforeEach(() => {
    process.env.STORAGE_MIGRATION_ENABLED = 'true';
    mocks.buildMigrationPlan.mockResolvedValue(plan);
    mocks.applyMigrationPlan.mockResolvedValue([{ key: 'catalog-store', version: 4, hash: 'source' }]);
    mocks.writePilotDocument.mockResolvedValue({ version: 1 });
  });
  afterEach(() => { vi.clearAllMocks(); delete process.env.STORAGE_MIGRATION_ENABLED; });

  it('fails closed when the temporary switch is disabled', async () => {
    delete process.env.STORAGE_MIGRATION_ENABLED;
    const res = response();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.buildMigrationPlan).not.toHaveBeenCalled();
  });

  it('returns only the migration plan on GET', async () => {
    const res = response();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].stores[0]).not.toHaveProperty('sourceState');
  });

  it('requires the exact destructive confirmation', async () => {
    const res = response();
    await handler({ method: 'POST', headers: {}, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.writePilotDocument).not.toHaveBeenCalled();
  });

  it('backs up the target and verifies the authorized replacement', async () => {
    const res = response();
    await handler({ method: 'POST', headers: {}, body: { action: 'apply', confirmation: 'discard-supabase-test-writes' } }, res);
    expect(mocks.writePilotDocument).toHaveBeenCalledWith(expect.stringMatching(/^migration-backup:/), expect.objectContaining({ originalVersion: 3, originalHash: 'target' }), 0);
    expect(mocks.applyMigrationPlan).toHaveBeenCalledWith(expect.objectContaining({ replaceConflicts: true }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'verified' }));
  });

  it('exposes only a safe Blob status code when planning fails', async () => {
    mocks.buildMigrationPlan.mockRejectedValueOnce(new Error('Vercel Blob: Failed to fetch blob: 403 Forbidden'));
    const res = response();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'storage_migration_failed', code: 'blob_http_403' });
  });
});
