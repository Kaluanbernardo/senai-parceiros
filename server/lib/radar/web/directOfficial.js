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
  constructor({ fetchImpl = globalThis.fetch, baseUrl = process.env.RADAR_DOU_BASE_URL || DEFAULT_BASE_URL, sections = process.env.RADAR_DOU_SECTIONS?.split(',') || ['DO1', 'DO3'], timeoutMs = 12000, maxDays = 3, concurrency = Number(process.env.RADAR_DOU_CONCURRENCY || 6), userAgent = 'senai-parceiros/1.0 radar-public-sources' } = {}) {
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
        items.push(...parseListing(result.value, editionUrl, iso, sectionFromUrl(editionUrl)));
      });
    }
    const unique = [...new Map(items.map((item) => [item.externalId, item])).values()].slice(0, Math.max(0, Number(maxResults) || 20));
    return createDiscoveryResult({
      items: unique,
      errors,
      provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL,
      status: errors.length && !unique.length ? 'error' : errors.length ? 'partial' : unique.length ? 'ok' : 'no_edition',
      trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.DIRECT_OFFICIAL, startedAt, requestCount: urls.length, query }),
    });
  }

  async retrieve({ urls = [], focus = 'educação profissional', signal } = {}) {
    const startedAt = new Date().toISOString();
    const documents = [];
    const errors = [];
    const candidates = [...new Set((Array.isArray(urls) ? urls : []).map((value) => String(value || '').trim()))].slice(0, 20);
    for (const candidate of candidates) {
      const url = normalizeHttpsUrl(candidate, { domains: ['in.gov.br'] });
      if (!url || !isDouUrl(url, { article: true })) {
        errors.push({ url: candidate, error: 'url_not_allowed' });
        continue;
      }
      try {
        const html = await this.requestText(url, { signal });
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
      } catch (error) {
        errors.push({ url, error: sanitizeProviderError(error, 'direct_official_fetch_failed') });
      }
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
