import { describe, expect, it } from 'vitest';
import { describeResultCount } from './ResultsToolbar.jsx';

const PESSOAS = { singular: 'pessoa', plural: 'pessoas' };

describe('contagem de resultados', () => {
  it('mostra o recorte contra o total enquanto há filtro', () => {
    expect(describeResultCount(24, 88, PESSOAS)).toBe('24 de 88 pessoas');
  });

  it('omite o total quando a lista está inteira', () => {
    expect(describeResultCount(88, 88, PESSOAS)).toBe('88 pessoas');
  });

  it('concorda o substantivo no singular', () => {
    expect(describeResultCount(1, 88, PESSOAS)).toBe('1 de 88 pessoa');
    expect(describeResultCount(0, 88, PESSOAS)).toBe('0 de 88 pessoas');
  });

  it('não quebra sem substantivo nem com contagens ausentes', () => {
    expect(describeResultCount(3, 9)).toBe('3 de 9');
    expect(describeResultCount(undefined, undefined, PESSOAS)).toBe('0 pessoas');
  });
});
