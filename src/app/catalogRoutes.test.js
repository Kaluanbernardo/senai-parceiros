import { describe, expect, it } from 'vitest';
import { LEGACY_CATALOG_ROUTES } from '../App.jsx';
import { getToolById } from './toolRegistry.js';

/**
 * As rotas do catálogo foram renomeadas junto com os rótulos. Links já
 * compartilhados apontam para os caminhos antigos, e o catch-all do router
 * mandaria qualquer caminho desconhecido para a home — o usuário cairia numa
 * página que não pediu, sem explicação. Daí os redirecionamentos.
 */
describe('rotas do catálogo', () => {
  const children = getToolById('catalog').children;

  it('navigates to the renamed paths', () => {
    expect(children.map((child) => child.route)).toEqual([
      '/catalogo/especialistas',
      '/catalogo/instituicoes-de-educacao',
      '/catalogo/outras-organizacoes',
    ]);
  });

  it('keeps a redirect for every path that was renamed', () => {
    const destinations = LEGACY_CATALOG_ROUTES.map(([, to]) => to);
    for (const child of children) expect(destinations).toContain(child.route);
  });

  it('never redirects a path to itself or to a path that is not served', () => {
    const served = new Set(children.map((child) => child.route));
    for (const [from, to] of LEGACY_CATALOG_ROUTES) {
      expect(from).not.toBe(to);
      expect(served.has(to)).toBe(true);
      // Um caminho antigo não pode continuar sendo servido: as duas regras
      // colidiriam e a ordem no arquivo decidiria qual vence.
      expect(served.has(from)).toBe(false);
    }
  });
});
