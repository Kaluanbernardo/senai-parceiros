/**
 * Qual registro está aberto, a partir do identificador guardado na URL.
 *
 * A busca acontece primeiro na lista filtrada, porque é dela que saem o "3 de
 * 24" e os vizinhos de navegação. Um endereço compartilhado, porém, chega sem
 * os filtros de quem o enviou — e recusar a ficha nesse caso transformaria o
 * link num beco. Daí a segunda tentativa, sobre o catálogo inteiro: a ficha
 * abre, apenas sem posição nem vizinhos, porque de fato não há lista à qual
 * ela pertença naquele recorte.
 */
/**
 * Endereço da ficha de um registro no catálogo.
 *
 * É o que devolve o caminho de volta a partir de uma recomendação: o candidato
 * de uma shortlist é um registro do catálogo, e sem este elo ver a ficha
 * completa exigia sair da recomendação, abrir o catálogo e procurar pelo nome.
 */
export function catalogRouteForCandidate(category, id) {
  if (id === null || id === undefined || id === '') return '';
  const base = String(category) === 'person' ? '/catalogo/pessoas-fisicas' : '/catalogo/pessoas-juridicas';
  return `${base}?perfil=${encodeURIComponent(String(id))}`;
}

export function resolveCatalogSelection(filtered, universe, id) {
  const total = filtered.length;
  if (id === null || id === undefined || id === '') {
    return { item: null, index: -1, total, previousId: null, nextId: null };
  }
  const wanted = String(id);
  const index = filtered.findIndex((item) => String(item?.id) === wanted);
  if (index === -1) {
    const orphan = universe.find((item) => String(item?.id) === wanted) || null;
    return { item: orphan, index: -1, total, previousId: null, nextId: null };
  }
  return {
    item: filtered[index],
    index,
    total,
    previousId: index > 0 ? String(filtered[index - 1].id) : null,
    nextId: index < total - 1 ? String(filtered[index + 1].id) : null,
  };
}
