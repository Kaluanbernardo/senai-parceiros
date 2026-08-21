export function getEntityAddedAt(item) {
  return item?.adicionadoEm
    || item?._original?.adicionadoEm
    || item?.addedAt
    || item?.createdAt
    || null;
}

export function formatEntityAddedAt(item) {
  const value = getEntityAddedAt(item);
  if (!value) return 'Data não registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não registrada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}

/**
 * Se existe uma data de fato exibível.
 *
 * A alternativa — imprimir "Data não registrada" — aparecia em todos os
 * cartões da lista, porque o seed do catálogo não traz a data. Uma linha
 * repetida centenas de vezes dizendo que não há informação não é informação:
 * é ruído com o mesmo peso do que informa.
 */
export function hasEntityAddedAt(item) {
  const value = getEntityAddedAt(item);
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}
