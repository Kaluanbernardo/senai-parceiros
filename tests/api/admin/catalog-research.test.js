import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../server/routes/admin/catalog-research.js';
import { researchCatalogCandidates } from '../../../server/lib/catalogResearch.js';
import { catalogStore } from '../../../server/lib/catalogStore.js';
import { rateLimitStore } from '../../../server/lib/rateLimitStore.js';
import { usageStore } from '../../../server/lib/usageStore.js';
import * as usageBudget from '../../../server/lib/usageBudget.js';
import { createSessionToken } from '../../../server/lib/cookies.js';

vi.mock('../../../server/lib/catalogResearch.js', () => ({ researchCatalogCandidates: vi.fn() }));

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

function request(role = 'admin') {
  const token = createSessionToken({ username: 'user', role });
  return {
    method: 'POST',
    url: '/api/admin?action=catalog-research',
    headers: { cookie: `senai_session=${encodeURIComponent(token)}` },
    socket: { remoteAddress: 'catalog-research-test' },
    body: { category: 'organization', context: 'Referências de formação industrial', quantity: 1 },
  };
}

function researchedBatch() {
  const row = { schema_version: 'senai_catalog_v2', tipo_registro: 'organization', nome: 'Organização Nova', pais: 'Brasil' };
  return {
    category: 'organization',
    parsed: {
      schemaVersion: 'senai_catalog_v2',
      category: 'organization',
      headers: Object.keys(row),
      rows: [{ rowNumber: 1, row, record: { nome: 'Organização Nova', pais: 'Brasil', areas: [], fontes: [] }, valid: true, errors: [], hash: 'research-row-hash' }],
      errors: [],
      metadata: { origin: 'catalog_research' },
      filename: 'pesquisa-direta.json',
      rowCount: 1,
    },
    trace: { provider: 'openrouter', model: 'test/model', usage: { total_tokens: 80 }, webSearchRequests: 2 },
  };
}

afterEach(() => {
  vi.mocked(researchCatalogCandidates).mockReset();
  catalogStore.configure({ driver: 'memory' });
  rateLimitStore.configure({ driver: 'memory' });
  usageStore.configure({ driver: 'memory' });
});

describe('POST /api/admin/catalog-research', () => {
  it('creates a pending review batch without committing the researched record', async () => {
    vi.mocked(researchCatalogCandidates).mockResolvedValue(researchedBatch());
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      category: 'organization',
      counts: { total: 1, new: 1 },
      trace: { provider: 'openrouter', model: 'test/model', webSearchRequests: 2 },
    });
    expect(res.body.rows[0]).toMatchObject({ status: 'new', record: { nome: 'Organização Nova' } });
    expect(catalogStore.getRecords('organization')).toEqual([]);
    expect(catalogStore.getPending(res.body.batchId)).toBeTruthy();
  });

  it('does not expose research or catalog mutation to a regular user', async () => {
    const res = response();
    await handler(request('user'), res);
    expect(res.statusCode).toBe(403);
    expect(researchCatalogCandidates).not.toHaveBeenCalled();
  });

  it('reports missing OpenRouter configuration without creating a batch', async () => {
    vi.mocked(researchCatalogCandidates).mockRejectedValue(new Error('ai_not_configured'));
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'ai_unavailable', reason: 'ai_not_configured' });
    expect(catalogStore.getRecords('organization')).toEqual([]);
  });

  it('keeps a completed research result when usage accounting hits a store conflict', async () => {
    vi.mocked(researchCatalogCandidates).mockResolvedValue(researchedBatch());
    const accounting = vi.spyOn(usageBudget, 'recordAiUsageAtomic').mockRejectedValueOnce(new Error('store_conflict'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      category: 'organization',
      counts: { total: 1, new: 1 },
      usageRecorded: false,
    });
    expect(catalogStore.getPending(res.body.batchId)).toBeTruthy();
    expect(warning).toHaveBeenCalledWith('catalog_research_usage_record_failed', { code: 'store_conflict' });
    accounting.mockRestore();
    warning.mockRestore();
  });
});
