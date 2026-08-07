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
