/**
 * Busca, filtro e ordenação do catálogo.
 *
 * As três páginas de catálogo carregavam cada uma a sua cópia desta lógica, e
 * as cópias já haviam divergido: uma buscava em `pesquisa`, outra em
 * `descricao`, uma casava área por igualdade e outra por substring. O mesmo
 * termo digitado em duas telas dava resultados incomparáveis, sem que nada na
 * interface explicasse por quê.
 *
 * Ficando aqui, a lógica passa a ser testável sem montar componente — e ganha
 * duas correções que valem por si:
 *
 * 1. **Acento não é mais obrigatório.** `educacao` encontra "educação",
 *    `Sao Paulo` encontra "São Paulo". Num catálogo em português digitado por
 *    quem está com pressa, exigir o acento exato é a causa mais comum de "não
 *    tem nada aqui" numa base que tem.
 * 2. **Vários termos combinam.** "senai alemanha" passou a exigir os dois
 *    termos em qualquer campo, em vez de procurar a frase literal — que nunca
 *    aparece inteira em campo nenhum.
 */

/** Remove acentos e caixa para a comparação, preservando o texto original. */
export function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Divide a busca em termos. Aspas mantêm uma expressão inteira. */
export function parseQuery(query) {
  const normalized = normalize(query);
  if (!normalized) return [];
  const terms = normalized.match(/"[^"]+"|\S+/g) || [];
  return terms.map((term) => term.replace(/^"|"$/g, '')).filter(Boolean);
}

/**
 * Junta os campos pesquisáveis de um registro num texto só.
 *
 * `fields` aceita caminhos simples e arrays; valores nulos somem. Concatenar
 * uma vez por registro e casar todos os termos contra o resultado evita
 * percorrer a lista de campos uma vez por termo.
 */
export function searchableText(item, fields) {
  const parts = [];
  for (const field of fields) {
    const value = item?.[field];
    if (!value) continue;
    if (Array.isArray(value)) parts.push(value.filter(Boolean).join(' '));
    else parts.push(String(value));
  }
  return normalize(parts.join(' '));
}

/** Todos os termos precisam aparecer; a ordem entre eles não importa. */
export function matchesQuery(item, query, fields) {
  const terms = parseQuery(query);
  if (terms.length === 0) return true;
  const haystack = searchableText(item, fields);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Filtro de faceta: nenhuma seleção não filtra nada.
 *
 * O engano fácil aqui é tratar "nada selecionado" como "nada casa" e devolver
 * uma lista vazia assim que a tela abre.
 */
export function matchesFacet(value, selected) {
  if (!selected || selected.length === 0) return true;
  if (value === null || value === undefined) return false;
  const normalizedSelection = selected.map(normalize);
  const values = Array.isArray(value) ? value : [value];
  return values.some((entry) => normalizedSelection.includes(normalize(entry)));
}

/** Faceta em campo de texto livre com separadores, como `areas`. */
export function matchesTokenizedFacet(value, selected, separator = ';') {
  if (!selected || selected.length === 0) return true;
  if (!value) return false;
  const haystack = normalize(String(value).split(separator).join(' '));
  return selected.some((entry) => haystack.includes(normalize(entry)));
}

/** Valores distintos de um campo, para alimentar os seletores. */
export function collectFacetValues(items, field) {
  const seen = new Set();
  for (const item of items) {
    const value = item?.[field];
    if (value) seen.add(String(value));
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Valores distintos de um campo separado por `;`, sem os parênteses. */
export function collectTokenValues(items, field, separator = ';') {
  const seen = new Set();
  for (const item of items) {
    if (!item?.[field]) continue;
    for (const raw of String(item[field]).split(separator)) {
      const clean = raw.replace(/\(.*?\)/g, '').trim();
      if (clean) seen.add(clean);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Ordenações oferecidas nas listas.
 *
 * O catálogo só tinha a ordem do arquivo — que não é ordem nenhuma para quem
 * lê. `relevance` preserva essa ordem de origem de propósito: é a única que
 * respeita a curadoria de quem montou a base, e continua sendo o padrão.
 */
export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'relevance', label: 'Padrão' }),
  Object.freeze({ id: 'name-asc', label: 'Nome (A-Z)' }),
  Object.freeze({ id: 'name-desc', label: 'Nome (Z-A)' }),
  Object.freeze({ id: 'country-asc', label: 'País (A-Z)' }),
]);

const COMPARATORS = {
  'name-asc': (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'),
  'name-desc': (a, b) => String(b.nome || '').localeCompare(String(a.nome || ''), 'pt-BR'),
  'country-asc': (a, b) =>
    String(a.pais || '\uffff').localeCompare(String(b.pais || '\uffff'), 'pt-BR') ||
    String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'),
};

export function sortItems(items, sortId) {
  const comparator = COMPARATORS[sortId];
  // Sem `slice`, `sort` reordenaria o array do contexto de dados no lugar e a
  // "ordem do catálogo" deixaria de existir depois da primeira ordenação.
  return comparator ? items.slice().sort(comparator) : items;
}

/**
 * Descreve os filtros ativos para a interface poder mostrá-los como fichas
 * removíveis. A tela antiga escondia o painel de filtros num botão e, com ele
 * fechado, não havia como saber que uma seleção estava recortando a lista.
 */
export function describeActiveFilters(state, definitions) {
  const chips = [];
  if (state.query?.trim()) {
    chips.push({ key: 'query', label: `Busca: “${state.query.trim()}”`, group: 'query' });
  }
  for (const definition of definitions) {
    const selected = state[definition.key];
    if (Array.isArray(selected)) {
      for (const value of selected) {
        chips.push({ key: `${definition.key}:${value}`, label: `${definition.label}: ${value}`, group: definition.key, value });
      }
    } else if (selected && selected !== definition.emptyValue) {
      const label = definition.format ? definition.format(selected) : selected;
      chips.push({ key: definition.key, label: `${definition.label}: ${label}`, group: definition.key, value: selected });
    }
  }
  return chips;
}

export function countActiveFilters(state, definitions) {
  return describeActiveFilters(state, definitions).length;
}
