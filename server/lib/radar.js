import seedItems from '../../src/data/radar-seeds.json' with { type: 'json' };
import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import { calculateRadarRelevance, dedupeRadarItems, filterRadarItems, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';
import { canonicalizeResearchers } from '../../src/domain/researcherCatalog.js';
import { radarStore } from './radarStore.js';
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
  { name: 'FAPESP', section: 'government', url: 'https://agencia.fapesp.br/rss', official: true, geography: 'São Paulo' },
  { name: 'UNESCO-UNEVOC', section: 'international', url: 'https://connect.unevoc.unesco.org/unevoc_rss.xml', official: true, geography: 'Internacional' },
];

export const RADAR_FEED_MANIFEST_VERSION = '2026-07-17.v2';

export const RADAR_WEB_POLICY = [
  { name: 'MEC / SETEC', section: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos/noticias', official: true, geography: 'Brasil' },
  { name: 'INEP', section: 'government', url: 'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/', official: true, geography: 'Brasil' },
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
    .filter((item) => item.isNews && webRelevance(item.title, item.summaryPt) >= 59)
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
  const authorsLabel = authorNames.length ? ` de ${authorNames.slice(0, 3).join(', ')}` : '';
  const topicsLabel = topicNames.length ? ` Temas indexados: ${topicNames.join('; ')}.` : '';
  return normalizeRadarItem({
    id: work?.id,
    externalId: work?.id || doi,
    section: 'research',
    title: htmlText(work?.display_name || work?.title),
    summaryPt: `Pesquisa${authorsLabel}, publicada em ${work?.publication_date || 'data não informada'}.${topicsLabel} Consulte o DOI e a fonte original para avaliar método e resultados.`,
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
    select: 'id,doi,title,display_name,publication_date,type,relevance_score,primary_location,authorships,topics',
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
  const params = new URLSearchParams({ query: query.replace(/\s+/g, ' '), rows: String(Math.min(Math.max(limit, 1), 25)), sort: 'published', order: 'desc', filter: `from-pub-date:${since.toISOString().slice(0, 10)},until-pub-date:${today}`, 'select': 'DOI,title,URL,published,author,type,container-title,publisher' });
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
    return normalizeRadarItem({
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
    select: 'DOI,title,URL,published,author,type,publisher,container-title',
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
      authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    });
  }).filter((item) => item.isNews && webRelevance(item.title, '') >= 59);
  cacheSet(cacheKey, items);
  return items;
}

function providerStatus(name, status, extra = {}) {
  return { name, status, ...extra };
}

export async function getRadarItems({ filters = {}, live = false, persist = true } = {}) {
  await radarStore.hydrate({ force: live });
  const feedPolicy = getRadarFeedPolicy();
  const allowedSources = new Set(RADAR_SOURCE_POLICY.map((entry) => entry.name));
  const isAllowedItem = (item) => allowedSources.has(item.sourceName)
    || feedPolicy.some((feed) => feed.name === item.sourceName)
    || /^curated-/.test(item.provider);
  const stored = radarStore.getSnapshot();
  let items = (stored?.items || seedItems).map(normalizeRadarItem).filter(isAllowedItem);
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
  const snapshotItems = dedupeRadarItems(items).filter((item) => item.isNews && !item.isPlaceholder);
  const stale = !liveProvider && Boolean(stored);
  if (persist && liveProvider) {
    radarStore.writeSnapshot({ items: snapshotItems, fetchedAt, sourceStatus, liveProvider: true, stale: false });
    radarStore.recordRun({ status: 'ok', fetchedAt, itemCount: snapshotItems.length, sourceStatus, durationMs: null });
    await radarStore.flush();
  } else if (persist && live && !liveProvider) {
    radarStore.recordRun({ status: stored ? 'stale' : 'failed', fetchedAt, itemCount: snapshotItems.length, sourceStatus, durationMs: null });
    await radarStore.flush();
  }
  return { items: filterRadarItems(snapshotItems, filters), liveProvider, stale, fetchedAt, sourceStatus, lastRun: radarStore.getLastRun(), store: radarStore.status() };
}

export async function refreshRadarSnapshot({ filters = {} } = {}) {
  const startedAt = Date.now();
  try {
    const result = await getRadarItems({ filters, live: true, persist: false });
    const previous = radarStore.getSnapshot();
    const snapshot = { items: dedupeRadarItems(result.items), fetchedAt: result.fetchedAt, sourceStatus: result.sourceStatus, liveProvider: result.liveProvider, stale: false };
    if (result.liveProvider) radarStore.writeSnapshot(snapshot);
    const retained = result.liveProvider ? snapshot : previous;
    radarStore.recordRun({ status: result.liveProvider ? 'ok' : 'failed', fetchedAt: result.fetchedAt, itemCount: retained?.items?.length || 0, sourceStatus: result.sourceStatus, durationMs: Date.now() - startedAt });
    await radarStore.flush();
    return { ...result, items: retained?.items || snapshot.items, refreshed: result.liveProvider, stale: !result.liveProvider && Boolean(previous), durationMs: Date.now() - startedAt, lastRun: radarStore.getLastRun() };
  } catch (error) {
    const lastRun = radarStore.recordRun({ status: 'failed', fetchedAt: new Date().toISOString(), itemCount: radarStore.getSnapshot()?.items?.length || 0, sourceStatus: {}, error: String(error?.message || 'radar_refresh_failed').slice(0, 160), durationMs: Date.now() - startedAt });
    await radarStore.flush();
    return { items: radarStore.getSnapshot()?.items || [], refreshed: false, stale: Boolean(radarStore.getSnapshot()), lastRun, error: 'radar_refresh_failed' };
  }
}

export function getRadarStoreStatus() {
  return { ...radarStore.status(), lastRun: radarStore.getLastRun(), snapshot: radarStore.getSnapshot() ? { fetchedAt: radarStore.getSnapshot().fetchedAt, itemCount: radarStore.getSnapshot().items?.length || 0 } : null };
}
