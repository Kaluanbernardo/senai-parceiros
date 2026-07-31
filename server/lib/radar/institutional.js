import { isEligibleRadarItem, normalizeRadarItem } from '../../../src/domain/radar.js';

const DAY_MS = 86_400_000;

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function text(value) {
  return String(value || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SEMANTIC_PATTERNS = [
  ['educação profissional e tecnológica', /\beducacao profissional(?: e tecnologica)?\b/],
  ['educação técnica', /\b(?:educacao|ensino|formacao) tecnic[ao]s?\b/],
  ['curso técnico', /\bcursos? tecnic[oa]s?\b/],
  ['formação profissional', /\bformacao profissional\b/],
  ['qualificação profissional', /\bqualificacao profissional\b/],
  ['aprendizagem profissional', /\baprendizagem profissional\b/],
  ['ensino médio integrado', /\bensino medio integrado\b/],
  ['formação técnica e profissional', /\bformacao tecnica e profissional\b/],
  ['formação inicial e continuada', /\bformacao inicial e continuada\b/],
  ['Rede Federal', /\brede federal de educacao profissional\b/],
  ['Instituto Federal', /\binstitutos? federais?\b/],
  ['escola técnica', /\bescolas? tecnicas?\b/],
  ['Etec/Fatec', /(?:^|\W)(?:etec|fatec)s?(?:\W|$)/],
  ['competência profissional', /\bcompetencias? profissionais?\b/],
  ['certificação profissional', /\bcertificacao profissional\b/],
  ['reconhecimento de saberes', /\breconhecimento de saberes\b/],
  ['EPT', /(?:^|\W)ept(?:\W|$)/],
  ['vocational education and training', /\bvocational (?:education|training|learning)\b/],
  ['vocational skills', /\bvocational skills?\b/],
  ['technical and vocational education', /\btechnical and vocational\b/],
  ['TVET', /(?:^|\W)tvet(?:\W|$)/],
  ['apprenticeship', /\bapprentice(?:ship|ships|s)?\b/],
  ['work-based learning', /\bwork[- ]based learning\b/],
  ['career and technical education', /\bcareer and technical education\b/],
  ['workforce development', /\bworkforce development\b/],
  ['vocational excellence', /\bvocational excellence\b/],
  ['qualification frameworks', /\bqualifications? frameworks?\b/],
  ['skills development', /\bskills? (?:development|system|systems|policy|policies|training)\b/],
];

export function semanticEvidence(title, summary = '', context = '') {
  const haystack = fold(`${title} ${summary} ${context}`);
  const matches = SEMANTIC_PATTERNS.filter(([, pattern]) => pattern.test(haystack)).map(([label]) => label);
  return { eligible: matches.length > 0, matches };
}

function absoluteUrl(href, source) {
  try {
    const base = new URL(source.url);
    const result = new URL(href, base);
    const allowed = new Set([base.hostname, ...(source.allowedHosts || [])].map((host) => String(host).replace(/^www\./, '').toLowerCase()));
    const host = result.hostname.replace(/^www\./, '').toLowerCase();
    if (result.protocol !== 'https:' || !allowed.has(host)) return '';
    result.hash = '';
    return result.toString();
  } catch {
    return '';
  }
}

const MONTHS = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export function parseInstitutionalDate(value) {
  const raw = text(value);
  const timestamp = raw.match(/^\d{10,13}$/)?.[0];
  if (timestamp) {
    const milliseconds = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
    const parsedTimestamp = new Date(milliseconds);
    if (!Number.isNaN(parsedTimestamp.getTime())) return parsedTimestamp.toISOString().slice(0, 10);
  }
  const iso = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = raw.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  const named = fold(raw).match(/\b(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(20\d{2})\b/);
  if (named && MONTHS[named[2]]) return `${named[3]}-${String(MONTHS[named[2]]).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function pageUrl(source, page) {
  if (source.pagePath) return new URL(source.pagePath.replace('{page}', String(page + (source.pageStart || 0))), source.url).toString();
  const url = new URL(source.url);
  if (page > 0 || source.includeFirstPageParam) {
    const value = (source.pageStart || 0) + page * (source.pageStep || 1);
    url.searchParams.set(source.pageParam || 'page', String(value));
  }
  const serialized = url.toString();
  const encodedParam = encodeURIComponent(source.pageParam || 'page');
  return encodedParam === (source.pageParam || 'page')
    ? serialized
    : serialized.replace(`${encodedParam}=`, `${source.pageParam}=`);
}

export function extractInstitutionalCandidates(html, source) {
  const candidates = [];
  const seen = new Set();
  const add = (href, titleHtml, block) => {
    const url = absoluteUrl(href, source);
    const title = text(titleHtml);
    if (!url || !title || title.length < 12 || title.length > 300 || seen.has(url)) return;
    const context = String(block || '');
    const date = context.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]
      || context.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1]
      || context.match(/\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]20\d{2}\b/)?.[0]
      || context.match(/\b\d{1,2}\s+(?:de\s+)?(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:de\s+)?20\d{2}\b/i)?.[0]
      || context.match(/(?:publicado|atualizado|published|publication date|data)[^0-9a-z]{0,30}([\s\S]{0,80}?)(?:<|$)/i)?.[1]
      ;
    const summary = context.match(/<(?:p|div)\b[^>]*(?:class=["'][^"']*(?:description|summary|resume|lead|texto)[^"']*["'])?[^>]*>([\s\S]*?)<\/(?:p|div)>/i)?.[1] || '';
    const evidence = source.explicitTopic
      ? { eligible: true, matches: [source.topicLabel || 'escopo temático da fonte'] }
      : semanticEvidence(title, text(summary), text(context));
    seen.add(url);
    candidates.push({ url, title, summary: text(summary), publishedAt: parseInstitutionalDate(date), evidence: evidence.matches, eligible: evidence.eligible });
  };
  const markup = String(html || '');
  const iloCardStarts = [...markup.matchAll(/<div\b[^>]*class=(["'])([^"']*)\1[^>]*>/gi)]
    .filter((match) => match[2].split(/\s+/).includes('ilo--card'))
    .map((match) => match.index);
  const iloCardBlocks = iloCardStarts.map((start, index) => markup.slice(start, iloCardStarts[index + 1] || Math.min(markup.length, start + 6000)));
  const blocks = [
    ...markup.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi),
    ...markup.matchAll(/<li\b[^>]*class=["'][^"']*(?:views-row|tile|news|search-result)[^"']*["'][^>]*>[\s\S]*?<\/li>/gi),
    ...markup.matchAll(/<div\b[^>]*class=["'][^"']*\barticle\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi),
  ].map((match) => match[0]).concat(iloCardBlocks);
  for (const block of blocks) {
    const link = block.match(/<h[1-6]\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-6]>/i)
      || [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .filter((match) => !/^\s*(?:<[^>]+>\s*)*(?:image|imagem)?\s*$/i.test(text(match[2])))
        .sort((left, right) => text(right[2]).length - text(left[2]).length)[0];
    if (link) add(link[1], link[2], block);
  }
  if (!blocks.length) {
    for (const match of markup.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const context = markup.slice(Math.max(0, match.index - 300), Math.min(markup.length, match.index + match[0].length + 900));
      add(match[1], match[2], context);
    }
  }
  return candidates;
}

function institutionalItem(candidate, source, fetchedAt) {
  const summary = candidate.summary || 'Publicação recuperada da fonte institucional; consulte a página original para detalhes.';
  return normalizeRadarItem({
    section: source.section,
    title: candidate.title,
    summaryPt: summary,
    publishedAt: candidate.publishedAt,
    sourceName: source.name,
    sourceUrl: candidate.url,
    contentType: source.contentType || (source.section === 'government' ? 'publicação oficial' : 'publicação institucional'),
    topics: candidate.evidence,
    geography: source.geography,
    official: source.official === true,
    provider: 'institutional-paginated',
    externalId: candidate.url,
    provenance: { pageUrl: source.url, fetchedAt, semanticMarkers: candidate.evidence },
  });
}

function jsonText(value) {
  return text(value?.rendered ?? value);
}

function doeSpEvidence(title, excerpt, hierarchy) {
  const evidence = semanticEvidence(title, excerpt, hierarchy);
  const normalized = fold(`${title} ${excerpt}`);
  const administrativeNoise = /\b(?:extrato de contrato|aviso de licitacao|pregao eletronico|nota de empenho|apostilamento|bibliografia|referencias bibliograficas|resultado de pagamento|designacao de fiscal|termo de designacao|ordem de servico para fiscal)\b/.test(normalized);
  const substantive = /\b(?:educacao profissional(?: e tecnologica| tecnica de nivel medio)?|formacao profissional do ensino medio|habilitacao profissional|itinerario (?:de formacao tecnica profissional|formativo)|cursos? tecnic[oa]s?|aprendizagem profissional|qualificacao profissional|formacao inicial e continuada)\b/.test(normalized)
    || /\b(?:autoriza|institui|regulamenta|aprova|oferta|amplia|cria)\b.{0,180}\b(?:curso|educacao profissional|formacao profissional|ensino tecnico)\b/.test(normalized);
  return { eligible: evidence.eligible && substantive && !administrativeNoise, matches: evidence.matches };
}

export async function collectDoeSpSource(source, { now = new Date(), maxPages = source.batchPages || 4, previousCoverage = null } = {}) {
  const fetchedAt = now.toISOString();
  const windowEnd = fetchedAt.slice(0, 10);
  const windowStart = new Date(now.getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
  const endpoint = new URL(source.apiUrl || 'https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications');
  (source.terms || ['educação profissional']).forEach((term, index) => endpoint.searchParams.set(`Terms[${index}]`, term));
  endpoint.searchParams.set('FromDate', windowStart);
  endpoint.searchParams.set('ToDate', windowEnd);
  endpoint.searchParams.set('PageSize', String(source.pageSize || 100));
  endpoint.searchParams.set('SortField', 'Date');
  const deadlineAt = Date.now() + Math.max(1000, Number(source.deadlineMs || 45_000));
  const requestPage = async (page) => {
    const url = new URL(endpoint);
    url.searchParams.set('PageNumber', String(page));
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error('doe_sp_deadline');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(Number(source.timeoutMs || 20_000), remainingMs))),
    });
    if (!response.ok) throw new Error(`doe_sp_${response.status}`);
    return response.json();
  };

  const first = await requestPage(1);
  const totalPages = Math.max(1, Number(first.totalPages || 1));
  const refreshingComplete = previousCoverage?.complete === true;
  const storedCursor = Number(previousCoverage?.nextPage);
  const startPage = refreshingComplete || !Number.isFinite(storedCursor) || storedCursor < 1
    ? totalPages
    : Math.min(totalPages, storedCursor);
  const requestedPages = [];
  for (let page = startPage; page >= 1 && requestedPages.length < Math.max(1, maxPages); page -= 1) requestedPages.push(page);
  const pages = new Map();
  if (requestedPages.includes(1)) pages.set(1, first);
  const remainingPages = requestedPages.filter((page) => page !== 1);
  const remaining = await Promise.allSettled(remainingPages.map(async (page) => [page, await requestPage(page)]));
  for (const result of remaining) if (result.status === 'fulfilled') pages.set(result.value[0], result.value[1]);
  const requestFailed = remaining.some((result) => result.status === 'rejected');
  const candidates = [];
  const seen = new Set();
  for (const page of pages.values()) {
    for (const publication of page.items || []) {
      const title = jsonText(publication.title);
      const summary = jsonText(publication.excerpt);
      const context = jsonText(publication.hierarchy);
      const url = absoluteUrl(publication.slug || `/publicacao/${publication.id}`, source);
      if (!title || !url || seen.has(url)) continue;
      seen.add(url);
      const evidence = doeSpEvidence(title, summary, context);
      candidates.push({
        url,
        title,
        summary,
        publishedAt: parseInstitutionalDate(publication.date),
        evidence: evidence.matches,
        eligible: evidence.eligible,
      });
    }
  }
  const items = candidates
    .filter((candidate) => candidate.eligible && candidate.publishedAt && candidate.publishedAt >= windowStart && candidate.publishedAt <= windowEnd)
    .map((candidate) => institutionalItem(candidate, { ...source, contentType: 'ato oficial estadual' }, fetchedAt))
    .filter(isEligibleRadarItem);
  const nextPage = requestFailed ? startPage : Math.max(0, startPage - requestedPages.length);
  const complete = !requestFailed && (refreshingComplete || nextPage === 0);
  const dates = candidates.map((candidate) => candidate.publishedAt).filter(Boolean).sort();
  return {
    items,
    coverage: {
      windowStart,
      windowEnd,
      oldestSeen: dates[0] || null,
      newestSeen: dates.at(-1) || null,
      pagesRead: pages.size,
      totalPages,
      candidates: candidates.length,
      eligible: items.length,
      complete,
      nextPage: complete ? null : nextPage,
      reason: requestFailed ? 'request_failed' : refreshingComplete ? 'head_refresh' : complete ? 'source_exhausted' : 'page_batch',
    },
  };
}

function xmlValue(block, tag) {
  return text(block.match(new RegExp(`<${tag}>([^<]+)`, 'i'))?.[1]);
}

function slugTitle(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || '').replace(/[-_]+/g, ' ');
  } catch {
    return '';
  }
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text(html.match(new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)`, 'i'))?.[1]
    || html.match(new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i'))?.[1]);
}

function iloArticleCandidate(html, entry) {
  const title = metaContent(html, 'og:title') || text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || slugTitle(entry.url);
  const summary = metaContent(html, 'description') || metaContent(html, 'og:description');
  const jsonDate = html.match(/["']datePublished["']\s*:\s*["']([^"']+)/i)?.[1];
  const timeDate = html.match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1];
  const evidence = semanticEvidence(title, summary);
  return {
    url: entry.url,
    title,
    summary,
    publishedAt: parseInstitutionalDate(jsonDate || timeDate || entry.lastmod),
    evidence: evidence.matches,
    eligible: evidence.eligible,
  };
}

export async function collectIloSitemapSource(source, { now = new Date(), maxDocuments = source.maxDocuments || 24, previousCoverage = null } = {}) {
  const fetchedAt = now.toISOString();
  const windowEnd = fetchedAt.slice(0, 10);
  const windowStart = new Date(now.getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
  const deadlineAt = Date.now() + Math.max(1000, Number(source.deadlineMs || 45_000));
  const requestText = async (url, accept = 'text/html,application/xhtml+xml') => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error('ilo_sitemap_deadline');
    const response = await fetch(url, {
      headers: { Accept: accept, 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(Number(source.timeoutMs || 12_000), remainingMs))),
    });
    if (!response.ok) throw new Error(`ilo_sitemap_${response.status}`);
    return response.text();
  };
  const indexUrl = source.sitemapUrl || 'https://www.ilo.org/sitemap.xml';
  const indexXml = await requestText(indexUrl, 'application/xml,text/xml');
  const sitemapUrls = [...indexXml.matchAll(/<loc>(https:\/\/www\.ilo\.org\/sitemap\.xml\?page=\d+)<\/loc>/gi)].map((match) => match[1]);
  const sitemapTailPages = Number(source.sitemapTailPages || 0);
  const selectedSitemaps = sitemapTailPages > 0 ? sitemapUrls.slice(-sitemapTailPages) : sitemapUrls;
  const sitemapResults = [];
  const sitemapConcurrency = Math.max(1, Number(source.sitemapConcurrency || 18));
  for (let index = 0; index < selectedSitemaps.length; index += sitemapConcurrency) {
    const batch = selectedSitemaps.slice(index, index + sitemapConcurrency);
    sitemapResults.push(...await Promise.allSettled(batch.map((url) => requestText(url, 'application/xml,text/xml'))));
  }
  const sitemapFailed = sitemapResults.some((result) => result.status === 'rejected');
  const entries = new Map();
  let oldestSitemapNewsCount = 0;
  let oldestSitemapNewestDate = null;
  const oldestFulfilledIndex = sitemapResults.findIndex((result) => result.status === 'fulfilled');
  for (const [resultIndex, result] of sitemapResults.entries()) {
    if (result.status !== 'fulfilled') continue;
    let pageNewsCount = 0;
    const pageNewsDates = [];
    for (const match of result.value.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const url = xmlValue(match[1], 'loc');
      const lastmod = parseInstitutionalDate(xmlValue(match[1], 'lastmod'));
      if (!/^https:\/\/www\.ilo\.org\/resource\/news\//i.test(url)) continue;
      pageNewsCount += 1;
      if (lastmod) pageNewsDates.push(lastmod);
      if (!lastmod || lastmod < windowStart || lastmod > windowEnd) continue;
      const title = slugTitle(url);
      entries.set(url, { url, lastmod, priority: semanticEvidence(title).eligible ? 1 : 0 });
    }
    if (resultIndex === oldestFulfilledIndex) {
      oldestSitemapNewsCount = pageNewsCount;
      oldestSitemapNewestDate = pageNewsDates.sort().at(-1) || null;
    }
  }
  const annualBoundaryVerified = selectedSitemaps.length === sitemapUrls.length || oldestSitemapNewsCount === 0 || Boolean(oldestSitemapNewestDate && oldestSitemapNewestDate < windowStart);
  const shortlist = [...entries.values()].sort((a, b) => b.priority - a.priority || b.lastmod.localeCompare(a.lastmod) || a.url.localeCompare(b.url));
  const refreshingComplete = previousCoverage?.complete === true;
  const startOffset = refreshingComplete ? 0 : Math.max(0, Number(previousCoverage?.candidateOffset || 0));
  const selected = shortlist.slice(startOffset, startOffset + Math.max(1, maxDocuments));
  const articleResults = [];
  const articleConcurrency = Math.max(1, Number(source.articleConcurrency || 20));
  for (let index = 0; index < selected.length; index += articleConcurrency) {
    const batch = selected.slice(index, index + articleConcurrency);
    articleResults.push(...await Promise.allSettled(batch.map(async (entry) => iloArticleCandidate(await requestText(entry.url), entry))));
  }
  const candidates = articleResults.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const requestFailed = sitemapFailed || articleResults.some((result) => result.status === 'rejected');
  const items = candidates
    .filter((candidate) => candidate.eligible && candidate.publishedAt && candidate.publishedAt >= windowStart && candidate.publishedAt <= windowEnd)
    .map((candidate) => institutionalItem(candidate, source, fetchedAt))
    .filter(isEligibleRadarItem);
  let contiguousRetrieved = 0;
  for (const result of articleResults) {
    if (result.status !== 'fulfilled') break;
    contiguousRetrieved += 1;
  }
  const nextOffset = sitemapFailed
    ? startOffset
    : requestFailed
      ? startOffset + contiguousRetrieved
      : startOffset + selected.length;
  const complete = !requestFailed && annualBoundaryVerified && (refreshingComplete || nextOffset >= shortlist.length);
  const dates = candidates.map((candidate) => candidate.publishedAt).filter(Boolean).sort();
  return {
    items,
    coverage: {
      windowStart,
      windowEnd,
      oldestSeen: dates[0] || null,
      newestSeen: dates.at(-1) || null,
      sitemapPages: sitemapResults.filter((result) => result.status === 'fulfilled').length,
      annualBoundaryVerified,
      candidates: shortlist.length,
      retrieved: candidates.length,
      eligible: items.length,
      complete,
      candidateOffset: complete ? null : nextOffset,
      reason: requestFailed ? 'request_failed' : !annualBoundaryVerified ? 'sitemap_window_unverified' : refreshingComplete ? 'head_refresh' : complete ? 'source_exhausted' : 'candidate_batch',
    },
  };
}

export async function collectPaginatedInstitutionalSource(source, { now = new Date(), maxPages = source.maxPages || 12, previousCoverage = null } = {}) {
  const fetchedAt = now.toISOString();
  const windowEnd = fetchedAt.slice(0, 10);
  const cutoff = new Date(now.getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
  const candidates = [];
  const seen = new Set();
  let pagesRead = 0;
  let boundaryReached = false;
  let exhausted = false;
  let interruptedReason = '';
  const deadlineAt = Date.now() + Math.max(1000, Number(source.deadlineMs || 45_000));
  const refreshingComplete = source.incremental && previousCoverage?.complete === true;
  const startPage = source.incremental ? Math.max(0, Number(previousCoverage?.nextPage || 0)) : 0;
  for (let batchPage = 0; batchPage < maxPages; batchPage += 1) {
    const page = startPage + batchPage;
    if (page >= Number(source.maxPages || Number.POSITIVE_INFINITY)) {
      exhausted = true;
      break;
    }
    const url = pageUrl(source, page);
    let response;
    let requestError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const remainingMs = deadlineAt - Date.now();
        if (remainingMs <= 0) throw new Error('institutional_deadline');
        response = await fetch(url, {
          headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' },
          signal: AbortSignal.timeout(Math.max(1, Math.min(Number(source.timeoutMs || 10_000), remainingMs))),
        });
        if (!response.ok) throw new Error(`institutional_${response.status}`);
        requestError = null;
        break;
      } catch (error) {
        requestError = error;
      }
    }
    if (requestError) {
      if (!pagesRead) throw requestError;
      interruptedReason = /deadline/i.test(String(requestError?.message || '')) ? 'deadline' : /abort|timeout/i.test(String(requestError?.message || '')) ? 'timeout' : 'request_failed';
      break;
    }
    pagesRead += 1;
    const html = await response.text();
    if (/verification required|captcha|cf-chl-|challenge-platform/i.test(html)) {
      if (pagesRead === 1) throw new Error('institutional_blocked');
      interruptedReason = 'source_blocked';
      break;
    }
    const pageCandidates = extractInstitutionalCandidates(html, source);
    if (!pageCandidates.length) {
      if (!page) interruptedReason = 'empty_source';
      else exhausted = true;
      break;
    }
    for (const candidate of pageCandidates) {
      if (!seen.has(candidate.url)) {
        seen.add(candidate.url);
        candidates.push(candidate);
      }
    }
    const dated = pageCandidates.map((item) => item.publishedAt).filter(Boolean).sort();
    if (dated.length && dated[0] <= cutoff) {
      boundaryReached = true;
      break;
    }
  }
  const items = candidates
    .filter((candidate) => candidate.eligible && candidate.publishedAt && candidate.publishedAt >= cutoff && candidate.publishedAt <= windowEnd)
    .map((candidate) => institutionalItem(candidate, source, fetchedAt))
    .filter(isEligibleRadarItem);
  const dates = candidates.map((candidate) => candidate.publishedAt).filter(Boolean).sort();
  const complete = !source.sourceWindowLimited && !interruptedReason && (refreshingComplete || boundaryReached || exhausted || source.singlePageComplete === true);
  const nextPage = complete ? null : startPage + pagesRead;
  return {
    items,
    coverage: {
      windowStart: cutoff,
      windowEnd,
      oldestSeen: dates[0] || null,
      newestSeen: dates.at(-1) || null,
      pagesRead,
      candidates: candidates.length,
      eligible: items.length,
      complete,
      nextPage,
      reason: source.sourceWindowLimited ? 'source_window_limited' : interruptedReason || (refreshingComplete ? 'head_refresh' : boundaryReached ? 'window_boundary' : exhausted || source.singlePageComplete === true ? 'source_exhausted' : source.incremental ? 'page_batch' : 'page_cap'),
    },
  };
}

export async function collectWordPressSource(source, { now = new Date(), maxPages = source.maxPages || 12 } = {}) {
  const fetchedAt = now.toISOString();
  const endDate = fetchedAt.slice(0, 10);
  const cutoffDate = new Date(now.getTime() - 365 * DAY_MS).toISOString().slice(0, 10);
  const endpoint = new URL(source.apiUrl || '/wp-json/wp/v2/posts', source.url);
  endpoint.searchParams.set('per_page', '100');
  endpoint.searchParams.set('after', `${cutoffDate}T00:00:00Z`);
  endpoint.searchParams.set('before', `${endDate}T23:59:59Z`);
  endpoint.searchParams.set('orderby', 'date');
  endpoint.searchParams.set('order', 'desc');
  endpoint.searchParams.set('_fields', 'id,date,link,title,excerpt');
  const candidates = [];
  let totalPages = 1;
  let pagesRead = 0;
  const deadlineAt = Date.now() + Math.max(1000, Number(source.deadlineMs || 45_000));
  const requestPage = async (page) => {
    const pageUrl = new URL(endpoint);
    pageUrl.searchParams.set('page', String(page));
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error('institutional_deadline');
    const response = await fetch(pageUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'senai-parceiros/1.0 radar-public-sources' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(Number(source.timeoutMs || 12_000), remainingMs))),
    });
    if (!response.ok) throw new Error(`wordpress_${response.status}`);
    return { posts: await response.json(), totalPages: Math.max(1, Number(response.headers.get('x-wp-totalpages') || 1)) };
  };
  const firstPage = await requestPage(1);
  totalPages = firstPage.totalPages;
  const remainingPages = Array.from({ length: Math.max(0, Math.min(maxPages, totalPages) - 1) }, (_, index) => index + 2);
  const remaining = await Promise.allSettled(remainingPages.map(requestPage));
  const pages = [firstPage, ...remaining.filter((result) => result.status === 'fulfilled').map((result) => result.value)];
  const requestFailed = remaining.some((result) => result.status === 'rejected');
  for (const page of pages) {
    pagesRead += 1;
    for (const post of page.posts) {
      const title = text(post?.title?.rendered);
      const summary = text(post?.excerpt?.rendered);
      const evidence = source.explicitTopic
        ? { eligible: true, matches: [source.topicLabel || 'escopo temático da fonte'] }
        : semanticEvidence(title, summary);
      if (!title || !post?.link) continue;
      candidates.push({
        url: absoluteUrl(post.link, source),
        title,
        summary,
        publishedAt: parseInstitutionalDate(post.date),
        evidence: evidence.matches,
        eligible: evidence.eligible,
      });
    }
  }
  const items = candidates
    .filter((candidate) => candidate.url && candidate.eligible && candidate.publishedAt && candidate.publishedAt >= cutoffDate && candidate.publishedAt <= endDate)
    .map((candidate) => institutionalItem(candidate, source, fetchedAt))
    .filter(isEligibleRadarItem);
  const dates = candidates.map((candidate) => candidate.publishedAt).filter(Boolean).sort();
  const complete = !requestFailed && pagesRead >= totalPages;
  return {
    items,
    coverage: {
      windowStart: cutoffDate,
      windowEnd: endDate,
      oldestSeen: dates[0] || null,
      newestSeen: dates.at(-1) || null,
      pagesRead,
      totalPages,
      candidates: candidates.length,
      eligible: items.length,
      complete,
      reason: requestFailed ? 'request_failed' : complete ? 'source_exhausted' : 'page_cap',
    },
  };
}
