import seedItems from '../../src/data/radar-seeds.json' with { type: 'json' };
import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import { calculateRadarRelevance, dedupeRadarItems, filterRadarItems, isEligibleRadarItem, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';
import { canonicalizeResearchers } from '../../src/domain/researcherCatalog.js';
import { radarStore } from './radarStore.js';
import { summarizeResearchItems } from './radar/researchSummaryService.js';
import { buildEvidenceFallback, buildSummaryMetadata, extractCrossrefAbstract, mergeResearchItems, reconstructOpenAlexAbstract } from './radar/summaries.js';
import { DirectOfficialWebProvider } from './radar/web/directOfficial.js';
import { TavilyWebProvider } from './radar/web/tavily.js';
export { calculateRadarRelevance, dedupeRadarItems, filterRadarItems, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';

export const RADAR_SOURCE_POLICY = [
  { name: 'OpenAlex', kind: 'research', url: 'https://openalex.org', official: false },
  { name: 'Crossref', kind: 'research', url: 'https://www.crossref.org', official: false },
  { name: 'MEC / SETEC', kind: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos', official: true },
  { name: 'CNE', kind: 'government', url: 'https://www.gov.br/mec/pt-br/cne', official: true },
  { name: 'INEP', kind: 'government', url: 'https://www.gov.br/inep/pt-br/assuntos/noticias', official: true },
  { name: 'MTE', kind: 'government', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/noticias', official: true },
  { name: 'MDIC', kind: 'government', url: 'https://www.gov.br/mdic/pt-br/assuntos/noticias', official: true },
  { name: 'ABDI', kind: 'government', url: 'https://www.abdi.com.br', official: true },
  { name: 'IPEA', kind: 'government', url: 'https://www.ipea.gov.br/portal', official: true },
  { name: 'Diário Oficial da União', kind: 'government', url: 'https://www.in.gov.br', official: true },
  { name: 'Governo do Estado de São Paulo', kind: 'government', url: 'https://www.educacao.sp.gov.br/educacao/noticias', official: true },
  { name: 'Centro Paula Souza', kind: 'government', url: 'https://www.cps.sp.gov.br', official: true },
  { name: 'CEE-SP', kind: 'government', url: 'https://www.ceesp.sp.gov.br', official: true },
  { name: 'SEADE', kind: 'government', url: 'https://www.seade.gov.br', official: true },
  { name: 'FAPESP', kind: 'government', url: 'https://fapesp.br', official: true },
  { name: 'InvestSP', kind: 'government', url: 'https://investsp.org.br', official: true },
  { name: 'OCDE', kind: 'international', url: 'https://www.oecd.org/en/topics/vocational-education-and-training-vet.html', official: true },
  { name: 'OIT', kind: 'international', url: 'https://www.ilo.org/topics-and-sectors/skills-and-lifelong-learning/skills-and-employability-branch', official: true },
  { name: 'UNESCO-UNEVOC', kind: 'international', url: 'https://www.unevoc.unesco.org/en', official: true },
  { name: 'Cedefop', kind: 'international', url: 'https://www.cedefop.europa.eu', official: true },
  { name: 'ETF', kind: 'international', url: 'https://www.etf.europa.eu', official: true },
  { name: 'Banco Mundial', kind: 'international', url: 'https://www.worldbank.org/en/topic/skillsdevelopment', official: true },
  { name: 'BID', kind: 'international', url: 'https://www.iadb.org/en/topics/education', official: true },
];

export const RADAR_FEED_POLICY = [
  { name: 'Governo do Estado de São Paulo', section: 'government', url: 'https://www.agenciasp.sp.gov.br/feed/', official: true, geography: 'São Paulo' },
  { name: 'UNESCO-UNEVOC', section: 'international', url: 'https://connect.unevoc.unesco.org/unevoc_rss.xml', official: true, geography: 'Internacional' },
];

export const RADAR_FEED_MANIFEST_VERSION = '2026-07-29.v3';

export const RADAR_WEB_POLICY = [
  { name: 'MEC / SETEC', section: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos/noticias', official: true, geography: 'Brasil' },
  { name: 'INEP', section: 'government', url: 'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/', official: true, geography: 'Brasil' },
  { name: 'FAPESP', section: 'government', url: 'https://fapesp.br/noticias', official: true, geography: 'São Paulo' },
  { name: 'Centro Paula Souza', section: 'government', url: 'https://www.cps.sp.gov.br/noticias/', official: true, geography: 'São Paulo' },
  { name: 'CEE-SP', section: 'government', url: 'https://www.ceesp.sp.gov.br', official: true, geography: 'São Paulo' },
  { name: 'SEADE', section: 'government', url: 'https://www.seade.gov.br/noticias/', official: true, geography: 'São Paulo' },
  { name: 'InvestSP', section: 'government', url: 'https://investsp.org.br', official: true, geography: 'São Paulo' },
  { name: 'OIT', section: 'international', url: 'https://www.ilo.org/topics-and-sectors/skills-and-lifelong-learning', official: true, geography: 'Internacional' },
  { name: 'Cedefop', section: 'international', url: 'https://www.cedefop.europa.eu/en/news', official: true, geography: 'Internacional' },
  { name: 'ETF', section: 'international', url: 'https://www.etf.europa.eu/en/news-and-events/news', official: true, geography: 'Internacional' },
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
    government: feeds.some((feed) => feed.section === 'government' && feed.official === true),
    international: feeds.some((feed) => feed.section === 'international' && feed.official === true),
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

function webRelevance(title, summary) {
  const haystack = `${title} ${summary}`.toLocaleLowerCase('pt-BR');
  const terms = ['educação profissional', 'educacao profissional', 'educação tecnológica', 'educacao tecnologica', 'vocational', 'technical education', 'skills', 'qualificação', 'qualification', 'aprendizagem', 'apprenticeship', 'vet', 'tvet', 'competências', 'competencias', 'formação profissional', 'formacao profissional'];
  return Math.min(100, 50 + terms.filter((term) => haystack.includes(term)).length * 9);
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
    topics: ['EPT', 'VET'],
    geography: source.geography,
    official: source.official,
    provider: 'institutional-web',
    externalId: sourceUrl || `${source.name}:${title}:${index}`,
    provenance: { pageUrl: source.url, fetchedAt: new Date().toISOString() },
  });
}

export async function fetchWebItems(source, { limit = 8 } = {}) {
  const cacheKey = `web:${source.url}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const response = await fetch(source.url, { headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`web_${response.status}`);
  const html = await response.text();
  const candidates = [];
  const seenUrls = new Set();
  const addCandidate = (candidate) => {
    const url = absoluteUrl(candidate.url, source.url);
    const title = htmlText(candidate.title);
    if (!url || !title || title.length < 18 || title.length > 260 || seenUrls.has(url)) return;
    seenUrls.add(url);
    candidates.push({ ...candidate, url });
  };
  for (const match of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = match[1];
    const link = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    addCandidate({ url: link[1], title: link[2], summary: block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1], date: block.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] || block.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1] });
  }
  if (!candidates.length) {
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const context = html.slice(Math.max(0, match.index - 350), Math.min(html.length, match.index + match[0].length + 1100));
      const date = context.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]
        || context.match(/(?:publicado|atualizado|published)[^0-9]{0,40}(\d{1,2}[/.]\d{1,2}[/.]20\d{2})/i)?.[1]
        || context.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
      const summary = context.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
      addCandidate({ url: match[1], title: match[2], summary, date });
      if (candidates.length >= limit * 3) break;
    }
  }
  const items = candidates
    .map((candidate, index) => webItem(candidate, source, index))
    // Without a date there is no recency signal to tell a headline from a
    // permanent section label, which is how a navigation entry titled "Funções e
    // Competências" reached the radar. Length is the honest discriminator here:
    // menu labels are short, headlines are not. Raising the topical bar instead
    // would reject real news that happens to use one term.
    .filter((item) => isEligibleRadarItem(item)
      && webRelevance(item.title, item.summaryPt) >= 59
      && (item.publishedAt || item.title.length >= 40))
    .sort((a, b) => b.relevanceScore - a.relevanceScore || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, limit);
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
    topics: ['EPT', 'VET'],
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
    .filter((item) => item.title && item.sourceUrl && item.isNews && webRelevance(item.title, item.summaryPt) >= 59)
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
    topics: ['EPT', 'VET', ...(work?.topics || []).slice(0, 2).map((topic) => topic.display_name)],
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
  const response = await fetch(`https://api.openalex.org/works?${params}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`openalex_${response.status}`);
  const body = await response.json();
  const items = (body.results || [])
    .filter(hasVocationalResearchSignal)
    .map(openAlexItem)
    .filter((item) => item.isNews)
    .slice(0, limit);
  cacheSet(cacheKey, items);
  return items;
}

function trackedResearcherNames(limit = 8) {
  return canonicalizeResearchers(pesquisadores).records
    .filter((record) => record.nome && (record.scholar || record.orcid || record.openalex_id))
    .slice(0, Math.max(0, Math.min(Number(limit) || 8, 12)))
    .map((record) => record.nome);
}

function researcherNameMatches(authors, name) {
  const expected = String(name || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return expected.length > 0 && (authors || []).some((author) => {
    const actual = String(author || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return expected.every((token) => actual.includes(token));
  });
}

export async function fetchTrackedResearcherItems({ limitResearchers = process.env.RADAR_TRACKED_RESEARCHER_LIMIT || 8 } = {}) {
  const names = trackedResearcherNames(limitResearchers);
  const results = await Promise.allSettled(names.map((name) => fetchOpenAlexItems({ query: `"${name}" vocational education`, limit: 4 })));
  return results.flatMap((result, index) => result.status === 'fulfilled'
    ? result.value.filter((item) => researcherNameMatches(item.authors, names[index])).map((item) => ({ ...item, provenance: { ...item.provenance, trackedResearcher: names[index] }, relevanceScore: Math.min(100, item.relevanceScore + 10) }))
    : []);
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
      topics: ['EPT', 'VET', 'pesquisa acadêmica'],
      geography: 'Internacional',
      official: false,
      provider: 'crossref',
      authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    });
  });
  const relevant = items.filter((item) => item.isNews && webRelevance(item.title, '') >= 59);
  cacheSet(cacheKey, relevant);
  return relevant;
}

export async function fetchOecdItems({ limit = 8 } = {}) {
  const cacheKey = `oecd:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    'query.bibliographic': 'vocational education training skills apprenticeship',
    'query.publisher-name': 'OECD',
    rows: String(Math.min(Math.max(limit, 1), 20)),
    sort: 'published',
    order: 'desc',
    filter: `from-pub-date:${since.toISOString().slice(0, 10)},until-pub-date:${today}`,
    select: 'DOI,title,URL,published,author,type,publisher,container-title,abstract',
  });
  const response = await fetch(`https://api.crossref.org/works?${params}`, { headers: { 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`oecd_metadata_${response.status}`);
  const body = await response.json();
  const items = (body.message?.items || []).map((work) => {
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
      topics: ['VET', 'competências', 'políticas públicas'],
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
  }).filter((item) => item.isNews && webRelevance(item.title, '') >= 59);
  cacheSet(cacheKey, items);
  return items;
}

function douDateWindow() {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  // The window was hard-capped at 7 days, so configuring a wider lookback had
  // no effect. Acts on vocational education do not appear daily, and a window
  // that short is the reason the collector reaches the official source and
  // still reports zero eligible items.
  start.setUTCDate(start.getUTCDate() - Math.max(0, Math.min(45, Number(process.env.RADAR_DOU_LOOKBACK_DAYS || 7) - 1)));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

const DOU_DISCOVERY_CEILING = 4000;

/**
 * Cheap pre-filter over a discovered act, before any request is spent on its
 * body. The listing exposes the act's title and issuing body, which is enough
 * to discard the overwhelming majority that concern neither education nor
 * work. Deliberately broader than `douRelevance`, which decides eligibility on
 * the full text: this only decides what is worth reading.
 */
function douCandidateSignal(candidate) {
  const haystack = `${candidate?.title || ''} ${candidate?.summaryPt || ''}`
    .toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [
    'educacao', 'ensino', 'escola', 'aprendizagem', 'aprendiz', 'formacao',
    'qualificacao', 'capacitacao', 'competencia', 'curso', 'tecnico', 'tecnologic',
    'profissionaliz', 'trabalho e emprego', 'setec', 'senai', 'senac', 'sesi',
    'rede federal', 'instituto federal', 'cefet', 'mec', 'inep', 'sistema s',
  ].some((term) => haystack.includes(term));
}

function douRelevance(title, content = '') {
  const haystack = `${title || ''} ${content || ''}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const direct = ['educacao profissional', 'educacao tecnica', 'formacao profissional', 'qualificacao profissional', 'aprendizagem profissional', 'ensino tecnico', 'setec', 'rede federal', 'sistema s', 'senai', 'senac'].filter((term) => haystack.includes(term)).length;
  const strategic = ['industria', 'industrial', 'competencias', 'trabalho', 'inovacao', 'tecnologia', 'economia circular', 'descarbonizacao', 'sao paulo'].filter((term) => haystack.includes(term)).length;
  // Eligibility now requires an explicit vocational-education term. The former
  // strategic-only path matched words like "trabalho" and "tecnologia" that
  // appear in any page's navigation and footer, which is how an act on dialysis
  // habilitation qualified as vocational education news.
  return { direct, strategic, eligible: direct > 0 };
}

function douItemFromDocument(document, candidate = {}) {
  const content = String(document?.content || document?.summaryPt || candidate?.summaryPt || '').trim();
  // The listing payload carries the act's own title; the fetched page's <title>
  // is the newspaper's, which is how an act reached the radar called
  // "Imprensa Nacional".
  const title = String(candidate?.title || document?.title || 'Ato oficial do Diário Oficial da União').trim();
  const relevance = douRelevance(title, content);
  if (!relevance.eligible) return null;
  const sourceUrl = document?.sourceUrl || candidate?.sourceUrl;
  const externalId = document?.externalId || candidate?.externalId || `dou:${sourceUrl}`;
  const sourceText = content || title;
  const summary = buildEvidenceFallback(sourceText, { maxWords: 80 });
  return normalizeRadarItem({
    id: externalId,
    externalId,
    section: 'government',
    title,
    summaryPt: summary,
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
    provenance: { ...(candidate?.provenance || {}), ...(document?.provenance || {}), evidenceLength: sourceText.length, eligibility: { direct: relevance.direct, strategic: relevance.strategic } },
  });
}

export async function fetchDouItems({ limit = 20 } = {}) {
  if (process.env.RADAR_DOU_ENABLED === 'false') return { items: [], status: 'disabled', provider: 'disabled', errors: [] };
  const { startDate, endDate } = douDateWindow();
  const direct = new DirectOfficialWebProvider({
    sections: String(process.env.RADAR_DOU_SECTIONS || 'DO1,DO3').split(',').map((value) => value.trim()).filter(Boolean),
    maxDays: Math.max(1, Number(process.env.RADAR_DOU_LOOKBACK_DAYS || 7)),
    timeoutMs: Math.max(2000, Number(process.env.RADAR_DOU_TIMEOUT_MS || 8000)),
  });
  // Parsing costs nothing beyond the edition already downloaded, so discovery
  // keeps the whole listing and the narrowing happens below, on signal rather
  // than on arrival order.
  const directDiscovery = await direct.discover({ query: 'EPT formação profissional indústria competências', domains: ['in.gov.br'], startDate, endDate, maxResults: DOU_DISCOVERY_CEILING });
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
  const selected = (shortlisted.length ? shortlisted : candidates).slice(0, limit);
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
    candidates: candidates.length,
    shortlisted: shortlisted.length,
    retrieved: documents.length,
    eligible: items.length,
  };
  return { items, status: items.length ? 'ok' : (directDiscovery.status || 'no_edition'), provider: extractionProvider || provider, errors: discoveryErrors, diagnostics, window: { startDate, endDate } };
}

function providerStatus(name, status, extra = {}) {
  return { name, status, ...extra };
}

/**
 * Store I/O must never abort a collection run.  A throw here used to escape as
 * an opaque `radar_refresh_failed` with no source and no cause attached, which
 * is indistinguishable from every collector failing at once.
 */
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
    // Items collected since the decision started being recorded carry it; older
    // ones are re-judged from the text that survived, which is what clears the
    // off-topic acts admitted under the previous rule.
    const recorded = item?.provenance?.eligibility;
    if (recorded && Number.isFinite(Number(recorded.direct))) return Number(recorded.direct) > 0;
    return douRelevance(item.title, item.summaryPt).eligible;
  }
  if (item?.provider === 'institutional-web' && !item.publishedAt) return String(item.title || '').length >= 40;
  return true;
}

export async function getRadarItems({ filters = {}, live = false, persist = true } = {}) {
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
  const sourceStatus = {};
  if (live && (!filters.section || filters.section === 'research')) {
    const query = filters.query || '"vocational education and training"';
    const [openAlexItems, crossrefItems, trackedItems] = await Promise.allSettled([fetchOpenAlexItems({ query }), fetchCrossrefItems({ query }), fetchTrackedResearcherItems()]);
    sourceStatus.OpenAlex = openAlexItems.status === 'fulfilled'
      ? providerStatus('OpenAlex', 'ok', { count: openAlexItems.value.length })
      : providerStatus('OpenAlex', 'error', { error: String(openAlexItems.reason?.message || 'source_unavailable').slice(0, 160) });
    sourceStatus.Crossref = crossrefItems.status === 'fulfilled'
      ? providerStatus('Crossref', 'ok', { count: crossrefItems.value.length })
      : providerStatus('Crossref', 'error', { error: String(crossrefItems.reason?.message || 'source_unavailable').slice(0, 160) });
    const tracked = trackedItems.status === 'fulfilled' ? trackedItems.value : [];
    sourceStatus['Pesquisadores cadastrados'] = trackedItems.status === 'fulfilled'
      ? providerStatus('Pesquisadores cadastrados', 'ok', { count: tracked.length })
      : providerStatus('Pesquisadores cadastrados', 'error', { error: String(trackedItems.reason?.message || 'source_unavailable').slice(0, 160) });
    currentItems.push(...(openAlexItems.status === 'fulfilled' ? openAlexItems.value : []), ...(crossrefItems.status === 'fulfilled' ? crossrefItems.value : []), ...tracked);
    items = [...currentItems, ...items].filter(isAllowedItem);
    liveProvider = currentItems.length > 0;
  }
  if (live && (!filters.section || filters.section === 'international')) {
    const oecdItems = await Promise.allSettled([fetchOecdItems()]);
    const oecd = oecdItems[0];
    sourceStatus.OCDE = oecd.status === 'fulfilled'
      ? providerStatus('OCDE', 'ok', { count: oecd.value.length })
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
    const [douResult] = await Promise.allSettled([fetchDouItems({ limit: 20 })]);
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
      errors: dou.errors?.slice(0, 5) || [],
    });
    currentItems.push(...dou.items);
    items = [...dou.items, ...items].filter(isAllowedItem);
    // A reachable edition with zero eligible acts is still a successful run.
    liveProvider = liveProvider || ['ok', 'no_edition'].includes(dou.status);
  }
  if (live) {
    const feeds = feedPolicy.filter((feed) => !filters.section || feed.section === filters.section);
    const feedResults = await Promise.allSettled(feeds.map((feed) => fetchFeedItems(feed)));
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

    const webSources = RADAR_WEB_POLICY.filter((source) => !filters.section || source.section === filters.section);
    const webResults = await Promise.allSettled(webSources.map((source) => fetchWebItems(source)));
    const webItems = [];
    webResults.forEach((result, index) => {
      const source = webSources[index];
      sourceStatus[`${source.name} (web)`] = result.status === 'fulfilled'
        ? providerStatus(`${source.name} (web)`, 'ok', { count: result.value.length, url: source.url })
        : providerStatus(`${source.name} (web)`, 'error', { error: String(result.reason?.message || 'source_unavailable').slice(0, 160), url: source.url });
      if (result.status === 'fulfilled') webItems.push(...result.value);
    });
    currentItems.push(...webItems);
    items = [...webItems, ...items].filter(isAllowedItem);
    liveProvider = liveProvider || webItems.length > 0;
  }
  const fetchedAt = liveProvider ? new Date().toISOString() : stored?.fetchedAt || new Date().toISOString();
  const mergedResearch = mergeResearchItems(items.filter((item) => item.section === 'research'));
  const shouldSummarizeResearch = live && (!filters.section || filters.section === 'research');
  // Summaries are an optional enrichment with their own budget and extractive
  // fallback, so a failure there must not cost the run every item it collected.
  const [summaryResult] = shouldSummarizeResearch
    ? await Promise.allSettled([summarizeResearchItems(mergedResearch, { previousItems: stored?.items?.filter((item) => item.section === 'research') || [] })])
    : [{ status: 'fulfilled', value: mergedResearch }];
  if (summaryResult.status === 'rejected') {
    sourceStatus['Resumos por IA'] = providerStatus('Resumos por IA', 'error', {
      error: String(summaryResult.reason?.message || 'summary_unavailable').slice(0, 160),
    });
  }
  const summarizedResearch = summaryResult.status === 'fulfilled' ? summaryResult.value : mergedResearch;
  const nonResearch = items.filter((item) => item.section !== 'research');
  const snapshotItems = dedupeRadarItems([...summarizedResearch, ...nonResearch]).filter(isEligibleRadarItem);
  const stale = !liveProvider && Boolean(stored);
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

export async function refreshRadarSnapshot({ filters = {} } = {}) {
  const startedAt = Date.now();
  try {
    const result = await getRadarItems({ filters, live: true, persist: false });
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
    const lastRun = radarStore.recordRun({ status: 'failed', fetchedAt: new Date().toISOString(), itemCount: radarStore.getSnapshot()?.items?.length || 0, sourceStatus: {}, error: cause, durationMs: Date.now() - startedAt });
    await safeStoreCall(() => radarStore.flush());
    return { items: radarStore.getSnapshot()?.items || [], refreshed: false, stale: Boolean(radarStore.getSnapshot()), lastRun, error: cause };
  }
}

export function getRadarStoreStatus() {
  return { ...radarStore.status(), lastRun: radarStore.getLastRun(), snapshot: radarStore.getSnapshot() ? { fetchedAt: radarStore.getSnapshot().fetchedAt, itemCount: radarStore.getSnapshot().items?.length || 0 } : null };
}
