import seedItems from '../../src/data/radar-seeds.json' with { type: 'json' };
import { dedupeRadarItems, filterRadarItems, isEligibleRadarItem, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';
import { getCatalog } from './catalog.js';
import { hydrateCatalogStore } from './catalogImport.js';
import { radarStore } from './radarStore.js';
import { editorializeRadarItems } from './radar/editorialService.js';
import { sanitizeProviderError } from './radar/contracts.js';
import { needsEditorialTreatment } from '../../src/domain/radarEditorial.js';
import { summarizeResearchItems } from './radar/researchSummaryService.js';
import { buildEvidenceFallback, buildSummaryMetadata, extractCrossrefAbstract, mergeResearchItems, reconstructOpenAlexAbstract } from './radar/summaries.js';
import { DirectOfficialWebProvider } from './radar/web/directOfficial.js';
import { TavilyWebProvider } from './radar/web/tavily.js';
import { collectDoeSpSource, collectIloSitemapSource, collectPaginatedInstitutionalSource, collectWordPressSource, semanticEvidence } from './radar/institutional.js';
import { collectTrackedResearcherStudies } from './radar/researchers.js';
export { dedupeRadarItems, filterRadarItems, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';

export const RADAR_SOURCE_POLICY = [
  { name: 'OpenAlex', kind: 'research', url: 'https://openalex.org', official: false },
  { name: 'Crossref', kind: 'research', url: 'https://www.crossref.org', official: false },
  { name: 'MEC / SETEC', kind: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos', official: true },
  { name: 'INEP', kind: 'government', url: 'https://www.gov.br/inep/pt-br', official: true },
  { name: 'Diário Oficial da União', kind: 'government', url: 'https://www.in.gov.br', official: true },
  { name: 'Diário Oficial do Estado de São Paulo', kind: 'government', url: 'https://www.doe.sp.gov.br', official: true },
  { name: 'Centro Paula Souza', kind: 'government', url: 'https://www.cps.sp.gov.br', official: true },
  { name: 'Secretaria da Educação de SP', kind: 'government', url: 'https://www.educacao.sp.gov.br', official: true },
  { name: 'Agência SP', kind: 'government', url: 'https://www.agenciasp.sp.gov.br', official: true },
  { name: 'OCDE', kind: 'international', url: 'https://www.oecd.org/en/topics/vocational-education-and-training-vet.html', official: true },
  { name: 'OIT', kind: 'international', url: 'https://www.ilo.org/topics-and-sectors/skills-and-lifelong-learning/skills-and-employability-branch', official: true },
  { name: 'Cedefop', kind: 'international', url: 'https://www.cedefop.europa.eu', official: true },
  { name: 'ETF', kind: 'international', url: 'https://www.etf.europa.eu', official: true },
  { name: 'UNESCO-UNEVOC', kind: 'international', url: 'https://unevoc.unesco.org', official: true },
];

export const RADAR_FEED_POLICY = [];

export const RADAR_FEED_MANIFEST_VERSION = '2026-07-31.v7';

export const RADAR_WEB_POLICY = [
  { name: 'MEC / SETEC', section: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos/noticias/noticias', official: true, geography: 'Brasil', pageParam: 'b_start:int', pageStep: 15, includeFirstPageParam: true, maxPages: 60, batchPages: 4, incremental: true, timeoutMs: 20000 },
  { name: 'INEP', section: 'government', url: 'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/ept', official: true, geography: 'Brasil', pageParam: 'b_start:int', pageStep: 30, maxPages: 60, batchPages: 4, incremental: true },
  { name: 'Centro Paula Souza', section: 'government', url: 'https://www.cps.sp.gov.br/noticias/', official: true, geography: 'São Paulo', collector: 'wordpress', maxPages: 8, timeoutMs: 25000 },
  { name: 'Secretaria da Educação de SP', section: 'government', url: 'https://www.educacao.sp.gov.br/noticias/', official: true, geography: 'São Paulo', maxPages: 60, batchPages: 4, incremental: true },
  { name: 'Agência SP', section: 'government', url: 'https://www.agenciasp.sp.gov.br/', official: true, geography: 'São Paulo', collector: 'wordpress', maxPages: 5 },
  { name: 'Diário Oficial do Estado de São Paulo', section: 'government', url: 'https://www.doe.sp.gov.br/', apiUrl: 'https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications', official: true, geography: 'São Paulo', collector: 'doe-sp', terms: ['educação profissional', 'educação profissional técnica', 'ensino técnico', 'curso técnico', 'formação profissional'], batchPages: 4, maxItems: 1000, timeoutMs: 40000, deadlineMs: 50000 },
  { name: 'OIT', section: 'international', url: 'https://www.ilo.org/resource/news', official: true, geography: 'Internacional', collector: 'ilo-sitemap', sitemapUrl: 'https://www.ilo.org/sitemap.xml', maxDocuments: 60, articleConcurrency: 20, maxItems: 1000 },
  // Cedefop may challenge individual paginated requests. Keep an honest cursor
  // and retry the blocked page on the next run; never call page one a complete
  // annual backfill merely because newer items were collected successfully.
  { name: 'Cedefop', section: 'international', url: 'https://www.cedefop.europa.eu/en/news', official: true, geography: 'Internacional', pageParam: 'page', maxPages: 20, batchPages: 1, incremental: true, coverageVersion: 2 },
  { name: 'ETF', section: 'international', url: 'https://www.etf.europa.eu/en/news-and-events/news', official: true, geography: 'Internacional', pageParam: 'page', maxPages: 60, batchPages: 8, incremental: true },
  { name: 'UNESCO-UNEVOC', section: 'international', url: 'https://connect.unevoc.unesco.org/home/UNEVOC+News', official: true, geography: 'Internacional', allowedHosts: ['www.unevoc.unesco.org', 'www.unesco.org', 'atlas.unevoc.unesco.org'], pagePath: '/home/UNEVOC+News/lang=en/page={page}', maxPages: 60, batchPages: 4, incremental: true, timeoutMs: 20000 },
];

const RADAR_SECTION_SET = new Set(RADAR_SECTIONS);

function configuredExtraFeeds() {
  const raw = String(process.env.RADAR_EXTRA_FEEDS_JSON || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const officialSources = new Map(RADAR_SOURCE_POLICY.filter((source) => source.official).map((source) => [source.name, source]));
    return parsed
      .filter((feed) => feed && officialSources.has(feed.name) && RADAR_SECTION_SET.has(feed.section) && feed.official === true)
      .map((feed) => {
        const officialSource = officialSources.get(feed.name);
        const value = {
          name: String(feed.name),
          section: String(feed.section),
          url: String(feed.url || ''),
          official: true,
          geography: String(feed.geography || 'Internacional'),
        };
        try {
          const configuredHost = new URL(value.url).hostname.replace(/^www\./i, '').toLowerCase();
          const officialHost = new URL(officialSource.url).hostname.replace(/^www\./i, '').toLowerCase();
          return /^https:\/\//i.test(value.url) && (configuredHost === officialHost || configuredHost.endsWith(`.${officialHost}`)) ? value : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getRadarFeedPolicy() {
  const feeds = [...RADAR_FEED_POLICY, ...configuredExtraFeeds()];
  const seen = new Set();
  return feeds.filter((feed) => {
    const key = `${feed.name}:${feed.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getRadarFeedReadiness() {
  const feeds = getRadarFeedPolicy();
  const sources = RADAR_SOURCE_POLICY;
  const sections = {
    research: sources.some((source) => source.kind === 'research'),
    government: sources.some((source) => source.name === 'Diário Oficial da União'),
    international: sources.some((source) => source.name === 'OCDE')
      && RADAR_WEB_POLICY.some((source) => source.section === 'international' && source.official === true),
  };
  const validUrls = feeds.every((feed) => {
    try { return feed.official === true && new URL(feed.url).protocol === 'https:'; } catch { return false; }
  });
  return {
    manifestVersion: RADAR_FEED_MANIFEST_VERSION,
    ready: Object.values(sections).every(Boolean) && validUrls,
    sections,
    builtInCount: RADAR_FEED_POLICY.length,
    configuredCount: Math.max(0, feeds.length - RADAR_FEED_POLICY.length),
    totalCount: feeds.length,
  };
}

function htmlText(value) {
  return String(value || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function absoluteUrl(href, baseUrl) {
  try {
    const base = new URL(baseUrl);
    const url = new URL(href, base);
    if (url.protocol !== 'https:' || url.hostname !== base.hostname) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function hasVocationalResearchSignal(work) {
  const title = htmlText(work?.display_name || work?.title);
  const indexedTopics = (work?.topics || []).map((topic) => topic?.display_name).filter(Boolean).join(' ');
  const haystack = `${title} ${indexedTopics}`.toLocaleLowerCase('pt-BR');
  return [
    'vocational', 'tvet', 'technical education', 'technical and vocational',
    'apprenticeship', 'career and technical education', 'educação profissional',
    'educacao profissional', 'formação profissional', 'formacao profissional',
    'educação tecnológica', 'educacao tecnologica', 'education and vocational training',
  ].some((term) => haystack.includes(term));
}

function conciseText(value, max = 360) {
  const clean = htmlText(value);
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max);
  const boundary = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('; '), clipped.lastIndexOf(', '), clipped.lastIndexOf(' '));
  return `${clipped.slice(0, boundary > max * 0.65 ? boundary : max).trim()}…`;
}

function webItem(candidate, source, index) {
  const title = htmlText(candidate.title);
  const summary = conciseText(candidate.summary) || 'Atualização pública recuperada da página institucional; consulte a fonte original para os detalhes.';
  const dateText = htmlText(candidate.date);
  const parsedDate = dateText ? new Date(dateText) : null;
  const dateFromText = dateText.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toISOString().slice(0, 10)
    : dateFromText
      ? dateFromText[1]
        ? `${dateFromText[1]}-${String(dateFromText[2]).padStart(2, '0')}-${String(dateFromText[3]).padStart(2, '0')}`
        : `${dateFromText[6]}-${String(dateFromText[5]).padStart(2, '0')}-${String(dateFromText[4]).padStart(2, '0')}`
      : null;
  const sourceUrl = candidate.url;
  return normalizeRadarItem({
    section: source.section,
    title,
    summaryPt: summary,
    publishedAt,
    sourceName: source.name,
    sourceUrl,
    contentType: 'notícia institucional',
    topics: ['EPT'],
    geography: source.geography,
    official: source.official,
    provider: 'institutional-web',
    externalId: sourceUrl || `${source.name}:${title}:${index}`,
    provenance: { pageUrl: source.url, fetchedAt: new Date().toISOString() },
  });
}

export async function fetchWebItems(source, { limit = 8, previousCoverage = null } = {}) {
  const pageCount = Number(source.batchPages || source.maxPages || 1);
  const coverageCursor = previousCoverage?.complete
    ? 'complete'
    : `${previousCoverage?.nextPage ?? 'none'}:${previousCoverage?.candidateOffset ?? 'none'}`;
  const cacheKey = `web:${source.url}:${limit}:${pageCount}:${coverageCursor}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const result = source.collector === 'wordpress'
    ? await collectWordPressSource(source, { maxPages: pageCount })
    : source.collector === 'doe-sp'
      ? await collectDoeSpSource(source, { maxPages: pageCount, previousCoverage })
      : source.collector === 'ilo-sitemap'
        ? await collectIloSitemapSource(source, { previousCoverage })
        : await collectPaginatedInstitutionalSource(source, { maxPages: pageCount, previousCoverage });
  const itemLimit = Number(source.maxItems || (source.maxPages ? 1000 : limit));
  const items = result.items
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || a.title.localeCompare(b.title, 'pt-BR'))
    .slice(0, itemLimit);
  Object.defineProperty(items, 'coverage', { value: result.coverage, enumerable: false });
  cacheSet(cacheKey, items);
  return items;
}

const liveCache = new Map();
const LIVE_CACHE_TTL = 10 * 60 * 1000;
const LIVE_CACHE_MAX = 24;

export function resetRadarLiveCache() {
  liveCache.clear();
}

function cacheGet(key) {
  const cached = liveCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    liveCache.delete(key);
    return null;
  }
  return cached.items;
}

function cacheSet(key, items) {
  const now = Date.now();
  for (const [entryKey, entry] of liveCache) if (entry.expiresAt <= now) liveCache.delete(entryKey);
  while (liveCache.size >= LIVE_CACHE_MAX) liveCache.delete(liveCache.keys().next().value);
  liveCache.set(key, { items, expiresAt: now + LIVE_CACHE_TTL });
}

function xmlText(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : '';
}

function xmlLink(block) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href || xmlText(block, 'link');
}

function feedItem(block, feed, index) {
  const title = xmlText(block, 'title');
  const sourceUrl = xmlLink(block);
  const published = xmlText(block, 'pubDate') || xmlText(block, 'published') || xmlText(block, 'updated');
  const parsedDate = published ? new Date(published) : null;
  const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null;
  const externalId = xmlText(block, 'guid') || sourceUrl || `${feed.name}:${title}:${index}`;
  const summary = conciseText(xmlText(block, 'description') || xmlText(block, 'summary')) || 'Atualização pública recuperada do feed institucional; consulte a fonte original para os detalhes.';
  return normalizeRadarItem({
    section: feed.section,
    title,
    summaryPt: summary,
    publishedAt,
    sourceName: feed.name,
    sourceUrl,
    contentType: 'notícia institucional',
    topics: ['EPT'],
    geography: feed.geography,
    official: feed.official,
    provider: 'rss',
    externalId,
    provenance: { feedUrl: feed.url, fetchedAt: new Date().toISOString() },
  });
}

export async function fetchFeedItems(feed, { limit = 10 } = {}) {
  const cacheKey = `feed:${feed.url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const response = await fetch(feed.url, { headers: { Accept: 'application/rss+xml, application/atom+xml, text/xml', 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`feed_${response.status}`);
  const xml = await response.text();
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((match) => match[0]);
  const items = blocks.map((block, index) => feedItem(block, feed, index))
    .filter((item) => item.title && item.sourceUrl && item.isNews && semanticEvidence(item.title, item.summaryPt).eligible)
    .slice(0, limit);
  cacheSet(cacheKey, items);
  return items;
}

function openAlexItem(work) {
  const doi = work?.doi || work?.primary_location?.landing_page_url || work?.id;
  const authorNames = (work?.authorships || []).slice(0, 8).map((author) => author.author?.display_name).filter(Boolean);
  const topicNames = (work?.topics || []).slice(0, 3).map((topic) => topic.display_name).filter(Boolean);
  const title = htmlText(work?.display_name || work?.title);
  const abstractText = reconstructOpenAlexAbstract(work?.abstract_inverted_index);
  const summary = buildSummaryMetadata({
    id: work?.id || doi,
    title,
    sourceText: abstractText,
    summary: buildEvidenceFallback(abstractText),
    status: abstractText ? 'extractive' : 'unavailable',
    source: 'OpenAlex',
    provider: 'openalex',
  });
  const authorsLabel = authorNames.length ? ` de ${authorNames.slice(0, 3).join(', ')}` : '';
  const topicsLabel = topicNames.length ? ` Temas indexados: ${topicNames.join('; ')}.` : '';
  return normalizeRadarItem({
    id: work?.id,
    externalId: work?.id || doi,
    section: 'research',
    title,
    summaryPt: `Pesquisa${authorsLabel}, publicada em ${work?.publication_date || 'data não informada'}.${topicsLabel} Consulte o DOI e a fonte original para avaliar método e resultados.`,
    ...summary,
    abstractText,
    originalTitle: work?.display_name || work?.title,
    publishedAt: work?.publication_date,
    sourceName: 'OpenAlex',
    sourceUrl: work?.doi || work?.primary_location?.landing_page_url || work?.id,
    contentType: work?.type || 'trabalho acadêmico',
    topics: ['EPT', ...(work?.topics || []).slice(0, 2).map((topic) => topic.display_name)],
    geography: work?.authorships?.[0]?.institutions?.[0]?.country_code || 'Internacional',
    official: false,
    provider: 'openalex',
    authors: authorNames,
    doi,
  });
}

export async function fetchOpenAlexItems({ query = '"vocational education and training"', limit = 12 } = {}) {
  const cacheKey = `${query}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(Math.max(limit * 4, 20), 100)),
    sort: 'publication_date:desc',
    filter: `from_publication_date:${since.toISOString().slice(0, 10)},to_publication_date:${today}`,
    select: 'id,doi,title,display_name,publication_date,type,relevance_score,primary_location,authorships,topics,abstract_inverted_index,language',
  });
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  const headers = process.env.OPENALEX_MAILTO ? { 'User-Agent': `senai-parceiros/1.0 (mailto:${process.env.OPENALEX_MAILTO})` } : undefined;
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(`https://api.openalex.org/works?${params}`, { headers, signal: AbortSignal.timeout(8000) });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 3) throw new Error(`openalex_${response.status}`);
    if (process.env.NODE_ENV !== 'test') {
      const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(2500, Math.max(400, retryAfter || attempt * 600))));
    }
  }
  const body = await response.json();
  const items = (body.results || [])
    .filter(hasVocationalResearchSignal)
    .map(openAlexItem)
    .filter((item) => item.isNews)
    .slice(0, limit);
  cacheSet(cacheKey, items);
  return items;
}

function researcherNameMatches(authors, name) {
  const expected = String(name || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return expected.length > 0 && (authors || []).some((author) => {
    const actual = String(author || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return expected.every((token) => actual.includes(token));
  });
}

export async function fetchTrackedResearcherItems({ limitResearchers, previousCoverage = null } = {}) {
  const catalog = await getTrackedResearcherCatalog();
  const selected = Number(limitResearchers) > 0 ? catalog.slice(0, Number(limitResearchers)) : catalog;
  const result = await collectTrackedResearcherStudies({
    catalog: selected,
    knownResolutions: previousCoverage?.resolvedAuthorMap || [],
    resolutionCursor: previousCoverage?.resolutionCursor || 0,
    worksCursor: previousCoverage?.worksCursor || '*',
    worksCursorAuthorIds: previousCoverage?.worksCursorAuthorIds || [],
  });
  Object.defineProperty(result.items, 'coverage', { value: result.coverage, enumerable: false });
  Object.defineProperty(result.items, 'errors', { value: result.errors, enumerable: false });
  return result.items;
}

export async function getTrackedResearcherCatalog() {
  await hydrateCatalogStore({ force: true });
  return getCatalog('person').filter((person) => person.scholar || person.orcid || person.openalex_id
    || (person.perfis_atuacao || []).some((profile) => String(profile).trim().toLowerCase() === 'pesquisa'));
}

export async function fetchCrossrefItems({ query = 'vocational education training', limit = 12 } = {}) {
  const cacheKey = `crossref:${query}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({ query: query.replace(/\s+/g, ' '), rows: String(Math.min(Math.max(limit, 1), 25)), sort: 'published', order: 'desc', filter: `from-pub-date:${since.toISOString().slice(0, 10)},until-pub-date:${today}`, 'select': 'DOI,title,URL,published,author,type,container-title,publisher,abstract' });
  if (process.env.OPENALEX_MAILTO) params.set('mailto', process.env.OPENALEX_MAILTO);
  const headers = process.env.OPENALEX_MAILTO ? { 'User-Agent': `senai-parceiros/1.0 (mailto:${process.env.OPENALEX_MAILTO})` } : undefined;
  const response = await fetch(`https://api.crossref.org/works?${params}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`crossref_${response.status}`);
  const body = await response.json();
  const items = (body.message?.items || []).map((work) => {
    const dateParts = work.published?.['date-parts']?.[0] || [];
    const publishedAt = dateParts.length >= 3
      ? `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`
      : dateParts.length === 1 ? `${dateParts[0]}-01-01` : undefined;
    const abstractText = extractCrossrefAbstract(work);
    const summary = buildSummaryMetadata({
      id: work.DOI,
      title: work.title?.[0],
      sourceText: abstractText,
      summary: buildEvidenceFallback(abstractText),
      status: abstractText ? 'extractive' : 'unavailable',
      source: 'Crossref',
      provider: 'crossref',
    });
    return normalizeRadarItem({
      ...summary,
      abstractText,
      id: work.DOI,
      externalId: work.DOI,
      doi: `https://doi.org/${work.DOI}`,
      section: 'research',
      title: work.title?.[0],
      originalTitle: work.title?.[0],
      summaryPt: 'Metadados DOI recuperados automaticamente do Crossref. A pertinência temática deve ser confirmada pelo leitor na fonte original.',
      publishedAt,
      sourceName: 'Crossref',
      sourceUrl: work.URL || `https://doi.org/${work.DOI}`,
      contentType: work.type || 'trabalho acadêmico',
      topics: ['EPT', 'pesquisa acadêmica'],
      geography: 'Internacional',
      official: false,
      provider: 'crossref',
      authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    });
  });
  const relevant = items.filter((item) => item.isNews && semanticEvidence(item.title).eligible);
  cacheSet(cacheKey, relevant);
  return relevant;
}

export async function fetchOecdItems({ limit = 100, maxPages = 10, previousCoverage = null } = {}) {
  const initialCursor = previousCoverage?.cursor || '*';
  const cacheKey = `oecd:${limit}:${maxPages}:${previousCoverage?.complete ? 'refresh' : initialCursor}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const today = new Date().toISOString().slice(0, 10);
  const works = [];
  let cursor = initialCursor;
  let pagesRead = 0;
  let totalResults = null;
  while (cursor && pagesRead < maxPages) {
    const params = new URLSearchParams({
      'query.bibliographic': 'vocational education training skills apprenticeship',
      'query.publisher-name': 'OECD',
      rows: String(Math.min(Math.max(limit, 1), 100)),
      cursor,
      sort: 'published',
      order: 'desc',
      filter: `from-pub-date:${since.toISOString().slice(0, 10)},until-pub-date:${today}`,
      select: 'DOI,title,URL,published,author,type,publisher,container-title,abstract',
    });
    let response;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      response = await fetch(`https://api.crossref.org/works?${params}`, { headers: { 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' }, signal: AbortSignal.timeout(15000) });
      if (response.ok) break;
      if (response.status !== 429 || attempt === 3) throw new Error(`oecd_metadata_${response.status}`);
      if (process.env.NODE_ENV !== 'test') {
        const retryAfter = Number(response.headers.get('retry-after') || 0) * 1000;
        await new Promise((resolve) => setTimeout(resolve, Math.min(2500, Math.max(500, retryAfter || attempt * 700))));
      }
    }
    const body = await response.json();
    const pageWorks = body.message?.items || [];
    works.push(...pageWorks);
    pagesRead += 1;
    totalResults = Number(body.message?.['total-results'] ?? totalResults);
    cursor = body.message?.['next-cursor'] || null;
    if (!pageWorks.length || pageWorks.length < Math.min(Math.max(limit, 1), 100)) cursor = null;
  }
  const items = works.map((work) => {
    const dateParts = work.published?.['date-parts']?.[0] || [];
    const publishedAt = dateParts.length >= 3
      ? `${dateParts[0]}-${String(dateParts[1]).padStart(2, '0')}-${String(dateParts[2]).padStart(2, '0')}`
      : dateParts.length === 1 ? `${dateParts[0]}-01-01` : undefined;
    return normalizeRadarItem({
      id: work.DOI,
      externalId: work.DOI,
      doi: work.DOI ? `https://doi.org/${work.DOI}` : undefined,
      section: 'international',
      title: work.title?.[0],
      originalTitle: work.title?.[0],
      summaryPt: `Publicação recente da OCDE sobre educação profissional, competências ou aprendizagem. Consulte a fonte original para resumo executivo, método e recomendações.`,
      publishedAt,
      sourceName: 'OCDE',
      sourceUrl: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : undefined),
      contentType: work.type || 'publicação internacional',
      topics: ['EPT', 'competências', 'políticas públicas'],
      geography: 'Internacional',
      official: true,
      provider: 'crossref-oecd',
      abstractText: extractCrossrefAbstract(work),
      ...buildSummaryMetadata({
        id: work.DOI,
        title: work.title?.[0],
        sourceText: extractCrossrefAbstract(work),
        summary: buildEvidenceFallback(extractCrossrefAbstract(work)),
        status: extractCrossrefAbstract(work) ? 'extractive' : 'unavailable',
        source: 'OCDE',
        provider: 'crossref-oecd',
      }),
      authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    });
  }).filter((item) => item.isNews && semanticEvidence(item.title).eligible);
  const complete = !cursor || (Number.isFinite(totalResults) && works.length >= totalResults);
  Object.defineProperty(items, 'coverage', { value: {
    windowStart: since.toISOString().slice(0, 10),
    windowEnd: today,
    pagesRead,
    retrieved: works.length,
    totalResults: Number.isFinite(totalResults) ? totalResults : null,
    cursor: complete ? null : cursor,
    complete,
    reason: complete ? 'source_exhausted' : 'page_cap',
  }, enumerable: false });
  cacheSet(cacheKey, items);
  return items;
}

function douDateWindow(previousCoverage = null) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  const chunkDays = Math.max(1, Math.min(14, Number(process.env.RADAR_DOU_LOOKBACK_DAYS || 7)));
  const target = new Date(now);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  if (previousCoverage?.activeWindowStart && previousCoverage?.activeWindowEnd && previousCoverage?.reason === 'candidate_cap') {
    return { startDate: previousCoverage.activeWindowStart, endDate: previousCoverage.activeWindowEnd, targetDate: target.toISOString().slice(0, 10), candidateOffset: Number(previousCoverage.candidateOffset || 0) };
  }
  if (previousCoverage?.oldestCovered && !previousCoverage.complete) {
    end.setTime(new Date(`${previousCoverage.oldestCovered}T00:00:00Z`).getTime());
    end.setUTCDate(end.getUTCDate() - 1);
  }
  start.setTime(end.getTime());
  start.setUTCDate(start.getUTCDate() - (chunkDays - 1));
  if (start < target) start.setTime(target.getTime());
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), targetDate: target.toISOString().slice(0, 10), candidateOffset: 0 };
}

const DOU_DISCOVERY_CEILING = 4000;
const DOU_ELIGIBILITY_VERSION = 5;

/**
 * Cheap pre-filter over a discovered act, before any request is spent on its
 * body. The listing exposes the act's title and issuing body, which is enough
 * to discard the overwhelming majority that concern neither education nor
 * work. Deliberately broader than `douRelevance`, which decides eligibility on
 * the full text: this only decides what is worth reading.
 */
function douCandidateSignal(candidate) {
  if (/\b(?:extrato de (?:contrato|apostilamento|termo aditivo)|aviso de (?:licitacao|pregao|registro de diplomas)|resultado de julgamento|dispensa de licitacao|inexigibilidade de licitacao|termo de homologacao)\b/i.test(String(candidate?.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return false;
  const haystack = `${candidate?.title || ''} ${candidate?.summaryPt || ''}`
    .toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [
    'educacao', 'ensino', 'escola', 'aprendizagem', 'aprendiz', 'formacao',
    'qualificacao', 'capacitacao', 'competencia', 'curso', 'tecnico', 'tecnologic',
    'profissionaliz', 'trabalho e emprego', 'setec', 'senai', 'senac', 'sesi',
    'rede federal', 'instituto federal', 'cefet', 'mec', 'inep', 'sistema s',
  ].some((term) => haystack.includes(term));
}

function countWholeTerms(haystack, terms) {
  return terms.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\W)${escaped}(?:\\W|$)`).test(haystack);
  }).length;
}

const DOU_STRONG_TERMS = ['educacao profissional', 'educacao profissional e tecnologica', 'educacao tecnica', 'formacao profissional', 'formacao tecnica e profissional', 'qualificacao profissional', 'aprendizagem profissional', 'ensino tecnico', 'curso tecnico', 'cursos tecnicos', 'itinerario de formacao tecnica profissional'];
const DOU_SUBSTANTIVE_TERMS = ['institui', 'estabelece', 'regulamenta', 'autoriza', 'cria', 'dispoe', 'aprova', 'altera', 'define', 'proporciona', 'promove', 'amplia', 'programa', 'politica', 'oferta', 'curso', 'vagas', 'curricul', 'diretriz', 'certific', 'financiamento', 'bolsa', 'edital', 'chamada publica', 'cooperacao'];
const DOU_INSTITUTIONAL_BOILERPLATE = /\b(?:secretaria|diretoria|subsecretaria|departamento|coordenacao)(?: nacional| especial)? (?:de|da) educacao profissional e tecnologica\b/g;

function foldDouText(value) {
  return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stripDouInstitutionalBoilerplate(value) {
  return foldDouText(value).replace(DOU_INSTITUTIONAL_BOILERPLATE, ' ');
}

export function douRelevance(title, content = '') {
  const titleHaystack = stripDouInstitutionalBoilerplate(title);
  const foldedContent = stripDouInstitutionalBoilerplate(content);
  const haystack = `${titleHaystack} ${foldedContent}`;
  const strongDirect = countWholeTerms(haystack, DOU_STRONG_TERMS);
  const titleStrongDirect = countWholeTerms(titleHaystack, DOU_STRONG_TERMS);
  const institutional = countWholeTerms(haystack, ['setec', 'rede federal']);
  const direct = strongDirect + institutional;
  const strategic = ['industria', 'industrial', 'competencias', 'trabalho', 'inovacao', 'tecnologia', 'economia circular', 'descarbonizacao', 'sao paulo'].filter((term) => haystack.includes(term)).length;
  const substantive = DOU_SUBSTANTIVE_TERMS.filter((term) => haystack.includes(term)).length;
  const evidenceClauses = foldedContent.split(/[.!?;\n]+/).map((clause) => clause.trim()).filter(Boolean);
  const coupledEvidence = evidenceClauses.some((clause) => countWholeTerms(clause, DOU_STRONG_TERMS) > 0
    && DOU_SUBSTANTIVE_TERMS.some((term) => clause.includes(term)));
  const administrativeNoise = /\b(?:extrato de (?:contrato|apostilamento|termo aditivo)|aviso de (?:licitacao|pregao|registro de diplomas)|resultado de julgamento|dispensa de licitacao|inexigibilidade de licitacao|termo de homologacao)\b/.test(haystack);
  // Eligibility now requires an explicit vocational-education term. The former
  // strategic-only path matched words like "trabalho" and "tecnologia" that
  // appear in any page's navigation and footer, which is how an act on dialysis
  // habilitation qualified as vocational education news.
  // Issuing-body boilerplate is not news by itself: procurement extracts and
  // diploma notices from SETEC/IFs must not qualify merely because the body's
  // legal name contains "educaÃ§Ã£o profissional".
  return { direct, strategic, substantive, administrativeNoise: administrativeNoise ? 1 : 0, eligible: !administrativeNoise && strongDirect > 0 && (titleStrongDirect > 0 || coupledEvidence) };
}

function douThemeEvidence(content, title = '') {
  const clean = htmlText(content || title);
  const sentences = clean.match(/[^.!?;]+[.!?;]?/g)?.map((value) => value.trim()).filter(Boolean) || [];
  const evidenceIndex = sentences.findIndex((sentence) => {
    const folded = stripDouInstitutionalBoilerplate(sentence);
    return countWholeTerms(folded, DOU_STRONG_TERMS) > 0
      && DOU_SUBSTANTIVE_TERMS.some((term) => folded.includes(term));
  });
  const titleIsEvidence = countWholeTerms(stripDouInstitutionalBoilerplate(title), DOU_STRONG_TERMS) > 0;
  return evidenceIndex >= 0
    ? [sentences[evidenceIndex], sentences[evidenceIndex + 1]].filter(Boolean).join(' ')
    : titleIsEvidence ? title : clean;
}

function douThemeSummary(content, title = '') {
  const excerpt = douThemeEvidence(content, title);
  return `Relação com educação profissional: ${conciseText(excerpt, 520)}`;
}

/**
 * Gives the editorial pass enough of the act to explain it, not merely prove
 * that it matched the Radar's theme. The relevant clause comes first so it is
 * never cut off by long legal preambles; nearby clauses then supply audience,
 * scope and practical conditions when the act actually states them.
 */
function douEditorialContext(content, title = '') {
  const clean = htmlText(content || title);
  const sentences = clean.match(/[^.!?;]+[.!?;]?/g)?.map((value) => value.trim()).filter(Boolean) || [];
  const evidenceIndex = sentences.findIndex((sentence) => {
    const folded = stripDouInstitutionalBoilerplate(sentence);
    return countWholeTerms(folded, DOU_STRONG_TERMS) > 0
      && DOU_SUBSTANTIVE_TERMS.some((term) => folded.includes(term));
  });
  const selected = [
    title ? `Título oficial: ${title}.` : '',
    evidenceIndex >= 0 ? sentences[evidenceIndex] : douThemeEvidence(clean, title),
    evidenceIndex >= 0 ? sentences[evidenceIndex + 1] : '',
    evidenceIndex > 0 && sentences[evidenceIndex - 1]?.length <= 420 ? sentences[evidenceIndex - 1] : '',
    evidenceIndex >= 0 ? sentences[evidenceIndex + 2] : '',
    sentences[0]?.length <= 420 ? sentences[0] : '',
  ].filter(Boolean);
  return conciseText([...new Set(selected)].join(' '), 1800);
}

function douItemFromDocument(document, candidate = {}) {
  const content = String(document?.content || document?.summaryPt || candidate?.summaryPt || '').trim();
  // The listing payload carries the act's own title; the fetched page's <title>
  // is the newspaper's, which is how an act reached the radar called
  // "Imprensa Nacional".
  const originalTitle = String(candidate?.title || document?.title || 'Ato oficial do Diário Oficial da União').trim();
  const relevance = douRelevance(originalTitle, content);
  if (!relevance.eligible) return null;
  const sourceUrl = document?.sourceUrl || candidate?.sourceUrl;
  const externalId = document?.externalId || candidate?.externalId || `dou:${sourceUrl}`;
  const sourceText = content || originalTitle;
  const evidence = douThemeEvidence(sourceText, originalTitle);
  const summary = douThemeSummary(sourceText, originalTitle);
  const title = semanticEvidence(originalTitle).eligible
    ? originalTitle
    : `${originalTitle} — ${conciseText(evidence, 180)}`;
  return normalizeRadarItem({
    id: externalId,
    externalId,
    section: 'government',
    title,
    // The act's own title, without the evidence excerpt appended above, is what
    // the card cites for traceability once an editorial headline replaces it.
    originalTitle,
    summaryPt: summary,
    sourceContext: douEditorialContext(sourceText, originalTitle),
    publishedAt: document?.publishedAt || candidate?.publishedAt,
    sourceName: 'Diário Oficial da União',
    sourceUrl,
    contentType: document?.contentType || candidate?.contentType || 'ato oficial',
    topics: ['EPT', ...(relevance.strategic ? ['indústria e trabalho'] : [])],
    geography: 'Brasil',
    official: true,
    provider: document?.provider || candidate?.provider || 'direct-official',
    // The decision is recorded with the item because it was taken over the full
    // act, while only an 80-word excerpt is stored. Re-deciding later from the
    // excerpt would reject acts that legitimately qualified.
    provenance: { ...(candidate?.provenance || {}), ...(document?.provenance || {}), originalTitle, evidenceLength: sourceText.length, eligibility: { version: DOU_ELIGIBILITY_VERSION, eligible: relevance.eligible ? 1 : 0, direct: relevance.direct, strategic: relevance.strategic, substantive: relevance.substantive, administrativeNoise: relevance.administrativeNoise } },
  });
}

export async function fetchDouItems({ limit = 40, previousCoverage = null } = {}) {
  if (process.env.RADAR_DOU_ENABLED === 'false') return { items: [], status: 'disabled', provider: 'disabled', errors: [] };
  const { startDate, endDate, targetDate, candidateOffset } = douDateWindow(previousCoverage);
  const direct = new DirectOfficialWebProvider({
    sections: String(process.env.RADAR_DOU_SECTIONS || 'DO1,DO3').split(',').map((value) => value.trim()).filter(Boolean),
    maxDays: Math.max(1, Number(process.env.RADAR_DOU_LOOKBACK_DAYS || 7)),
    maxDocuments: limit,
    timeoutMs: Math.max(2000, Number(process.env.RADAR_DOU_TIMEOUT_MS || 8000)),
  });
  // Parsing costs nothing beyond the edition already downloaded, so discovery
  // keeps the whole listing and the narrowing happens below, on signal rather
  // than on arrival order.
  const directDiscovery = await direct.discover({ query: 'EPT formação profissional indústria competências', domains: ['in.gov.br'], startDate, endDate, maxResults: DOU_DISCOVERY_CEILING, candidateFilter: douCandidateSignal });
  let candidates = directDiscovery.items || [];
  let provider = directDiscovery.provider;
  let discoveryErrors = directDiscovery.errors || [];
  if (!candidates.length && String(process.env.RADAR_EXTRACT_PROVIDER || 'tavily').toLowerCase() === 'tavily' && process.env.TAVILY_API_KEY) {
    const tavily = new TavilyWebProvider();
    const discovered = await tavily.discover({
      query: `site:in.gov.br educação profissional formação técnica competências indústria Diário Oficial ${startDate}`,
      domains: ['in.gov.br'], startDate, endDate, maxResults: limit,
    });
    candidates = discovered.items || [];
    provider = discovered.provider;
    discoveryErrors = [...discoveryErrors, ...(discovered.errors || [])];
  }
  // An edition carries thousands of acts and only a handful concern vocational
  // education. Taking the first twenty as they happened to be listed spent every
  // request on unrelated acts; the title and the issuing body are enough to tell
  // which ones deserve one.
  const shortlisted = candidates.filter((candidate) => douCandidateSignal(candidate));
  const ranked = (shortlisted.length ? shortlisted : candidates).sort((left, right) => {
    const score = (candidate) => {
      const value = `${candidate?.title || ''} ${candidate?.summaryPt || ''}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return ['educacao profissional', 'educacao tecnica', 'ensino tecnico', 'formacao profissional', 'qualificacao profissional', 'aprendizagem profissional', 'setec', 'rede federal', 'instituto federal', 'senai', 'senac']
        .filter((term) => value.includes(term)).length;
    };
    return score(right) - score(left) || String(right.publishedAt || '').localeCompare(String(left.publishedAt || ''));
  });
  const selected = ranked.slice(candidateOffset, candidateOffset + limit);
  const urls = selected.map((candidate) => candidate.sourceUrl).filter(Boolean).slice(0, limit);
  const directDocuments = urls.length ? await direct.retrieve({ urls }) : { documents: [], errors: [], status: directDiscovery.status };
  let documents = directDocuments.documents || [];
  let extractionProvider = directDocuments.provider || provider;
  // Retrieval errors used to be discarded here, so a run that discovered acts
  // and then failed to read a single one reported only the discovery timeouts.
  discoveryErrors = [...discoveryErrors, ...(directDocuments.errors || [])];
  const missingUrls = urls.filter((url) => !documents.some((document) => document.sourceUrl === url));
  if (missingUrls.length && process.env.TAVILY_API_KEY && String(process.env.RADAR_EXTRACT_PROVIDER || 'tavily').toLowerCase() === 'tavily') {
    const tavily = new TavilyWebProvider();
    const extracted = await tavily.retrieve({ urls: missingUrls, focus: 'educação profissional, competências e indústria paulista' });
    documents = [...documents, ...(extracted.documents || [])];
    extractionProvider = extracted.provider;
    discoveryErrors = [...discoveryErrors, ...(extracted.errors || [])];
  }
  const byUrl = new Map(documents.map((document) => [document.sourceUrl, document]));
  const items = selected.map((candidate) => douItemFromDocument(byUrl.get(candidate.sourceUrl), candidate)).filter(Boolean).slice(0, limit);
  const diagnostics = {
    ...(directDiscovery.diagnostics || {}),
    candidates: Number(directDiscovery.diagnostics?.anchorItems || 0) + Number(directDiscovery.diagnostics?.embeddedItems || 0),
    shortlisted: shortlisted.length,
    retrieved: documents.length,
    eligible: items.length,
  };
  const candidateOffsetNext = candidateOffset + selected.length;
  const windowComplete = candidateOffsetNext >= ranked.length;
  const parseableWindow = Number(directDiscovery.diagnostics?.embeddedItems || 0) > 0;
  const successfulWindow = windowComplete && discoveryErrors.length === 0 && parseableWindow;
  const oldestCovered = successfulWindow
    ? [previousCoverage?.oldestCovered, startDate].filter(Boolean).sort()[0]
    : previousCoverage?.oldestCovered || null;
  const complete = successfulWindow && oldestCovered <= targetDate;
  const coverage = {
    windowStart: targetDate,
    windowEnd: new Date().toISOString().slice(0, 10),
    activeWindowStart: startDate,
    activeWindowEnd: endDate,
    oldestCovered,
    candidateOffset: windowComplete ? 0 : candidateOffsetNext,
    complete,
    reason: discoveryErrors.length ? 'source_partial' : !parseableWindow ? 'unparseable_window' : !windowComplete ? 'candidate_cap' : complete ? 'window_boundary' : 'backfill_pending',
  };
  return { items, status: items.length ? 'ok' : (directDiscovery.status || 'no_edition'), provider: extractionProvider || provider, errors: discoveryErrors, diagnostics, coverage, window: { startDate, endDate } };
}

function providerStatus(name, status, extra = {}) {
  return { name, status, ...extra };
}

/**
 * Store I/O must never abort a collection run.  A throw here used to escape as
 * an opaque `radar_refresh_failed` with no source and no cause attached, which
 * is indistinguishable from every collector failing at once.
 */
/**
 * Um run que nao conseguiu tratar todos os itens nao pode virar snapshot: o
 * leitor veria texto cru da fonte sem nenhum sinal disso. A falha e registrada
 * como run falho — para aparecer no status operacional — e sobe para o
 * chamador, que responde erro em vez de conteudo degradado.
 */
async function failRun({ reason, sourceStatus, fetchedAt, persist }) {
  if (persist) {
    radarStore.recordRun({ status: 'failed', fetchedAt, itemCount: 0, sourceStatus, durationMs: null });
    await safeStoreCall(() => radarStore.flush());
  }
  const error = new Error(reason);
  error.sourceStatus = sourceStatus;
  error.fetchedAt = fetchedAt;
  throw error;
}

async function safeStoreCall(operation) {
  try {
    await operation();
    return null;
  } catch (error) {
    return String(error?.message || 'store_unavailable').slice(0, 160);
  }
}

/**
 * Re-applies the current rules to an item already in the snapshot.
 *
 * The snapshot carries items forward across runs, so anything admitted under a
 * rule that later proved wrong stayed visible forever: correcting a filter
 * stopped new mistakes but never removed the ones already stored.
 */
function storedItemStillQualifies(item) {
  if (item?.provider === 'direct-official') {
    // Only decisions made over structurally isolated act text are durable. The
    // previous version evaluated grouped acts and annex tables, so trusting it
    // would preserve the false positives that this migration is meant to clear.
    const recorded = item?.provenance?.eligibility;
    if (Number(recorded?.version) >= DOU_ELIGIBILITY_VERSION && Number.isFinite(Number(recorded.eligible))) return Number(recorded.eligible) > 0;
    // The stored excerpt cannot reconstruct which act or annex supplied the
    // match. Drop legacy decisions instead of re-approving contaminated text.
    return false;
  }
  if (item?.provider === 'institutional-paginated') {
    const recorded = item?.provenance?.eligibility;
    return Number(recorded?.version) >= 2 && Number(recorded?.eligible) > 0;
  }
  if (item?.provider === 'institutional-web') return false;
  return true;
}

/**
 * Wall-clock budget for a whole collection run, kept below the platform's
 * function limit so the snapshot write is always reached.
 *
 * Collection alone measured 51s in production against a 60s limit, which left
 * the editorial pass no room at all: without a shared budget it would start a
 * batch it could not finish and take the entire run down with it.
 */
const DEFAULT_RUN_BUDGET_MS = 55_000;

function runBudgetMs() {
  return Math.max(5_000, Number(process.env.RADAR_RUN_BUDGET_MS || DEFAULT_RUN_BUDGET_MS));
}

export async function getRadarItems({ filters = {}, live = false, persist = true, includeAi = true } = {}) {
  const runStartedAt = Date.now();
  // A warm serverless reader can outlive the instance that writes a new Blob
  // snapshot. Always reload the durable snapshot so GETs do not serve the
  // document first hydrated by this process for the rest of its lifetime.
  const hydrateError = await safeStoreCall(() => radarStore.hydrate({ force: true }));
  const feedPolicy = getRadarFeedPolicy();
  const allowedSources = new Set(RADAR_SOURCE_POLICY.map((entry) => entry.name));
  const isAllowedItem = (item) => allowedSources.has(item.sourceName)
    || feedPolicy.some((feed) => feed.name === item.sourceName)
    || /^curated-/.test(item.provider);
  const stored = radarStore.getSnapshot();
  let items = (stored?.items || seedItems).map(normalizeRadarItem).filter(isAllowedItem).filter(storedItemStillQualifies);
  let liveProvider = false;
  let currentItems = [];
  const sourceStatus = { ...(stored?.sourceStatus || {}) };
  const collectResearch = live && (!filters.section || filters.section === 'research');
  const collectInternational = live && (!filters.section || filters.section === 'international');
  const collectGovernment = live && (!filters.section || filters.section === 'government');
  const researchPromise = collectResearch
    ? (async () => {
      // The general query and identity resolver share the same OpenAlex quota.
      // Starting both at once caused the general feed to return 429 on every
      // integrated run even though each collector succeeded in isolation.
      const [openAlexItems, crossrefItems] = await Promise.allSettled([
        fetchOpenAlexItems({ query: filters.query || '"vocational education and training"' }),
        fetchCrossrefItems({ query: filters.query || '"vocational education and training"' }),
      ]);
      const [trackedItems] = await Promise.allSettled([
        fetchTrackedResearcherItems({ previousCoverage: stored?.sourceStatus?.['Pesquisadores cadastrados']?.coverage || null }),
      ]);
      return [openAlexItems, crossrefItems, trackedItems];
    })()
    : null;
  const oecdPromise = collectInternational ? Promise.allSettled([fetchOecdItems({ previousCoverage: stored?.sourceStatus?.OCDE?.coverage || null })]) : null;
  const douPromise = collectGovernment
    ? Promise.allSettled([fetchDouItems({ limit: 40, previousCoverage: stored?.sourceStatus?.DOU?.coverage || null })])
    : null;
  const feeds = live ? feedPolicy.filter((feed) => !filters.section || feed.section === filters.section) : [];
  const feedResultsPromise = live ? Promise.allSettled(feeds.map((feed) => fetchFeedItems(feed))) : null;
  const webSources = live ? RADAR_WEB_POLICY.filter((source) => !filters.section || source.section === filters.section) : [];
  const webResultsPromise = live ? Promise.allSettled(webSources.map((source) => fetchWebItems(source, {
    previousCoverage: stored?.sourceStatus?.[`${source.name} (web)`]?.coverage || null,
  }))) : null;
  if (live && (!filters.section || filters.section === 'research')) {
    const [openAlexItems, crossrefItems, trackedItems] = await researchPromise;
    sourceStatus.OpenAlex = openAlexItems.status === 'fulfilled'
      ? providerStatus('OpenAlex', 'ok', { count: openAlexItems.value.length })
      : providerStatus('OpenAlex', 'error', { error: String(openAlexItems.reason?.message || 'source_unavailable').slice(0, 160) });
    sourceStatus.Crossref = crossrefItems.status === 'fulfilled'
      ? providerStatus('Crossref', 'ok', { count: crossrefItems.value.length })
      : providerStatus('Crossref', 'error', { error: String(crossrefItems.reason?.message || 'source_unavailable').slice(0, 160) });
    const tracked = trackedItems.status === 'fulfilled' ? trackedItems.value : [];
    sourceStatus['Pesquisadores cadastrados'] = trackedItems.status === 'fulfilled'
      ? providerStatus('Pesquisadores cadastrados', tracked.coverage?.complete ? 'ok' : 'partial', { count: tracked.length, coverage: tracked.coverage || null, errors: tracked.errors?.slice(0, 5) || [] })
      : providerStatus('Pesquisadores cadastrados', 'error', { error: String(trackedItems.reason?.message || 'source_unavailable').slice(0, 160) });
    currentItems.push(...(openAlexItems.status === 'fulfilled' ? openAlexItems.value : []), ...(crossrefItems.status === 'fulfilled' ? crossrefItems.value : []), ...tracked);
    items = [...currentItems, ...items].filter(isAllowedItem);
    liveProvider = openAlexItems.status === 'fulfilled'
      || crossrefItems.status === 'fulfilled'
      || (trackedItems.status === 'fulfilled' && Number(tracked.coverage?.authorsResolved) > 0);
  }
  if (live && (!filters.section || filters.section === 'international')) {
    const oecdItems = await oecdPromise;
    const oecd = oecdItems[0];
    sourceStatus.OCDE = oecd.status === 'fulfilled'
      ? providerStatus('OCDE', oecd.value.coverage?.complete ? 'ok' : 'partial', { count: oecd.value.length, coverage: oecd.value.coverage || null })
      : providerStatus('OCDE', 'error', { error: String(oecd.reason?.message || 'source_unavailable').slice(0, 160) });
    if (oecd.status === 'fulfilled') currentItems.push(...oecd.value);
    items = [...(oecd.status === 'fulfilled' ? oecd.value : []), ...items].filter(isAllowedItem);
    liveProvider = liveProvider || (oecd.status === 'fulfilled' && oecd.value.length > 0);
  }
  if (live && (!filters.section || filters.section === 'government')) {
    // Every other collector is isolated with allSettled. This one was a bare
    // await, so a single throw here aborted the whole run: no source was
    // collected, no snapshot was written and `sourceStatus` came back empty,
    // leaving the failure with nothing to point at.
    const [douResult] = await douPromise;
    const dou = douResult.status === 'fulfilled' ? douResult.value : {
      items: [],
      status: 'error',
      provider: 'direct',
      errors: [String(douResult.reason?.message || 'dou_unavailable').slice(0, 160)],
    };
    sourceStatus.DOU = providerStatus('Diário Oficial da União', dou.status, {
      count: dou.items.length,
      provider: dou.provider,
      window: dou.window,
      diagnostics: dou.diagnostics || null,
      coverage: dou.coverage || null,
      errors: dou.errors?.slice(0, 5) || [],
    });
    currentItems.push(...dou.items);
    items = [...dou.items, ...items].filter(isAllowedItem);
    // A reachable edition with zero eligible acts is still a successful run.
    liveProvider = liveProvider || ['ok', 'no_edition'].includes(dou.status);
  }
  if (live) {
    const feedResults = await feedResultsPromise;
    const feedItems = [];
    feedResults.forEach((result, index) => {
      const feed = feeds[index];
      sourceStatus[feed.name] = result.status === 'fulfilled'
        ? providerStatus(feed.name, 'ok', { count: result.value.length, url: feed.url })
        : providerStatus(feed.name, 'error', { error: String(result.reason?.message || 'source_unavailable').slice(0, 160), url: feed.url });
      if (result.status === 'fulfilled') feedItems.push(...result.value);
    });
    currentItems.push(...feedItems);
    items = [...feedItems, ...items].filter(isAllowedItem);
    liveProvider = liveProvider || feedItems.length > 0;

    const webResults = await webResultsPromise;
    const webItems = [];
    webResults.forEach((result, index) => {
      const source = webSources[index];
      sourceStatus[`${source.name} (web)`] = result.status === 'fulfilled'
        ? providerStatus(`${source.name} (web)`, result.value.coverage?.complete ? 'ok' : 'partial', { count: result.value.length, url: source.url, coverage: result.value.coverage || null })
        : providerStatus(`${source.name} (web)`, 'error', { error: String(result.reason?.message || 'source_unavailable').slice(0, 160), url: source.url });
      if (result.status === 'fulfilled') webItems.push(...result.value);
    });
    currentItems.push(...webItems);
    items = [...webItems, ...items].filter(isAllowedItem);
    liveProvider = liveProvider || webResults.some((result) => result.status === 'fulfilled');
  }
  const fetchedAt = liveProvider ? new Date().toISOString() : stored?.fetchedAt || new Date().toISOString();
  const mergedResearch = mergeResearchItems(items.filter((item) => item.section === 'research'));
  const shouldSummarizeResearch = includeAi && live && (!filters.section || filters.section === 'research');
  // Resumo por IA nao e enriquecimento: um item exibido com o texto da fonte e
  // indistinguivel de um item que nao precisava de resumo, entao a degradacao
  // seria invisivel. A falha e registrada e derruba o run.
  const [summaryResult] = shouldSummarizeResearch
    ? await Promise.allSettled([summarizeResearchItems(mergedResearch, { previousItems: stored?.items?.filter((item) => item.section === 'research') || [] })])
    : [{ status: 'fulfilled', value: mergedResearch }];
  if (summaryResult.status === 'rejected') {
    const reason = sanitizeProviderError(summaryResult.reason, 'radar_summary_unavailable');
    sourceStatus['Resumos por IA'] = providerStatus('Resumos por IA', 'error', { error: reason });
    await failRun({ reason, sourceStatus, fetchedAt: stored?.fetchedAt || new Date().toISOString(), persist });
  }
  const summarizedResearch = summaryResult.value;
  const nonResearch = items.filter((item) => item.section !== 'research');
  // Editorial rewriting runs after the eligibility filter so that no rewrite is
  // ever spent on an item the snapshot would discard anyway.
  const collected = dedupeRadarItems([...summarizedResearch, ...nonResearch]).filter(isEligibleRadarItem);
  const [editorialResult] = includeAi && live
    ? await Promise.allSettled([editorializeRadarItems(collected, { previousItems: stored?.items || [], deadlineAt: runStartedAt + runBudgetMs() })])
    : [{ status: 'fulfilled', value: null }];
  if (editorialResult.status === 'rejected') {
    const reason = sanitizeProviderError(editorialResult.reason, 'radar_editorial_unavailable');
    sourceStatus['Títulos e resumos editoriais'] = providerStatus('Títulos e resumos editoriais', 'error', { error: reason });
    await failRun({ reason, sourceStatus, fetchedAt, persist });
  } else if (editorialResult.value) {
    // Reported even when nothing was rewritten. A model that silently ignores
    // the strict schema and a run with no candidate look identical in the
    // interface; only these counts tell them apart.
    const { stats } = editorialResult.value;
    sourceStatus['Títulos e resumos editoriais'] = providerStatus('Títulos e resumos editoriais',
      !stats.enabled ? 'disabled' : stats.failedBatches || stats.deadlineReached ? 'partial' : 'ok',
      { count: stats.rewritten, reused: stats.reused, pending: stats.pending, candidates: stats.candidates, rejected: stats.rejected, deadlineReached: stats.deadlineReached, model: stats.model || null, errors: stats.errors });
  }
  // O que este run nao alcancou (teto por run ou deadline) fica de fora do
  // snapshot: e melhor um Radar incompleto do que um item com o texto cru da
  // fonte se passando por item tratado.
  const snapshotItems = editorialResult.value
    ? editorialResult.value.items.filter((item) => !needsEditorialTreatment(item) || item.editorialStatus === 'ai')
    : collected;
  const stale = live ? !liveProvider && Boolean(stored) : Boolean(stored?.stale);
  if (hydrateError) sourceStatus['Snapshot (armazenamento)'] = providerStatus('Snapshot (armazenamento)', 'error', { error: hydrateError });
  if (persist && liveProvider) {
    radarStore.writeSnapshot({ items: snapshotItems, fetchedAt, sourceStatus, liveProvider: true, stale: false });
    radarStore.recordRun({ status: 'ok', fetchedAt, itemCount: snapshotItems.length, sourceStatus, durationMs: null });
    const flushError = await safeStoreCall(() => radarStore.flush());
    if (flushError) sourceStatus['Snapshot (armazenamento)'] = providerStatus('Snapshot (armazenamento)', 'error', { error: flushError });
  } else if (persist && live && !liveProvider) {
    radarStore.recordRun({ status: stored ? 'stale' : 'failed', fetchedAt, itemCount: snapshotItems.length, sourceStatus, durationMs: null });
    const flushError = await safeStoreCall(() => radarStore.flush());
    if (flushError) sourceStatus['Snapshot (armazenamento)'] = providerStatus('Snapshot (armazenamento)', 'error', { error: flushError });
  }
  // `liveProvider` describes this call, and reading the radar never collects, so
  // it is always false on a GET. The stored snapshot carries its own provenance:
  // without it every reader was told the content came from the curated fallback,
  // even when looking at a snapshot collected live minutes earlier.
  return { items: filterRadarItems(snapshotItems, filters), liveProvider, snapshotLive: Boolean(stored?.liveProvider), stale, fetchedAt, sourceStatus, lastRun: radarStore.getLastRun(), store: radarStore.status() };
}

export async function refreshRadarSnapshot({ filters = {}, includeAi = true } = {}) {
  const startedAt = Date.now();
  try {
    const result = await getRadarItems({ filters, live: true, persist: false, includeAi });
    const previous = radarStore.getSnapshot();
    const snapshot = { items: dedupeRadarItems(result.items), fetchedAt: result.fetchedAt, sourceStatus: result.sourceStatus, liveProvider: result.liveProvider, stale: false };
    if (result.liveProvider) radarStore.writeSnapshot(snapshot);
    const retained = result.liveProvider ? snapshot : previous;
    const sourceStatus = { ...result.sourceStatus };
    const writeError = await safeStoreCall(() => radarStore.flush());
    if (writeError) sourceStatus['Snapshot (armazenamento)'] = providerStatus('Snapshot (armazenamento)', 'error', { error: writeError });
    radarStore.recordRun({ status: result.liveProvider && !writeError ? 'ok' : 'failed', fetchedAt: result.fetchedAt, itemCount: retained?.items?.length || 0, sourceStatus, durationMs: Date.now() - startedAt, error: writeError || undefined });
    return { ...result, sourceStatus, items: retained?.items || snapshot.items, refreshed: result.liveProvider && !writeError, stale: !result.liveProvider && Boolean(previous), durationMs: Date.now() - startedAt, lastRun: radarStore.getLastRun() };
  } catch (error) {
    // The previous version called flush() from inside this catch, so a failing
    // store threw a second time and the original cause escaped as an opaque
    // error with no lastRun attached — the run became unattributable.
    const cause = String(error?.message || 'radar_refresh_failed').slice(0, 160);
    const sourceStatus = error?.sourceStatus || {};
    const lastRun = radarStore.recordRun({ status: 'failed', fetchedAt: error?.fetchedAt || new Date().toISOString(), itemCount: radarStore.getSnapshot()?.items?.length || 0, sourceStatus, error: cause, durationMs: Date.now() - startedAt });
    await safeStoreCall(() => radarStore.flush());
    return { items: radarStore.getSnapshot()?.items || [], refreshed: false, stale: Boolean(radarStore.getSnapshot()), sourceStatus, lastRun, error: cause };
  }
}

/**
 * Rewrites the stored snapshot without collecting anything.
 *
 * A full collection spends its entire budget on ten external sources before the
 * editorial pass gets a turn, so on a platform whose function limit is close to
 * the collection's own duration the rewrites never run — which is exactly what
 * production showed. Reading the snapshot costs nothing, so this path turns the
 * backlog into a job that can be run on demand, as often as needed, and whose
 * only cost is the model.
 */
export async function refreshRadarEditorials() {
  const startedAt = Date.now();
  const hydrateError = await safeStoreCall(() => radarStore.hydrate({ force: true }));
  const stored = radarStore.getSnapshot();
  if (!stored?.items?.length) {
    return { refreshed: false, error: hydrateError || 'empty_snapshot', stats: null, lastRun: radarStore.getLastRun(), store: radarStore.status() };
  }
  const { items, stats } = await editorializeRadarItems(stored.items.map(normalizeRadarItem), {
    previousItems: stored.items,
    deadlineAt: startedAt + runBudgetMs(),
  });
  const sourceStatus = {
    ...(stored.sourceStatus || {}),
    'Títulos e resumos editoriais': providerStatus('Títulos e resumos editoriais',
      !stats.enabled ? 'disabled' : stats.failedBatches || stats.deadlineReached ? 'partial' : 'ok',
      { count: stats.rewritten, reused: stats.reused, pending: stats.pending, candidates: stats.candidates, rejected: stats.rejected, deadlineReached: stats.deadlineReached, model: stats.model || null, errors: stats.errors }),
  };
  // `fetchedAt` dates the collection, not the rewrite. Advancing it here would
  // tell every reader the sources were consulted again when they were not.
  radarStore.writeSnapshot({ ...stored, items, sourceStatus });
  const writeError = await safeStoreCall(() => radarStore.flush());
  const lastRun = radarStore.recordRun({
    status: writeError ? 'failed' : 'ok',
    fetchedAt: stored.fetchedAt,
    itemCount: items.length,
    sourceStatus,
    durationMs: Date.now() - startedAt,
    error: writeError || undefined,
  });
  return {
    refreshed: !writeError,
    stats,
    // What is left tells the operator whether to run this again.
    remaining: Math.max(0, stats.pending - stats.rewritten),
    durationMs: Date.now() - startedAt,
    lastRun,
    store: radarStore.status(),
  };
}

export function getRadarStoreStatus() {
  return { ...radarStore.status(), lastRun: radarStore.getLastRun(), snapshot: radarStore.getSnapshot() ? { fetchedAt: radarStore.getSnapshot().fetchedAt, itemCount: radarStore.getSnapshot().items?.length || 0 } : null };
}
