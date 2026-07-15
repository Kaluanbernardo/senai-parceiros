export const RADAR_SECTIONS = ['research', 'government', 'international'];
export const RADAR_SECTION_LABELS = {
  research: 'Novas pesquisas',
  government: 'Novidades governamentais',
  international: 'Novidades internacionais',
};

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function normalizeRadarItem(item, index = 0) {
  const title = safeText(item?.title, 'Item sem título');
  const sourceName = safeText(item?.sourceName, 'Fonte não identificada');
  const externalId = safeText(item?.externalId, `${sourceName}:${title.toLocaleLowerCase('pt-BR')}`) || `${sourceName}:${title.toLocaleLowerCase('pt-BR')}:${index}`;
  const date = safeText(item?.publishedAt);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) ? date : null;
  return {
    id: safeText(item?.id, externalId),
    section: RADAR_SECTIONS.includes(item?.section) ? item.section : 'research',
    title,
    originalTitle: safeText(item?.originalTitle) || null,
    summaryPt: safeText(item?.summaryPt, 'Resumo ainda não disponível.'),
    publishedAt: validDate,
    sourceName,
    sourceUrl: safeText(item?.sourceUrl) || null,
    contentType: safeText(item?.contentType, 'atualização'),
    topics: Array.isArray(item?.topics) ? item.topics.filter(Boolean).map(String) : [],
    geography: safeText(item?.geography, 'Internacional'),
    official: Boolean(item?.official),
    relevanceScore: Math.max(0, Math.min(100, Number(item?.relevanceScore) || 0)),
    provider: safeText(item?.provider, 'unknown'),
    externalId,
    status: safeText(item?.status, item?.isPlaceholder ? 'placeholder' : 'published'),
    contentHash: safeText(item?.contentHash, externalId),
    provenance: item?.provenance && typeof item.provenance === 'object'
      ? { ...item.provenance }
      : { sourceName, sourceUrl: safeText(item?.sourceUrl) || null },
    authors: Array.isArray(item?.authors) ? item.authors.filter(Boolean).map(String) : [],
    doi: safeText(item?.doi) || null,
    updatedAt: safeText(item?.updatedAt) || null,
    isPlaceholder: Boolean(item?.isPlaceholder),
  };
}

export function dedupeRadarItems(items) {
  const seen = new Set();
  return items.map(normalizeRadarItem).filter((item) => {
    const key = item.doi || item.externalId || `${item.sourceName}:${item.title.toLocaleLowerCase('pt-BR')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fromDate(period) {
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function dateValue(value) {
  return value ? new Date(`${value}T12:00:00`).getTime() : 0;
}

export function filterRadarItems(items, filters = {}) {
  const section = RADAR_SECTIONS.includes(filters.section) ? filters.section : null;
  const query = safeText(filters.query).toLocaleLowerCase('pt-BR');
  const source = safeText(filters.source);
  const topic = safeText(filters.topic).toLocaleLowerCase('pt-BR');
  const geography = safeText(filters.geography);
  const contentType = safeText(filters.contentType);
  const cutoff = fromDate(filters.period);
  const filtered = dedupeRadarItems(items).filter((item) => {
    const haystack = [item.title, item.summaryPt, item.sourceName, item.geography, ...item.topics].join(' ').toLocaleLowerCase('pt-BR');
    return (!section || item.section === section)
      && (!query || haystack.includes(query))
      && (!source || item.sourceName === source)
      && (!geography || item.geography === geography)
      && (!topic || item.topics.some((entry) => entry.toLocaleLowerCase('pt-BR') === topic))
      && (!contentType || item.contentType === contentType)
      && (!cutoff || (item.publishedAt && dateValue(item.publishedAt) >= cutoff.getTime()));
  });
  const sort = filters.sort === 'date' ? 'date' : 'relevance';
  return filtered.sort((left, right) => sort === 'relevance'
    ? right.relevanceScore - left.relevanceScore || dateValue(right.publishedAt) - dateValue(left.publishedAt)
    : dateValue(right.publishedAt) - dateValue(left.publishedAt) || right.relevanceScore - left.relevanceScore);
}
