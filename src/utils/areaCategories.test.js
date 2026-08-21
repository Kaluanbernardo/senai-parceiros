import { describe, expect, it } from 'vitest';
import { getThemeGroup, THEME_GROUP_FALLBACK } from './areaCategories';

describe('getThemeGroup', () => {
  it('agrupa temas específicos no eixo temático canônico', () => {
    expect(getThemeGroup('Aprendizagem dual')).toBe('Pedagogia e Currículo');
    expect(getThemeGroup('Competências verdes')).toBe('Sustentabilidade');
  });

  it('mantém temas ainda não mapeados navegáveis', () => {
    expect(getThemeGroup('Neurociência aplicada')).toBe(THEME_GROUP_FALLBACK);
  });
});
