import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../server/routes/admin/catalog-enrichment.js';
import { catalogStore } from '../../../server/lib/catalogStore.js';
import { usageStore } from '../../../server/lib/usageStore.js';
import { processCatalogEnrichment } from '../../../server/lib/catalogEnrichment.js';
import { createSessionToken } from '../../../server/lib/cookies.js';

vi.mock('../../../server/lib/catalogEnrichment.js', () => ({
  commitCatalogEnrichment: vi.fn(),
  getCatalogEnrichmentOverview: vi.fn(),
  processCatalogEnrichment: vi.fn(),
  retryCatalogEnrichment: vi.fn(),
  skipCatalogEnrichmentTarget: vi.fn(),
  startCatalogEnrichment: vi.fn(),
}));

process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request() {
  const token = createSessionToken({ username: 'user', role: 'admin' });
  return {
    method: 'POST',
    url: '/api/admin?action=catalog-enrichment',
    headers: { cookie: `senai_session=${encodeURIComponent(token)}` },
    body: { action: 'process', batchId: 'enrich-test' },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(processCatalogEnrichment).mockReset();
  catalogStore.configure({ driver: 'memory' });
  usageStore.configure({ driver: 'memory' });
});

describe('POST /api/admin/catalog-enrichment', () => {
  it('classifies an abort during persistence as a provider timeout', async () => {
    vi.mocked(processCatalogEnrichment).mockResolvedValue({
      batchId: 'enrich-test',
      counts: { total: 1, pending: 1, passed: 0 },
      next: { key: 'organization:1', name: 'Instituto' },
    });
    vi.spyOn(catalogStore, 'flush').mockRejectedValueOnce(new Error('This operation was aborted'));
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({ error: 'provider_timeout' });
  });
});
