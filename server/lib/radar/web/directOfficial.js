import {
  buildDouEditionUrls,
  formatBrazilDate,
  isDouUrl,
  isoDate,
  normalizeHttpsUrl,
  normalizeHostname,
} from './urlPolicy.js';
import { contentHash, createDiscoveryResult, createProviderTrace, createRetrievalResult, RADAR_PROVIDER_NAMES, sanitizeProviderError } from '../contracts.js';

const DEFAULT_BASE_URL = 'https://www.in.gov.br/leiturajornal';

function stripHtml(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/\s+/g, ' ').trim();
}

function trimText(value, max = 900) {
  const text = stripHtml(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const boundary = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('; '), clipped.lastIndexOf(' '));
  return `${clipped.slice(0, boundary > max * 0.6 ? boundary : max).trim()}…`;
}

function absoluteDouUrl(href, baseUrl, { article = true } = {}) {
  try {
    const url = new URL(String(href || ''), baseUrl);
    url.hash = '';
    const normalized = normalizeHttpsUrl(url.toString(), { domains: ['in.gov.br'] });
    return normalized && isDouUrl(normalized, { article }) ? normalized : '';
  } catch {
    return '';
  }
}

function articleIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const explicit = parsed.searchParams.get('id') || parsed.searchParams.get('articleId');
    if (explicit) return explicit;
    return parsed.pathname.split('/').filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

function sectionFromUrl(url) {
  try { return new URL(url).searchParams.get('secao') || ''; } catch { return ''; }
}

function dateFromDocument(html, fallback) {
  const source = String(html || '');
  const machine = source.match(/(?:datePublished|published|dataPublicacao|published_time)["'\s:=]+(?:"|')?(20\d{2}[-/]\d{2}[-/]\d{2})/i)?.[1]
    || source.match(/<meta\s+[^>]*(?:property|name)=["'][^"']*(?:published|date)[^"']*["'][^>]*content=["'](20\d{2}[-/]\d{2}[-/]\d{2})/i)?.[1];
  const value = machine || fallback;
  const brazilian = String(value || '').match(/^(\d{2})-(\d{2})-(20\d{2})$/);
  return brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : isoDate(value);
}

function titleFromDocument(html, fallback = '') {
  const match = String(html || '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
    || String(html || '').match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)
    || String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return trimText(match?.[1] || fallback, 280);
}

function extractArticleBody(html) {
  const source = String(html || '');
  const article = source.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    || source;
  return trimText(article, 12000);
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Reads the acts from the edition's embedded JSON payload.
 *
 * Measured behaviour: the anchors an edition page does serve are a couple of
 * navigation links repeated on every edition — thirteen editions yielded
 * twenty-six anchors that deduplicated to a single candidate. The day's acts
 * are not among them, so this runs alongside `parseListing` rather than only
 * when it comes back empty.
 */
function parseEmbeddedEdition(html, editionUrl, publishedAt, section) {
  const source = String(html || '');
  const raw = source.match(/<script[^>]*\bid=["']params["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
    || source.match(/<script[^>]*>\s*(\{[\s\S]*?"jsonArray"[\s\S]*?\})\s*<\/script>/i)?.[1];
  if (!raw) return [];
  let payload;
  try {
    payload = JSON.parse(decodeEntities(raw).trim());
  } catch {
    return [];
  }
  const entries = Array.isArray(payload?.jsonArray) ? payload.jsonArray : [];
  const items = [];
  const seen = new Set();
  for (const entry of entries) {
    const slug = String(entry?.urlTitle || entry?.url || '').trim();
    const title = trimText(entry?.title || entry?.artTitle || '', 280);
    if (!slug || !title || title.length < 8) continue;
    const url = absoluteDouUrl(slug.startsWith('http') || slug.startsWith('/') ? slug : `/web/dou/-/${slug}`, editionUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const articleId = articleIdFromUrl(url);
    const brazilian = String(entry?.pubDate || '').match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
    items.push({
      externalId: `dou:${articleId}`,
      sourceName: 'Diário Oficial da União',
      sourceUrl: url,
      title,
      summaryPt: trimText(entry?.content || entry?.artCategory || '', 900),
      publishedAt: brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : isoDate(publishedAt),
      contentType: 'ato oficial',
      section: String(entry?.pubName || section || sectionFromUrl(editionUrl) || 'DO1'),
      official: true,
      provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
      provenance: {
        editionUrl,
        edition: isoDate(publishedAt),
        section: section || sectionFromUrl(editionUrl) || null,
        articleId,
        discoveredAt: new Date().toISOString(),
      },
    });
  }
  return items;
}

/**
 * Structural fingerprint of an edition page: element counts and the key names
 * of any embedded JSON, never their values or any page text.
 *
 * Two attempts at guessing this page's shape were both wrong — anchors turned
 * out to be navigation, and the JSON payload guess found nothing. A page of
 * 2.4 MB clearly carries the acts somewhere, and describing its structure is
 * cheaper and far more reliable than a third guess.
 */
function editionMarkers(html) {
  const source = String(html || '');
  const jsonScripts = [...source.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const keysOf = (raw) => {
    try {
      const parsed = JSON.parse(decodeEntities(raw).trim());
      return parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 12) : [];
    } catch {
      return [];
    }
  };
  const biggest = jsonScripts.slice().sort((left, right) => right.length - left.length)[0] || '';
  return {
    anchorsTotal: (source.match(/<a\b/gi) || []).length,
    anchorsDou: (source.match(/href=["'][^"']*\/web\/dou\//gi) || []).length,
    scriptsJson: jsonScripts.length,
    biggestJsonBytes: biggest.length,
    biggestJsonKeys: keysOf(biggest),
    hasParamsScript: /<script[^>]*\bid=["']params["']/i.test(source),
    hasJsonArray: /"jsonArray"/.test(source),
    hasHierarchyList: /hierarchyList|hierarchy_list/i.test(source),
    hasMateriaMarker: /\bmateria\b/i.test(source),
  };
}

function parseListing(html, editionUrl, publishedAt, section) {
  const items = [];
  const seen = new Set();
  const source = String(html || '');
  for (const match of source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteDouUrl(match[1], editionUrl);
    const title = trimText(match[2], 280);
    if (!url || !title || title.length < 8 || seen.has(url) || url === editionUrl) continue;
    seen.add(url);
    const articleId = articleIdFromUrl(url);
    items.push({
      externalId: `dou:${articleId}`,
      sourceName: 'Diário Oficial da União',
      sourceUrl: url,
      title,
      summaryPt: '',
      publishedAt: isoDate(publishedAt),
      contentType: 'ato oficial',
      section: section || sectionFromUrl(editionUrl) || 'DO1',
      official: true,
      provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
      provenance: {
        editionUrl,
        edition: isoDate(publishedAt),
        section: section || sectionFromUrl(editionUrl) || null,
        articleId,
        discoveredAt: new Date().toISOString(),
      },
    });
  }
  return items;
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  return { signal: controller.signal, cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
}

export class DirectOfficialWebProvider {
  constructor({ fetchImpl = globalThis.fetch, baseUrl = process.env.RADAR_DOU_BASE_URL || DEFAULT_BASE_URL, sections = process.env.RADAR_DOU_SECTIONS?.split(',') || ['DO1', 'DO3'], timeoutMs = 12000, maxDays = 3, concurrency = Number(process.env.RADAR_DOU_CONCURRENCY || 10), userAgent = 'senai-parceiros/1.0 radar-public-sources' } = {}) {
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
    this.sections = sections;
    this.timeoutMs = timeoutMs;
    this.maxDays = maxDays;
    this.concurrency = concurrency;
    this.userAgent = userAgent;
  }

  async requestText(url, { signal } = {}) {
    const request = withTimeout(signal, this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': this.userAgent },
        signal: request.signal,
      });
      if (!response?.ok) throw new Error(`direct_official_http_${response?.status || 0}`);
      return await response.text();
    } finally {
      request.cleanup();
    }
  }

  async discover({ query = 'educação profissional', domains = ['in.gov.br'], startDate, endDate, maxResults = 20, signal } = {}) {
    const startedAt = new Date().toISOString();
    if (!domains.some((domain) => normalizeHostname(domain) === 'in.gov.br' || normalizeHostname(domain).endsWith('.in.gov.br'))) {
      return createDiscoveryResult({ provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, status: 'not_applicable', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, startedAt }) });
    }
    const urls = buildDouEditionUrls({ startDate: startDate || new Date(), endDate: endDate || startDate || new Date(), sections: this.sections, baseUrl: this.baseUrl, maxDays: this.maxDays });
    const items = [];
    const errors = [];
    // Counting what each edition actually yielded is what distinguishes "no act
    // was published" from "the page was never parsed" — two situations that
    // otherwise both report zero.
    const diagnostics = { editionsRead: 0, anchorItems: 0, embeddedItems: 0, emptyEditions: 0, htmlBytes: 0 };
    // One edition per day per section, fetched sequentially, meant a useful
    // lookback cost more wall clock than a serverless invocation has. Editions
    // are independent, so they go in bounded-concurrency batches instead: the
    // window can now be wide enough to actually catch an EPT act.
    const batchSize = Math.max(1, Number(this.concurrency) || 6);
    for (let index = 0; index < urls.length && items.length < maxResults; index += batchSize) {
      const batch = urls.slice(index, index + batchSize);
      const settled = await Promise.allSettled(batch.map((editionUrl) => this.requestText(editionUrl, { signal })));
      settled.forEach((result, offset) => {
        const editionUrl = batch[offset];
        if (result.status === 'rejected') {
          errors.push({ url: editionUrl, error: sanitizeProviderError(result.reason, 'direct_official_fetch_failed') });
          return;
        }
        const date = new URL(editionUrl).searchParams.get('data');
        const match = String(date || '').match(/^(\d{2})-(\d{2})-(20\d{2})$/);
        const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : isoDate(startDate || new Date());
        const anchored = parseListing(result.value, editionUrl, iso, sectionFromUrl(editionUrl));
        // Both parsers always run. Gating the payload on "no anchors found" made
        // it unreachable: an edition page carries a couple of navigation links
        // matching the article URL shape, so anchors were never empty while the
        // day's acts were never among them.
        const embedded = parseEmbeddedEdition(result.value, editionUrl, iso, sectionFromUrl(editionUrl));
        diagnostics.editionsRead += 1;
        diagnostics.anchorItems += anchored.length;
        diagnostics.embeddedItems += embedded.length;
        diagnostics.htmlBytes = Math.max(diagnostics.htmlBytes, String(result.value || '').length);
        if (!anchored.length && !embedded.length) diagnostics.emptyEditions += 1;
        // One sample is enough to describe the shape; every edition renders alike.
        if (!diagnostics.markers) diagnostics.markers = editionMarkers(result.value);
        items.push(...anchored, ...embedded);
      });
    }
    const unique = [...new Map(items.map((item) => [item.externalId, item])).values()].slice(0, Math.max(0, Number(maxResults) || 20));
    // Anchors repeated on every edition collapse to almost nothing here. Without
    // this count the run reported dozens of parsed anchors and a single
    // candidate, with no way to see that they were the same navigation links.
    diagnostics.uniqueCandidates = unique.length;
    return createDiscoveryResult({
      items: unique,
      errors,
      provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
      status: errors.length && !unique.length ? 'error' : errors.length ? 'partial' : unique.length ? 'ok' : 'no_edition',
      diagnostics,
      trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, startedAt, requestCount: urls.length, query }),
    });
  }

  async retrieve({ urls = [], focus = 'educação profissional', signal } = {}) {
    const startedAt = new Date().toISOString();
    const documents = [];
    const errors = [];
    const candidates = [...new Set((Array.isArray(urls) ? urls : []).map((value) => String(value || '').trim()))].slice(0, 20);
    // Eligibility is decided on the act's body, so every discovered act has to be
    // fetched before it can qualify. One at a time, that cost more than the
    // invocation had left after discovery, and the whole edition was discarded
    // for lack of content rather than for lack of relevance.
    const batchSize = Math.max(1, Number(this.concurrency) || 6);
    const allowed = [];
    for (const candidate of candidates) {
      const url = normalizeHttpsUrl(candidate, { domains: ['in.gov.br'] });
      if (!url || !isDouUrl(url, { article: true })) {
        errors.push({ url: candidate, error: 'url_not_allowed' });
        continue;
      }
      allowed.push(url);
    }
    for (let index = 0; index < allowed.length; index += batchSize) {
      const batch = allowed.slice(index, index + batchSize);
      const settled = await Promise.allSettled(batch.map((url) => this.requestText(url, { signal })));
      settled.forEach((result, offset) => {
        const url = batch[offset];
        if (result.status === 'rejected') {
          errors.push({ url, error: sanitizeProviderError(result.reason, 'direct_official_fetch_failed') });
          return;
        }
        const html = result.value;
        const content = extractArticleBody(html);
        documents.push({
          externalId: `dou:${articleIdFromUrl(url)}`,
          sourceName: 'Diário Oficial da União',
          sourceUrl: url,
          title: titleFromDocument(html, articleIdFromUrl(url)),
          content,
          publishedAt: dateFromDocument(html, new URL(url).searchParams.get('data')),
          section: sectionFromUrl(url) || null,
          official: true,
          provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
          focus,
          provenance: { articleId: articleIdFromUrl(url), extractedAt: new Date().toISOString(), extractionProvider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, contentHash: contentHash(content) },
        });
      });
    }
    return createRetrievalResult({
      documents,
      errors,
      provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
      status: errors.length && !documents.length ? 'error' : errors.length ? 'partial' : 'ok',
      trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, startedAt, requestCount: candidates.length, focus }),
    });
  }
}

export { parseListing, extractArticleBody, titleFromDocument };
