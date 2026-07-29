import { describe, expect, it } from 'vitest';
import pesquisadores from './pesquisadores.json';

describe('catálogo de pesquisadores sem mídia de perfil', () => {
  it('não mantém campos de foto ou imagem nos registros', () => {
    expect(pesquisadores.length).toBeGreaterThan(0);
    expect(pesquisadores.every((item) => !Object.hasOwn(item, 'foto') && !Object.hasOwn(item, 'image'))).toBe(true);
  });
});
