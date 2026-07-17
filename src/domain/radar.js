export const RADAR_SECTIONS = ['research', 'government', 'international'];
export const RADAR_SECTION_LABELS = {
  research: 'Novas pesquisas',
  government: 'Novidades governamentais',
  international: 'Novidades internacionais',
};

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function folded(value) {
  return safeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

const CORE_TERMS = ['educacao profissional', 'educacao tecnologica', 'formacao profissional', 'formacao tecnica', 'vocational education', 'technical education', 'tvet', 'vet', 'apprenticeship', 'aprendizagem profissional', 'qualificacao profissional'];
const STRATEGIC_TERMS = ['industria', 'industrial', 'manufacturing', 'competencias', 'skills', 'inovacao', 'innovation', 'inteligencia artificial', 'artificial intelligence', 'digital', 'sustentabilidade', 'green', 'descarbonizacao', 'economia circular', 'trabalho', 'employment'];

function ageInDays(date, now) {
  if (!date) return null;
  const timestamp = new Date(`${date}T12:00:00Z`).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / 86400000);
}

export function calculateRadarRelevance(item, { now = new Date() } = {}) {
  const haystack = folded([item?.title, item?.summaryPt, ...(item?.topics || [])].join(' '));
  const coreMatches = CORE_TERMS.filter((term) => haystack.includes(term)).length;
  const strategicMatches = STRATEGIC_TERMS.filter((term) => haystack.includes(term)).length;
  const thematic = Math.min(50, Math.min(35, coreMatches * 9) + Math.min(15, strategicMatches * 4));
  const ageDays = ageInDays(item?.publishedAt, now);
  const recency = ageDays === null || ageDays < -7 ? 0 : ageDays <= 30 ? 30 : ageDays <= 90 ? 24 : ageDays <= 180 ? 18 : ageDays <= 365 ? 10 : 0;
  const provider = safeText(item?.provider).toLowerCase();
  const sourceQuality = item?.official ? 20 : ['openalex', 'crossref'].includes(provider) ? 18 : provider.startsWith('curated-') ? 14 : 15;
  const breakdown = { thematic, recency, sourceQuality };
  return {
    score: thematic + recency + sourceQuality,
    breakdown,
    explanation: `Tema ${thematic}/50 · recência ${recency}/30 · qualidade da fonte ${sourceQuality}/20`,
  };
}

function noveltyFor(date, now = new Date()) {
  const ageDays = ageInDays(date, now);
  if (ageDays === null) return { noveltyStatus: 'reference', noveltyLabel: 'Referência sem data', isNews: false, ageDays: null };
  if (ageDays < -7) return { noveltyStatus: 'scheduled', noveltyLabel: 'Publicação futura', isNews: false, ageDays };
  if (ageDays <= 30) return { noveltyStatus: 'new', noveltyLabel: 'Novo · últimos 30 dias', isNews: true, ageDays };
  if (ageDays <= 365) return { noveltyStatus: 'recent', noveltyLabel: 'Recente · últimos 12 meses', isNews: true, ageDays };
  return { noveltyStatus: 'archive', noveltyLabel: 'Arquivo · mais de 12 meses', isNews: false, ageDays };
}

export function normalizeRadarItem(item, index = 0) {
  const title = safeText(item?.title, 'Item sem título');
  const sourceName = safeText(item?.sourceName, 'Fonte não identificada');
  const externalId = safeText(item?.externalId, `${sourceName}:${title.toLocaleLowerCase('pt-BR')}`) || `${sourceName}:${title.toLocaleLowerCase('pt-BR')}:${index}`;
  const date = safeText(item?.publishedAt);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) ? date : null;
  const base = {
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
  const relevance = calculateRadarRelevance(base);
  return {
    ...base,
    relevanceScore: relevance.score,
    relevanceBreakdown: relevance.breakdown,
    relevanceExplanation: relevance.explanation,
    ...noveltyFor(validDate),
  };
}

export function dedupeRadarItems(items) {
  const seen = new Set();
  const seenTitles = new Set();
  return items.map(normalizeRadarItem).filter((item) => {
    const key = item.doi || item.externalId || `${item.sourceName}:${item.title.toLocaleLowerCase('pt-BR')}`;
    const titleKey = folded(item.title).replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key) || (titleKey && seenTitles.has(`${item.section}:${titleKey}`))) return false;
    seen.add(key);
    if (titleKey) seenTitles.add(`${item.section}:${titleKey}`);
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
