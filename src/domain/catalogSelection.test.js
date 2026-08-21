import { describe, expect, it } from 'vitest';
import { catalogRouteForCandidate, resolveCatalogSelection } from './catalogSelection';

describe('caminho de volta ao catálogo', () => {
  it('leva pessoas físicas e jurídicas para a lista certa', () => {
    expect(catalogRouteForCandidate('person', 19)).toBe('/catalogo/pessoas-fisicas?perfil=19');
    expect(catalogRouteForCandidate('organization', 42)).toBe('/catalogo/pessoas-juridicas?perfil=42');
  });

  it('escapa identificadores compostos das pessoas jurídicas', () => {
    expect(catalogRouteForCandidate('organization', 'school:escolas:50'))
      .toBe('/catalogo/pessoas-juridicas?perfil=school%3Aescolas%3A50');
  });

  it('não produz endereço sem registro', () => {
    expect(catalogRouteForCandidate('person', '')).toBe('');
    expect(catalogRouteForCandidate('person', undefined)).toBe('');
  });
});

const UNIVERSE = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
const FILTERED = [{ id: 2 }, { id: 3 }, { id: 4 }];

describe('registro aberto pelo endereço', () => {
  it('não abre nada quando a URL não traz um registro', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '')).toEqual({
      item: null, index: -1, total: 3, previousId: null, nextId: null,
    });
  });

  it('localiza o registro na lista filtrada e informa os vizinhos', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '3')).toEqual({
      item: { id: 3 }, index: 1, total: 3, previousId: '2', nextId: '4',
    });
  });

  it('não oferece vizinho antes do primeiro nem depois do último', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '2').previousId).toBeNull();
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '4').nextId).toBeNull();
  });

  it('abre um registro fora do recorte atual, sem posição nem vizinhos', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '1')).toEqual({
      item: { id: 1 }, index: -1, total: 3, previousId: null, nextId: null,
    });
  });

  it('devolve nada quando o identificador não existe em lugar nenhum', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, '99').item).toBeNull();
  });

  it('compara identificadores numéricos e textuais como o mesmo registro', () => {
    expect(resolveCatalogSelection(FILTERED, UNIVERSE, 3).item).toEqual({ id: 3 });
  });
});
