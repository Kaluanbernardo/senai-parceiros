import seedItems from '../../src/data/radar-seeds.json' with { type: 'json' };
import { dedupeRadarItems, filterRadarItems, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';
export { dedupeRadarItems, filterRadarItems, normalizeRadarItem, RADAR_SECTIONS, RADAR_SECTION_LABELS } from '../../src/domain/radar.js';

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
  { name: 'MEC / SETEC', section: 'government', url: 'https://www.gov.br/mec/pt-br/assuntos/noticias/RSS', official: true, geography: 'Brasil' },
  { name: 'Governo do Estado de São Paulo', section: 'government', url: 'https://www.educacao.sp.gov.br/educacao/noticias/RSS', official: true, geography: 'São Paulo' },
  { name: 'OIT', section: 'international', url: 'https://www.ilo.org/rss/whatsnew.xml', official: true, geography: 'Internacional' },
  { name: 'UNESCO-UNEVOC', section: 'international', url: 'https://connect.unevoc.unesco.org/unevoc_rss.xml', official: true, geography: 'Internacional' },
];

const liveCache = new Map();
const LIVE_CACHE_TTL = 10 * 60 * 1000;
const LIVE_CACHE_MAX = 24;

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
  const summary = xmlText(block, 'description') || xmlText(block, 'summary') || 'Atualização pública recuperada do feed institucional.';
  const haystack = `${title} ${summary}`.toLocaleLowerCase('pt-BR');
  const relevanceScore = Math.min(100, 55 + ['educação profissional', 'educacao profissional', 'vocational', 'technical education', 'skills', 'qualificação', 'qualification', 'aprendizagem', 'apprenticeship', 'vet', 'tvet'].filter((term) => haystack.includes(term)).length * 8);
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
    relevanceScore,
    provider: 'rss',
    externalId,
    provenance: { feedUrl: feed.url, fetchedAt: new Date().toISOString() },
  });
}

export async function fetchFeedItems(feed, { limit = 10 } = {}) {
  const cacheKey = `feed:${feed.url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const response = await fetch(feed.url, { headers: { Accept: 'application/rss+xml, application/atom+xml, text/xml' }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`feed_${response.status}`);
  const xml = await response.text();
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((match) => match[0]);
  const items = blocks.map((block, index) => feedItem(block, feed, index)).filter((item) => item.title && item.sourceUrl).slice(0, limit);
  cacheSet(cacheKey, items);
  return items;
}

function openAlexItem(work) {
  const doi = work?.doi || work?.primary_location?.landing_page_url || work?.id;
  return normalizeRadarItem({
    id: work?.id,
    externalId: work?.id || doi,
    section: 'research',
    title: work?.display_name || work?.title,
    summaryPt: 'Resultado acadêmico recuperado automaticamente do OpenAlex. Consulte o título original, DOI e fonte para validar a pertinência ao contexto do SENAI-SP.',
    originalTitle: work?.display_name || work?.title,
    publishedAt: work?.publication_date,
    sourceName: 'OpenAlex',
    sourceUrl: work?.doi || work?.primary_location?.landing_page_url || work?.id,
    contentType: work?.type || 'trabalho acadêmico',
    topics: ['EPT', 'VET', ...(work?.topics || []).slice(0, 2).map((topic) => topic.display_name)],
    geography: work?.authorships?.[0]?.institutions?.[0]?.country_code || 'Internacional',
    official: false,
    relevanceScore: Math.round((Number(work?.relevance_score) || 0) * 10) || 70,
    provider: 'openalex',
    authors: (work?.authorships || []).slice(0, 8).map((author) => author.author?.display_name).filter(Boolean),
    doi,
  });
}

export async function fetchOpenAlexItems({ query = 'vocational education training', limit = 12 } = {}) {
  const cacheKey = `${query}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(Math.max(limit, 1), 25)),
    sort: '-publication_date',
    select: 'id,doi,title,display_name,publication_date,type,relevance_score,primary_location,authorships,topics',
  });
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  const headers = process.env.OPENALEX_MAILTO ? { 'User-Agent': `senai-parceiros/1.0 (mailto:${process.env.OPENALEX_MAILTO})` } : undefined;
  const response = await fetch(`https://api.openalex.org/works?${params}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`openalex_${response.status}`);
  const body = await response.json();
  const items = (body.results || []).map(openAlexItem);
  cacheSet(cacheKey, items);
  return items;
}

export async function fetchCrossrefItems({ query = 'vocational education training', limit = 12 } = {}) {
  const cacheKey = `crossref:${query}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const params = new URLSearchParams({ query: query.replace(/\s+/g, ' '), rows: String(Math.min(Math.max(limit, 1), 25)), 'select': 'DOI,title,URL,published,author,type,container-title' });
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
      relevanceScore: 68,
      provider: 'crossref',
      authors: (work.author || []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    });
  });
  cacheSet(cacheKey, items);
  return items;
}

export async function getRadarItems({ filters = {}, live = false } = {}) {
  const allowedSources = new Set(RADAR_SOURCE_POLICY.map((entry) => entry.name));
  let items = seedItems.map(normalizeRadarItem).filter((item) => allowedSources.has(item.sourceName));
  let liveProvider = false;
  if (live && (!filters.section || filters.section === 'research')) {
    try {
      const query = filters.query || 'vocational education training';
      const [openAlexItems, crossrefItems] = await Promise.allSettled([
        fetchOpenAlexItems({ query }),
        fetchCrossrefItems({ query }),
      ]);
      const liveItems = [
        ...(openAlexItems.status === 'fulfilled' ? openAlexItems.value : []),
        ...(crossrefItems.status === 'fulfilled' ? crossrefItems.value : []),
      ];
      items = [...liveItems, ...items].filter((item) => allowedSources.has(item.sourceName));
      liveProvider = liveItems.length > 0;
    } catch {
      liveProvider = false;
    }
  }
  if (live) {
    const feeds = RADAR_FEED_POLICY.filter((feed) => !filters.section || feed.section === filters.section);
    const feedResults = await Promise.allSettled(feeds.map((feed) => fetchFeedItems(feed)));
    const feedItems = feedResults.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    items = [...feedItems, ...items].filter((item) => allowedSources.has(item.sourceName) || RADAR_FEED_POLICY.some((feed) => feed.name === item.sourceName));
    liveProvider = liveProvider || feedItems.length > 0;
  }
  return { items: filterRadarItems(items, filters), liveProvider, fetchedAt: new Date().toISOString() };
}
