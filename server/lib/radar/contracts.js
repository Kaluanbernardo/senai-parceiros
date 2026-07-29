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

export function createDiscoveryResult({ items = [], errors = [], provider, trace, status = 'ok' } = {}) {
  return {
    items: Array.isArray(items) ? items : [],
    errors: Array.isArray(errors) ? errors : [],
    provider: String(provider || trace?.provider || 'unknown'),
    status: String(status || 'ok'),
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
  const code = value.match(/^[a-z][a-z0-9_-]{2,64}/i)?.[0] || fallback;
  return code.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

export function contentHash(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}
