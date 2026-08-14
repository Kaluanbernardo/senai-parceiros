import { displaySummaryFor, displayTitleFor, needsEditorialTreatment, translateContentType, translateTopics } from './radarEditorial.js';

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

function ageInDays(date, now) {
  if (!date) return null;
  const timestamp = new Date(`${date}T12:00:00Z`).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((now.getTime() - timestamp) / 86400000);
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
    summaryPt: safeText(item?.summaryPt, item?.summaryStatus === 'unavailable' ? '' : 'Resumo ainda não disponível.'),
    publishedAt: validDate,
    sourceName,
    sourceUrl: safeText(item?.sourceUrl) || null,
    contentType: translateContentType(safeText(item?.contentType, 'atualização')),
    topics: translateTopics(Array.isArray(item?.topics) ? item.topics.filter(Boolean).map(String) : []),
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
    abstractText: safeText(item?.abstractText, ''),
    summaryStatus: ['source', 'ai', 'extractive', 'unavailable'].includes(item?.summaryStatus) ? item.summaryStatus : (item?.summaryPt ? 'source' : 'unavailable'),
    summaryInputHash: safeText(item?.summaryInputHash) || null,
    summaryUpdatedAt: safeText(item?.summaryUpdatedAt) || null,
    summaryProvenance: item?.summaryProvenance && typeof item.summaryProvenance === 'object' ? { ...item.summaryProvenance } : null,
    updatedAt: safeText(item?.updatedAt) || null,
    isPlaceholder: Boolean(item?.isPlaceholder),
    editorialTitle: safeText(item?.editorialTitle) || null,
    editorialSummary: safeText(item?.editorialSummary) || null,
    sourceContext: safeText(item?.sourceContext) || null,
    editorialStatus: ['ai', 'source'].includes(item?.editorialStatus) ? item.editorialStatus : (safeText(item?.editorialTitle) ? 'ai' : 'source'),
    editorialInputHash: safeText(item?.editorialInputHash) || null,
    editorialUpdatedAt: safeText(item?.editorialUpdatedAt) || null,
    editorialProvenance: item?.editorialProvenance && typeof item.editorialProvenance === 'object' ? { ...item.editorialProvenance } : null,
  };
  return {
    ...base,
    ...noveltyFor(validDate),
    // What the interface shows is derived here so that every reader of an item
    // — card, filter, search — agrees on it, and so that an item stored before
    // the editorial pass existed still displays in readable Portuguese.
    displayTitle: displayTitleFor(base),
    displaySummary: displaySummaryFor(base),
    rawSourceText: needsEditorialTreatment(base),
  };
}

export function dedupeRadarItems(items) {
  const seen = new Set();
  const seenTitles = new Set();
  return items.map(normalizeRadarItem).filter((item) => {
    const stableId = item.doi || item.externalId;
    const key = stableId || `${item.sourceName}:${item.title.toLocaleLowerCase('pt-BR')}`;
    const titleKey = folded(item.title).replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key) || (!stableId && titleKey && seenTitles.has(`${item.section}:${titleKey}`))) return false;
    seen.add(key);
    if (!stableId && titleKey) seenTitles.add(`${item.section}:${titleKey}`);
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

/**
 * Widest window, which is also the default view.  Items whose source page
 * exposes no parsable date are a labelled class ("Referência sem data"), not old
 * items, so they stay visible here; a deliberately narrower window is a recency
 * question they cannot answer.  Dropping them everywhere made collected results
 * disappear from the interface with no signal at all.
 */
const UNDATED_VISIBLE_PERIOD = '1y';

export function countUndatedItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !item?.publishedAt).length;
}

/**
 * Single definition of what deserves to be collected, stored and shown: dated
 * news inside the 12-month window, plus undated institutional references.
 * Archive, scheduled and placeholder items stay out.
 *
 * `isNews` alone used to gate collection, snapshot writing and display. It is
 * false for undated items, and institutional portals frequently publish without
 * a parsable date, so those pages were discarded at the earliest step and could
 * never reach a reader no matter what the interface did.
 */
export function isEligibleRadarItem(item) {
  return Boolean(item)
    && (item.isNews || item.noveltyStatus === 'reference')
    && !item.isPlaceholder;
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
    // Search has to cover both what the reader sees and what the source
    // published: a query typed from the card must match, and a query with the
    // act's own number must keep finding it.
    const haystack = [item.displayTitle, item.displaySummary, item.title, item.originalTitle, item.summaryPt, item.sourceName, item.geography, ...item.topics].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return (!section || item.section === section)
      && (!query || haystack.includes(query))
      && (!source || item.sourceName === source)
      && (!geography || item.geography === geography)
      && (!topic || item.topics.some((entry) => entry.toLocaleLowerCase('pt-BR') === topic))
      && (!contentType || item.contentType === contentType)
      && (!cutoff || (item.publishedAt
        ? dateValue(item.publishedAt) >= cutoff.getTime()
        : filters.period === UNDATED_VISIBLE_PERIOD));
  });
  return filtered.sort((left, right) => dateValue(right.publishedAt) - dateValue(left.publishedAt)
    || left.displayTitle.localeCompare(right.displayTitle, 'pt-BR'));
}
