import { describe, expect, it, vi } from 'vitest';
import { applyMigrationPlan, buildMigrationPlan, planStoreMigration, stateHash } from './storageMigration.js';

describe('storage migration', () => {
  it('hashes objects independently of key order', () => {
    expect(stateHash({ b: 2, a: { d: 4, c: 3 } })).toBe(stateHash({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it.each([
    [{ sourceState: { value: 1 }, targetState: {}, targetVersion: 0 }, 'copy'],
    [{ sourceState: { value: 1 }, targetState: { value: 1 }, targetVersion: 2 }, 'already_migrated'],
    [{ sourceState: { value: 1 }, targetState: { value: 2 }, targetVersion: 2 }, 'conflict'],
    [{ sourceState: null, targetState: {}, targetVersion: 0 }, 'empty'],
    [{ sourceState: null, targetState: { value: 2 }, targetVersion: 2 }, 'destination_only'],
  ])('plans without overwriting destination data', (input, action) => {
    expect(planStoreMigration({ key: 'ai-usage', ...input }).action).toBe(action);
  });

  it('builds a plan from all configured sources before writing', async () => {
    const stores = [{ key: 'one', blobPathEnv: 'ONE_PATH', defaultBlobPath: 'one.json' }];
    const entries = await buildMigrationPlan({
      stores,
      readBlob: vi.fn().mockResolvedValue({ a: 1 }),
      readTarget: vi.fn().mockResolvedValue({ state: {}, version: 0 }),
    });
    expect(entries[0]).toMatchObject({ key: 'one', blobPath: 'one.json', action: 'copy' });
  });

  it('copies and verifies an empty destination', async () => {
    let target = { state: {}, version: 0 };
    const sourceState = { records: { person: [{ id: 'p1' }] } };
    const entries = [{ key: 'catalog-store', action: 'copy', sourceState, targetState: {}, sourceHash: stateHash(sourceState) }];
    const result = await applyMigrationPlan({
      entries,
      writeTarget: vi.fn(async (_key, state) => { target = { state, version: 1 }; return { version: 1 }; }),
      readTarget: vi.fn(async () => target),
    });
    expect(result).toEqual([{ key: 'catalog-store', version: 1, hash: stateHash(sourceState) }]);
  });

  it('refuses the whole plan when any destination conflicts', async () => {
    const writeTarget = vi.fn();
    await expect(applyMigrationPlan({
      entries: [
        { key: 'catalog-store', action: 'copy', sourceState: { a: 1 }, targetState: {}, sourceHash: stateHash({ a: 1 }) },
        { key: 'radar-store', action: 'conflict' },
      ],
      writeTarget,
      readTarget: vi.fn(),
    })).rejects.toThrow('migration_conflict:radar-store');
    expect(writeTarget).not.toHaveBeenCalled();
  });

  it('replaces an explicitly authorized conflict using its exact version', async () => {
    let target = { state: { value: 'test' }, version: 7 };
    const sourceState = { value: 'canonical' };
    const writeTarget = vi.fn(async (_key, state, expectedVersion) => {
      expect(expectedVersion).toBe(7);
      target = { state, version: 8 };
      return { version: 8 };
    });
    await applyMigrationPlan({
      entries: [{ key: 'ai-usage', action: 'conflict', sourceState, targetState: target.state, targetVersion: 7, sourceHash: stateHash(sourceState) }],
      writeTarget,
      readTarget: vi.fn(async () => target),
      replaceConflicts: true,
    });
    expect(target.state).toEqual(sourceState);
  });
});
