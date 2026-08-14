import { afterEach, describe, expect, it } from 'vitest';
import { getCatalog } from './catalog.js';
import { catalogStore } from './catalogStore.js';

afterEach(() => catalogStore.configure({ driver: 'memory' }));

describe('catalog compatibility', () => {
  it('keeps the legacy school alias limited to education institutions', () => {
    const organizations = getCatalog('organization');
    const schools = getCatalog('school');

    expect(schools.length).toBeLessThan(organizations.length);
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.every((record) => record.subtipo === 'Instituição de ensino')).toBe(true);
    expect(organizations.some((record) => record.nome.startsWith('NCVER') && record.subtipo === 'Centro de pesquisa e inovação')).toBe(true);
    expect(organizations.some((record) => record.nome.startsWith('T-Levels'))).toBe(false);
  });
});
