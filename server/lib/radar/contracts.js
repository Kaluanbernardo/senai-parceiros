import { createHash } from 'node:crypto';

/**
 * Contracts shared by Radar source adapters.
 *
 * Adapters deliberately return plain data.  The Radar domain can therefore
 * switch from direct HTTP to a hosted collector (or Azure) without changing
 * the shape consumed by the pipeline.
 */

export const RADAR_PROVIDER_NAMES = Object.freeze({
  DIRECT_OFFICIAL: 'direct-official',
  TAVILY: 'tavily',
});

export function createProviderTrace({ provider, startedAt = new Date().toISOString(), requestCount = 0, ...rest } = {}) {
  return {
    provider: String(provider || 'unknown'),
    startedAt,
    finishedAt: new Date().toISOString(),
    requestCount: Number.isFinite(Number(requestCount)) ? Number(requestCount) : 0,
    ...rest,
  };
}

export function createDiscoveryResult({ items = [], errors = [], provider, trace, status = 'ok', diagnostics = null } = {}) {
  return {
    items: Array.isArray(items) ? items : [],
    errors: Array.isArray(errors) ? errors : [],
    provider: String(provider || trace?.provider || 'unknown'),
    status: String(status || 'ok'),
    // Counts only; never page content. Zero items with zero parsed anchors is a
    // different failure from zero items in a page that parsed fine.
    diagnostics: diagnostics && typeof diagnostics === 'object' ? { ...diagnostics } : null,
    trace: trace || createProviderTrace({ provider }),
  };
}

export function createRetrievalResult({ documents = [], errors = [], provider, trace, status = 'ok' } = {}) {
  const normalizedDocuments = Array.isArray(documents) ? documents : [];
  return {
    documents: normalizedDocuments,
    // Compatibility alias for pipelines that handle discovery and retrieval
    // results through a single `items` collection.
    items: normalizedDocuments,
    errors: Array.isArray(errors) ? errors : [],
    provider: String(provider || trace?.provider || 'unknown'),
    status: String(status || 'ok'),
    trace: trace || createProviderTrace({ provider }),
  };
}

export function sanitizeProviderError(error, fallback = 'provider_error') {
  const value = error instanceof Error ? error.message : String(error || '');
  // Never expose request bodies, authorization headers, or arbitrary provider
  // responses in operational status or a user-facing API response.
  //
  // Providers raise codes (`direct_official_http_403`), but the runtime raises
  // prose ("This operation was aborted"). Taking the leading token of prose
  // yielded labels like "this", which name nothing and hid a plain timeout, so
  // only a message that is entirely code-shaped is passed through.
  const code = value.match(/^[a-z][a-z0-9_-]{2,64}$/i)?.[0];
  if (code) return code.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  if (/abort|timed?\s*out|timeout/i.test(value)) return 'timeout';
  if (/network|fetch failed|econnreset|socket|dns/i.test(value)) return 'network_error';
  return fallback;
}

export function contentHash(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}
