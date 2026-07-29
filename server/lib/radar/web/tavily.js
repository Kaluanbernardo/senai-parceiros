import { contentHash, createDiscoveryResult, createProviderTrace, createRetrievalResult, RADAR_PROVIDER_NAMES, sanitizeProviderError } from '../contracts.js';
import { isDouUrl, normalizeDomain, normalizeHttpsUrl, normalizeHostname, validateOfficialUrl } from './urlPolicy.js';

const DEFAULT_ENDPOINT = 'https://api.tavily.com';

function sourceNameFromUrl(url) {
  try { return normalizeHostname(new URL(url).hostname); } catch { return 'Fonte oficial'; }
}

function safeText(value, max = 12000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
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

export class TavilyWebProvider {
  constructor({ apiKey = process.env.TAVILY_API_KEY, endpoint = process.env.TAVILY_API_URL || DEFAULT_ENDPOINT, fetchImpl = globalThis.fetch, allowedDomains = ['in.gov.br', 'gov.br', 'sp.gov.br'], douOnly = false, timeoutMs = 15000, maxResults = Number(process.env.TAVILY_MAX_RESULTS || 20), searchDepth = process.env.TAVILY_SEARCH_DEPTH || 'advanced' } = {}) {
    this.apiKey = apiKey;
    this.endpoint = String(endpoint).replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.allowedDomains = allowedDomains;
    this.douOnly = Boolean(douOnly);
    this.timeoutMs = timeoutMs;
    this.maxResults = Math.min(50, Math.max(1, Number(maxResults) || 20));
    this.searchDepth = searchDepth;
  }

  assertConfigured() {
    if (!this.apiKey) {
      const error = new Error('tavily_not_configured');
      error.code = 'tavily_not_configured';
      throw error;
    }
  }

  async post(path, body, { signal } = {}) {
    this.assertConfigured();
    const request = withTimeout(signal, this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (!response?.ok) throw new Error(`tavily_http_${response?.status || 0}`);
      return await response.json();
    } finally {
      request.cleanup();
    }
  }

  validUrl(value, domains = this.allowedDomains) {
    const result = validateOfficialUrl(value, { domains });
    if (!result.ok) return '';
    const requested = Array.isArray(domains) ? domains : [domains];
    const onlyDou = this.douOnly || (requested.length > 0 && requested.every((domain) => normalizeDomain(domain) === 'in.gov.br'));
    return onlyDou && !isDouUrl(result.url, { article: true }) ? '' : result.url;
  }

  async discover({ query = 'educação profissional formação técnica aprendizagem industrial', domains = this.allowedDomains, startDate, endDate, maxResults = this.maxResults, signal } = {}) {
    const startedAt = new Date().toISOString();
    const requestedDomains = Array.isArray(domains) && domains.length ? domains : this.allowedDomains;
    const includeDomains = [...new Set((Array.isArray(requestedDomains) ? requestedDomains : [requestedDomains]).map(normalizeDomain).filter(Boolean))];
    const body = {
      api_key: this.apiKey,
      query: String(query).slice(0, 1000),
      search_depth: this.searchDepth,
      max_results: Math.min(this.maxResults, Math.max(1, Number(maxResults) || this.maxResults)),
      include_domains: includeDomains,
      include_answer: false,
      include_raw_content: false,
      ...(startDate ? { start_date: String(startDate).slice(0, 10) } : {}),
      ...(endDate ? { end_date: String(endDate).slice(0, 10) } : {}),
    };
    try {
      const payload = await this.post('/search', body, { signal });
      const items = (Array.isArray(payload?.results) ? payload.results : []).map((result, index) => {
        const sourceUrl = this.validUrl(result?.url, includeDomains);
        if (!sourceUrl) return null;
        const title = safeText(result?.title, 280);
        return {
          externalId: `tavily:${sourceUrl}`,
          sourceName: sourceNameFromUrl(sourceUrl),
          sourceUrl,
          title: title || sourceUrl,
          summaryPt: safeText(result?.content || result?.raw_content, 900),
          publishedAt: result?.published_date ? String(result.published_date).slice(0, 10) : null,
          contentType: 'página oficial',
          official: true,
          provider: RADAR_PROVIDER_NAMES.TAVILY,
          provenance: { searchQuery: body.query, discoveredAt: new Date().toISOString(), searchResultIndex: index },
        };
      }).filter(Boolean).slice(0, body.max_results);
      return createDiscoveryResult({ items, provider: RADAR_PROVIDER_NAMES.TAVILY, status: items.length ? 'ok' : 'no_results', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.TAVILY, startedAt, requestCount: 1, query: body.query }) });
    } catch (error) {
      return createDiscoveryResult({ provider: RADAR_PROVIDER_NAMES.TAVILY, errors: [{ error: sanitizeProviderError(error, 'tavily_search_failed') }], status: 'error', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.TAVILY, startedAt, requestCount: 1, query: body.query }) });
    }
  }

  async retrieve({ urls = [], focus = 'educação profissional', signal } = {}) {
    const startedAt = new Date().toISOString();
    const unique = [...new Set((Array.isArray(urls) ? urls : []).map((url) => this.validUrl(url)).filter(Boolean))].slice(0, this.maxResults);
    const rejected = (Array.isArray(urls) ? urls : []).filter((url) => !this.validUrl(url)).map((url) => ({ url, error: 'url_not_allowed' }));
    if (!unique.length) return createRetrievalResult({ provider: RADAR_PROVIDER_NAMES.TAVILY, errors: rejected, status: rejected.length ? 'error' : 'no_urls', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.TAVILY, startedAt, requestCount: 0, focus }) });
    try {
      const payload = await this.post('/extract', { api_key: this.apiKey, urls: unique, include_images: false }, { signal });
      const byUrl = new Map((Array.isArray(payload?.results) ? payload.results : []).map((result) => [this.validUrl(result?.url), result]));
      const documents = unique.map((url) => {
        const result = byUrl.get(url);
        if (!result) return null;
        return {
          externalId: `tavily:${url}`,
          sourceName: sourceNameFromUrl(url),
          sourceUrl: url,
          title: safeText(result.title || url, 280),
          content: safeText(result.raw_content || result.content, 12000),
          publishedAt: result.published_date ? String(result.published_date).slice(0, 10) : null,
          official: true,
          provider: RADAR_PROVIDER_NAMES.TAVILY,
          focus,
          provenance: { extractedAt: new Date().toISOString(), extractionProvider: RADAR_PROVIDER_NAMES.TAVILY, contentHash: contentHash(result.raw_content || result.content) },
        };
      }).filter(Boolean);
      return createRetrievalResult({ documents, errors: rejected, provider: RADAR_PROVIDER_NAMES.TAVILY, status: rejected.length ? 'partial' : 'ok', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.TAVILY, startedAt, requestCount: 1, focus }) });
    } catch (error) {
      return createRetrievalResult({ documents: [], errors: [...rejected, { error: sanitizeProviderError(error, 'tavily_extract_failed') }], provider: RADAR_PROVIDER_NAMES.TAVILY, status: 'error', trace: createProviderTrace({ provider: RADAR_PROVIDER_NAMES.TAVILY, startedAt, requestCount: 1, focus }) });
    }
  }
}
