import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { AtomicJsonStore } from './atomicJsonStore.js';

function store(filePath) {
  const value = new AtomicJsonStore({
    name: 'test',
    emptyState: () => ({ entries: {} }),
    normalizeState: (value) => value?.entries ? { entries: value.entries } : { entries: {} },
  });
  value.configure({ driver: 'file', filePath });
  return value;
}

describe('AtomicJsonStore', () => {
  const paths = new Set();
  afterEach(() => {
    for (const filePath of paths) {
      try { fs.rmSync(filePath, { force: true }); } catch { /* test cleanup */ }
      try { fs.rmSync(`${filePath}.lock`, { force: true }); } catch { /* test cleanup */ }
    }
    paths.clear();
  });

  it('serializes concurrent file updates with an exclusive lock', async () => {
    const filePath = `${process.cwd()}/tmp-atomic-${Date.now()}.json`;
    paths.add(filePath);
    const first = store(filePath);
    await first.update((state) => { state.entries.count = 0; return state; });
    await Promise.all(Array.from({ length: 20 }, () => first.update((state) => {
      state.entries.count = Number(state.entries.count || 0) + 1;
      return state;
    })));
    const second = store(filePath);
    expect(second.status()).toMatchObject({ driver: 'file', durable: true, atomic: true });
    const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(loaded.entries.count).toBe(20);
  });
});
