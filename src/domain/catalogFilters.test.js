import { describe, expect, it } from 'vitest';
import {
  collectFacetValues,
  collectTokenValues,
  countActiveFilters,
  describeActiveFilters,
  matchesFacet,
  matchesQuery,
  matchesTokenizedFacet,
  normalize,
  parseQuery,
  searchableText,
  sortItems,
  SORT_OPTIONS,
} from './catalogFilters';

const FIELDS = ['nome', 'instituicao', 'areas', 'pais', 'pesquisa', 'aliases'];

const ITEM = {
  nome: 'Maria da Conceição',
  instituicao: 'Universidade de São Paulo',
  areas: 'Educação Profissional; Automação Industrial (mecatrônica)',
  pais: 'Brasil',
  pesquisa: 'Formação de professores para a indústria 4.0',
  aliases: ['M. Conceição', 'Maria Conceicao'],
};

describe('normalização', () => {
  it('tira acento e caixa', () => {
    expect(normalize('Educação Profissional')).toBe('educacao profissional');
    expect(normalize('SÃO PAULO')).toBe('sao paulo');
    expect(normalize('  Mecatrônica  ')).toBe('mecatronica');
  });

  it('trata ausência de valor sem estourar', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize(0)).toBe('0');
  });
});

describe('termos da busca', () => {
  it('quebra em termos e ignora espaço sobrando', () => {
    expect(parseQuery('  senai   alemanha ')).toEqual(['senai', 'alemanha']);
  });

  it('mantém expressão entre aspas inteira', () => {
    expect(parseQuery('"educação profissional" alemanha')).toEqual(['educacao profissional', 'alemanha']);
  });

  it('devolve nada para busca vazia', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });
});

describe('busca textual', () => {
  it('encontra sem o acento — o motivo principal desta reforma', () => {
    // Digitar "educacao" e não achar nada numa base cheia de "educação" é o
    // jeito mais barato de convencer alguém de que o catálogo está vazio.
    expect(matchesQuery(ITEM, 'educacao', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, 'sao paulo', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, 'mecatronica', FIELDS)).toBe(true);
  });

  it('encontra também com o acento', () => {
    expect(matchesQuery(ITEM, 'educação', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, 'Conceição', FIELDS)).toBe(true);
  });

  it('exige todos os termos, mas em campos quaisquer', () => {
    // "conceição indústria" nunca aparece junto em campo nenhum; a busca por
    // frase literal que existia antes não achava este registro.
    expect(matchesQuery(ITEM, 'conceicao industria', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, 'conceicao portugal', FIELDS)).toBe(false);
  });

  it('respeita aspas como expressão contígua', () => {
    expect(matchesQuery(ITEM, '"educacao profissional"', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, '"profissional educacao"', FIELDS)).toBe(false);
  });

  it('busca vazia não filtra nada', () => {
    expect(matchesQuery(ITEM, '', FIELDS)).toBe(true);
    expect(matchesQuery(ITEM, '   ', FIELDS)).toBe(true);
  });

  it('procura dentro de campos de lista, como os apelidos', () => {
    expect(matchesQuery(ITEM, 'M. Conceição', FIELDS)).toBe(true);
  });

  it('não estoura com registro incompleto', () => {
    expect(matchesQuery({ nome: 'X' }, 'x', FIELDS)).toBe(true);
    expect(searchableText({}, FIELDS)).toBe('');
  });
});

describe('facetas', () => {
  it('sem seleção, não filtra', () => {
    // O erro simétrico — "nada selecionado" virar "nada casa" — esvazia a tela
    // no primeiro render.
    expect(matchesFacet('Brasil', [])).toBe(true);
    expect(matchesFacet(null, [])).toBe(true);
    expect(matchesFacet('Brasil', undefined)).toBe(true);
  });

  it('casa ignorando acento e caixa', () => {
    expect(matchesFacet('Alemanha', ['alemanha'])).toBe(true);
    expect(matchesFacet('Áustria', ['Austria'])).toBe(true);
  });

  it('registro sem valor não passa quando há seleção', () => {
    expect(matchesFacet(null, ['Brasil'])).toBe(false);
    expect(matchesFacet(undefined, ['Brasil'])).toBe(false);
  });

  it('aceita registro com vários valores', () => {
    expect(matchesFacet(['Brasil', 'Portugal'], ['portugal'])).toBe(true);
    expect(matchesFacet(['Brasil', 'Portugal'], ['japao'])).toBe(false);
  });
});

describe('facetas de campo com separador', () => {
  it('encontra a área dentro da lista separada por ponto e vírgula', () => {
    expect(matchesTokenizedFacet(ITEM.areas, ['Automação Industrial'])).toBe(true);
    expect(matchesTokenizedFacet(ITEM.areas, ['automacao'])).toBe(true);
    expect(matchesTokenizedFacet(ITEM.areas, ['Saúde'])).toBe(false);
  });

  it('basta uma das áreas selecionadas — seleção é OU, não E', () => {
    expect(matchesTokenizedFacet(ITEM.areas, ['Saúde', 'Educação Profissional'])).toBe(true);
  });

  it('sem seleção não filtra; sem valor não passa', () => {
    expect(matchesTokenizedFacet(ITEM.areas, [])).toBe(true);
    expect(matchesTokenizedFacet(null, ['Saúde'])).toBe(false);
  });
});

describe('coleta de valores para os seletores', () => {
  const items = [
    { pais: 'Brasil', areas: 'Engenharia; Saúde (clínica)' },
    { pais: 'Alemanha', areas: 'Engenharia' },
    { pais: 'Brasil', areas: null },
    { pais: null },
  ];

  it('lista países distintos em ordem, sem vazios', () => {
    expect(collectFacetValues(items, 'pais')).toEqual(['Alemanha', 'Brasil']);
  });

  it('quebra as áreas e descarta o que vem entre parênteses', () => {
    // "Saúde (clínica)" e "Saúde (pública)" são a mesma faceta para quem filtra;
    // manter o parêntese multiplicaria a lista de opções sem informar nada.
    expect(collectTokenValues(items, 'areas')).toEqual(['Engenharia', 'Saúde']);
  });
});

describe('ordenação', () => {
  const items = [
    { nome: 'Zilda', pais: 'Brasil' },
    { nome: 'Ana', pais: 'Portugal' },
    { nome: 'Édouard', pais: null },
  ];

  it('mantém a ordem do catálogo por padrão', () => {
    expect(sortItems(items, 'relevance').map((entry) => entry.nome)).toEqual(['Zilda', 'Ana', 'Édouard']);
    expect(sortItems(items, 'desconhecida')).toBe(items);
  });

  it('ordena por nome respeitando o alfabeto português', () => {
    // Comparação byte a byte jogaria "Édouard" para o fim da lista.
    expect(sortItems(items, 'name-asc').map((entry) => entry.nome)).toEqual(['Ana', 'Édouard', 'Zilda']);
    expect(sortItems(items, 'name-desc').map((entry) => entry.nome)).toEqual(['Zilda', 'Édouard', 'Ana']);
  });

  it('ordena por país e joga quem não tem país para o fim', () => {
    expect(sortItems(items, 'country-asc').map((entry) => entry.nome)).toEqual(['Zilda', 'Ana', 'Édouard']);
  });

  it('nunca reordena o array de origem', () => {
    // As listas vêm do contexto de dados e são compartilhadas entre páginas;
    // ordenar no lugar faria a "ordem do catálogo" mudar pelas costas.
    const original = items.slice();
    sortItems(items, 'name-asc');
    expect(items).toEqual(original);
  });

  it('toda opção oferecida na interface tem comportamento definido', () => {
    SORT_OPTIONS.forEach((option) => {
      expect(() => sortItems(items, option.id)).not.toThrow();
      expect(sortItems(items, option.id)).toHaveLength(items.length);
    });
  });
});

describe('descrição dos filtros ativos', () => {
  const definitions = [
    { key: 'countries', label: 'País' },
    { key: 'areas', label: 'Área' },
    { key: 'genero', label: 'Gênero', emptyValue: 'todos', format: (value) => (value === 'F' ? 'Feminino' : 'Masculino') },
  ];

  it('não descreve nada quando nada está filtrando', () => {
    const state = { query: '  ', countries: [], areas: [], genero: 'todos' };
    expect(describeActiveFilters(state, definitions)).toEqual([]);
    expect(countActiveFilters(state, definitions)).toBe(0);
  });

  it('gera uma ficha por valor selecionado', () => {
    const state = { query: 'senai', countries: ['Brasil', 'Alemanha'], areas: [], genero: 'F' };
    const chips = describeActiveFilters(state, definitions);
    expect(chips.map((chip) => chip.label)).toEqual([
      'Busca: “senai”',
      'País: Brasil',
      'País: Alemanha',
      'Gênero: Feminino',
    ]);
    expect(countActiveFilters(state, definitions)).toBe(4);
  });

  it('cada ficha sabe o que remover', () => {
    // É o que permite tirar um país sem limpar a busca junto.
    const state = { query: '', countries: ['Brasil'], areas: ['Saúde'], genero: 'todos' };
    const chips = describeActiveFilters(state, definitions);
    expect(chips).toEqual([
      { key: 'countries:Brasil', label: 'País: Brasil', group: 'countries', value: 'Brasil' },
      { key: 'areas:Saúde', label: 'Área: Saúde', group: 'areas', value: 'Saúde' },
    ]);
  });

  it('trata o valor neutro de um filtro único como ausência de filtro', () => {
    expect(describeActiveFilters({ genero: 'todos' }, definitions)).toEqual([]);
    expect(describeActiveFilters({ genero: 'M' }, definitions)).toHaveLength(1);
  });
});
