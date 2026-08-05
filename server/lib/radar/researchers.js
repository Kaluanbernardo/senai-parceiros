import { normalizeRadarItem } from '../../../src/domain/radar.js';
import { buildEvidenceFallback, buildSummaryMetadata, reconstructOpenAlexAbstract } from './summaries.js';

const authorCache = new Map();
const AUTHOR_CACHE_TTL = 24 * 60 * 60 * 1000;
let nextOpenAlexRequestAt = 0;

function fold(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return fold(value).split(' ').filter((token) => token.length > 2);
}

function overlapScore(left, right) {
  const expected = new Set(tokens(left));
  const actual = new Set(tokens(right));
  if (!expected.size || !actual.size) return 0;
  return [...expected].filter((token) => actual.has(token)).length / expected.size;
}

const TOPIC_STOPWORDS = new Set(['para', 'com', 'uma', 'das', 'dos', 'de', 'da', 'do', 'the', 'and', 'for', 'with', 'research', 'study', 'studies']);

function topicTokens(value) {
  return new Set(tokens(value).filter((token) => !TOPIC_STOPWORDS.has(token)));
}

function hasTopicOverlap(left, right) {
  const expected = topicTokens(left);
  const actual = topicTokens(right);
  return expected.size > 0 && [...expected].some((token) => actual.has(token));
}

function openAlexHeaders() {
  return process.env.OPENALEX_MAILTO
    ? { 'User-Agent': `senai-parceiros/1.0 (mailto:${process.env.OPENALEX_MAILTO})` }
    : { 'User-Agent': 'senai-parceiros/1.0 radar-researchers' };
}

function withApiKey(params) {
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  return params;
}

async function fetchOpenAlexJson(url, { timeoutMs = 8_000, attempts = 3 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (process.env.NODE_ENV !== 'test') {
      const waitMs = Math.max(0, nextOpenAlexRequestAt - Date.now());
      nextOpenAlexRequestAt = Math.max(Date.now(), nextOpenAlexRequestAt) + 130;
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    const response = await fetch(url, { headers: openAlexHeaders(), signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) return response.json();
    if (response.status !== 429 || attempt === attempts) throw new Error(`openalex_${response.status}`);
    const retryAfter = Math.min(1_500, Math.max(150, Number(response.headers.get('retry-after') || 0) * 1_000 || attempt * 250));
    await new Promise((resolve) => setTimeout(resolve, retryAfter));
  }
  throw new Error('openalex_unavailable');
}

function authorCacheKey(record) {
  return `${fold(record.nome)}|${fold(record.instituicao)}|${fold(record.artigos?.[0]?.titulo)}`;
}

function authorId(value) {
  return String(value || '').match(/A\d+/i)?.[0]?.toUpperCase() || '';
}

function selectAuthor(catalogRecord, candidates) {
  const expectedName = fold(catalogRecord.nome);
  return (candidates || [])
    .map((candidate) => {
      const names = [candidate.display_name, ...(candidate.alternate_names || [])].map(fold);
      if (!names.includes(expectedName)) return null;
      const affiliations = (candidate.affiliations || []).map((entry) => entry?.institution?.display_name).filter(Boolean);
      const institutionScore = Math.max(0, ...affiliations.map((name) => overlapScore(catalogRecord.instituicao, name)));
      if (institutionScore < 0.34) return null;
      const catalogTopics = `${catalogRecord.areas || ''} ${catalogRecord.pesquisa || ''}`;
      const candidateTopics = (candidate.topics || []).map((topic) => topic?.display_name).filter(Boolean).join(' ');
      if (topicTokens(catalogTopics).size && !hasTopicOverlap(catalogTopics, candidateTopics)) return null;
      return { candidate, score: 100 + institutionScore * 25 + (hasTopicOverlap(catalogTopics, candidateTopics) ? 20 : 0) };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)[0]?.candidate || null;
}

async function resolveAuthorFromAnchor(record) {
  const anchorTitle = record.artigos?.find((article) => article?.titulo)?.titulo;
  if (!anchorTitle) return null;
  const params = withApiKey(new URLSearchParams({
    search: anchorTitle,
    per_page: '5',
    select: 'id,display_name,title,authorships',
  }));
  const body = await fetchOpenAlexJson(`https://api.openalex.org/works?${params}`);
  const expectedTitle = fold(anchorTitle);
  const work = (body.results || []).find((candidate) => fold(candidate.display_name || candidate.title) === expectedTitle);
  const authorship = (work?.authorships || []).find((entry) => fold(entry?.author?.display_name) === fold(record.nome));
  const id = authorId(authorship?.author?.id);
  return id ? { id, record, resolution: 'catalog-work-anchor' } : null;
}

async function resolveAuthor(record) {
  const key = authorCacheKey(record);
  const cached = authorCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const catalogOpenAlexId = authorId(record.openalex_id);
  if (catalogOpenAlexId) {
    const direct = { id: catalogOpenAlexId, record, resolution: 'catalog-openalex-id' };
    authorCache.set(key, { value: direct, expiresAt: Date.now() + AUTHOR_CACHE_TTL });
    return direct;
  }
  let anchored = null;
  try {
    anchored = await resolveAuthorFromAnchor(record);
  } catch {
    // A catalog anchor is preferred evidence, but OpenAlex may not index older
    // books or reports. The author endpoint remains an explicit fallback.
  }
  if (anchored) {
    authorCache.set(key, { value: anchored, expiresAt: Date.now() + AUTHOR_CACHE_TTL });
    return anchored;
  }
  const params = withApiKey(new URLSearchParams({ search: record.nome, per_page: '5' }));
  const body = await fetchOpenAlexJson(`https://api.openalex.org/authors?${params}`);
  const candidate = selectAuthor(record, body.results);
  const value = candidate ? { id: authorId(candidate.id), record, openAlex: candidate, resolution: 'name-and-affiliation' } : null;
  authorCache.set(key, { value, expiresAt: Date.now() + AUTHOR_CACHE_TTL });
  return value;
}

async function resolveAuthorsBatch(catalog) {
  if (!catalog.length) return [];
  const names = [...new Set(catalog.map((record) => record.nome))];
  const params = withApiKey(new URLSearchParams({
    filter: `display_name:${names.join('|')}`,
    per_page: '100',
  }));
  const body = await fetchOpenAlexJson(`https://api.openalex.org/authors?${params}`, { timeoutMs: 12_000 });
  const candidates = body.results || [];
  return catalog.map((record) => {
    const candidate = selectAuthor(record, candidates);
    if (!candidate) return null;
    const value = { id: authorId(candidate.id), record, openAlex: candidate, resolution: 'batch-name-and-affiliation' };
    authorCache.set(authorCacheKey(record), { value, expiresAt: Date.now() + AUTHOR_CACHE_TTL });
    return value;
  });
}

async function mapConcurrent(values, concurrency, operation) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await operation(values[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function trackedWorkItem(work, trackedResearchers, fetchedAt, resolutionMethods) {
  const authorNames = (work.authorships || []).map((entry) => entry?.author?.display_name).filter(Boolean);
  const topicNames = (work.topics || []).slice(0, 4).map((topic) => topic?.display_name).filter(Boolean);
  const abstractText = reconstructOpenAlexAbstract(work.abstract_inverted_index);
  const summary = buildSummaryMetadata({
    id: work.id,
    title: work.display_name || work.title,
    sourceText: abstractText,
    summary: buildEvidenceFallback(abstractText),
    status: abstractText ? 'extractive' : 'unavailable',
    source: 'OpenAlex',
    provider: 'openalex',
  });
  return normalizeRadarItem({
    ...summary,
    id: work.id,
    externalId: work.id,
    doi: work.doi || null,
    section: 'research',
    title: work.display_name || work.title,
    originalTitle: work.display_name || work.title,
    summaryPt: abstractText
      ? buildEvidenceFallback(abstractText)
      : `Estudo recente de ${trackedResearchers.join(', ')}. Consulte a fonte original para resumo, método e resultados.`,
    abstractText,
    publishedAt: work.publication_date,
    sourceName: 'OpenAlex',
    sourceUrl: work.doi || work.primary_location?.landing_page_url || work.id,
    contentType: work.type || 'trabalho acadêmico',
    topics: ['Pesquisador cadastrado', ...topicNames],
    geography: work.authorships?.[0]?.institutions?.[0]?.country_code || 'Internacional',
    official: false,
    provider: 'openalex',
    authors: authorNames,
    provenance: { trackedResearchers, authorMatch: 'openalex-id', resolutionMethods, fetchedAt },
  });
}

export function resetResearcherCache() {
  authorCache.clear();
}

export async function collectTrackedResearcherStudies({ catalog = [], knownResolutions = [], now = new Date(), maxPages = 10, concurrency = 6, resolutionBudget = 24, resolutionCursor = 0, worksCursor = '*', worksCursorAuthorIds = [] } = {}) {
  const canonical = (catalog || []).filter((record) => record?.nome);
  const catalogById = new Map(canonical.map((record) => [String(record.id), record]));
  const known = (knownResolutions || []).map((entry) => {
    const record = catalogById.get(String(entry.catalogId));
    const id = authorId(entry.openAlexId);
    return record && id ? { id, record, resolution: entry.resolution || 'persisted-openalex-id' } : null;
  }).filter(Boolean);
  const knownKeys = new Set(known.map((entry) => authorCacheKey(entry.record)));
  const unresolvedCatalog = canonical.filter((record) => !knownKeys.has(authorCacheKey(record)));
  let batchResolved = [];
  try {
    batchResolved = (await resolveAuthorsBatch(unresolvedCatalog)).filter((entry) => entry?.id);
  } catch {
    batchResolved = [];
  }
  const batchKeys = new Set(batchResolved.map((entry) => authorCacheKey(entry.record)));
  const remaining = unresolvedCatalog.filter((record) => !batchKeys.has(authorCacheKey(record)));
  const attemptCount = Math.min(remaining.length, Math.max(0, Number(resolutionBudget) || 0));
  const attemptStart = remaining.length ? Math.max(0, Number(resolutionCursor) || 0) % remaining.length : 0;
  const attempted = Array.from({ length: attemptCount }, (_, index) => remaining[(attemptStart + index) % remaining.length]);
  const nextResolutionCursor = remaining.length ? (attemptStart + attemptCount) % remaining.length : 0;
  const resolutions = await mapConcurrent(attempted, concurrency, resolveAuthor);
  const resolved = [...known, ...batchResolved, ...resolutions.filter((result) => result.status === 'fulfilled' && result.value?.id).map((result) => result.value)];
  const errors = resolutions.filter((result) => result.status === 'rejected').map((result) => String(result.reason?.message || 'author_resolution_failed').slice(0, 80));
  const byId = new Map();
  for (const entry of resolved) {
    const records = byId.get(entry.id) || [];
    records.push(entry);
    byId.set(entry.id, records);
  }
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  const startDate = start.toISOString().slice(0, 10);
  const works = [];
  const currentAuthorIds = [...byId.keys()].sort();
  const cursorAuthorIds = (worksCursorAuthorIds || []).map(String).sort();
  const cursorMatchesQuery = worksCursor === '*' || currentAuthorIds.join('|') === cursorAuthorIds.join('|');
  let cursor = cursorMatchesQuery ? (worksCursor || '*') : '*';
  let pagesRead = 0;
  while (byId.size && cursor && pagesRead < maxPages) {
    const params = withApiKey(new URLSearchParams({
      filter: `authorships.author.id:${[...byId.keys()].join('|')},from_publication_date:${startDate},to_publication_date:${endDate}`,
      per_page: '100',
      sort: 'publication_date:desc',
      cursor,
      select: 'id,doi,title,display_name,publication_date,type,primary_location,authorships,topics,abstract_inverted_index',
    }));
    const body = await fetchOpenAlexJson(`https://api.openalex.org/works?${params}`, { timeoutMs: 12_000 });
    works.push(...(body.results || []));
    pagesRead += 1;
    cursor = body.meta?.next_cursor || null;
    if (!(body.results || []).length) cursor = null;
  }
  const fetchedAt = now.toISOString();
  let worksRejectedIdentity = 0;
  const items = works.map((work) => {
    const ids = (work.authorships || []).map((entry) => authorId(entry?.author?.id)).filter(Boolean);
    // The catalog identity has already been resolved to an OpenAlex author ID.
    // Requiring the work to repeat an old affiliation or catalog topic would
    // omit legitimate publications after a move or in an adjacent research area.
    const matches = ids.flatMap((id) => byId.get(id) || []);
    if (!matches.length) worksRejectedIdentity += 1;
    const names = [...new Set(matches.map((record) => record.record.nome))];
    const resolutionMethods = [...new Set(matches.map((record) => record.resolution))];
    return names.length ? trackedWorkItem(work, names, fetchedAt, resolutionMethods) : null;
  }).filter((item) => item?.isNews);
  const authorsUnresolved = canonical.length - resolved.length;
  const pageCapReached = Boolean(cursor);
  const complete = authorsUnresolved === 0 && !pageCapReached;
  return {
    items,
    errors,
    coverage: {
      windowStart: startDate,
      windowEnd: endDate,
      catalogTotal: canonical.length,
      authorsResolved: resolved.length,
      authorsUnresolved,
      pagesRead,
      worksRetrieved: works.length,
      worksRejectedIdentity,
      resolutionsAttempted: attempted.length,
      resolutionCursor: nextResolutionCursor,
      worksCursor: pageCapReached ? cursor : null,
      worksCursorAuthorIds: pageCapReached ? currentAuthorIds : [],
      resolvedAuthorMap: resolved.map((entry) => ({ catalogId: entry.record.id, openAlexId: entry.id, resolution: entry.resolution })),
      complete,
      reason: authorsUnresolved ? 'unresolved_authors' : pageCapReached ? 'page_cap' : 'source_exhausted',
    },
  };
}
