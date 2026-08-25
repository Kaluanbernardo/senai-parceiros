import { consumeCatalogResearchAttempt, flushRateLimitStore, hydrateRateLimitStore } from '../../lib/auth.js';
import { getCatalog } from '../../lib/catalog.js';
import { catalogStore } from '../../lib/catalogStore.js';
import { flushCatalogStore, hydrateCatalogStore, listPendingResearchBatches, previewCatalogImport } from '../../lib/catalogImport.js';
import { researchCatalogCandidates } from '../../lib/catalogResearch.js';
import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, readJson, requireSameOrigin } from '../../lib/http.js';
import { canUseAi, hydrateUsageBudget, recordAiUsageAtomic } from '../../lib/usageBudget.js';

function researchTimeoutMs() {
  return Math.max(60_000, Math.min(280_000, Number(process.env.CATALOG_RESEARCH_TIMEOUT_MS) || 180_000));
}

function safeTrace(trace = {}) {
  return {
    provider: trace.provider || '',
    model: trace.model || '',
    webSearchRequests: Number(trace.webSearchRequests || 0),
  };
}

function isAbortError(error) {
  return error?.name === 'AbortError'
    || error?.name === 'TimeoutError'
    || /\baborted\b/i.test(String(error?.message || ''));
}

function responseForPreview(preview, trace = {}, usageRecorded = true) {
  return {
    batchId: preview.batchId,
    category: preview.category,
    counts: preview.counts,
    researchRequest: preview.metadata?.researchRequest || null,
    trace: safeTrace(trace),
    usageRecorded,
    rows: preview.rows.map(({ rowNumber, status, match, errors, record, hash }) => ({ rowNumber, status, match, errors, record, hash })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  const session = requireSession(req, res, ['admin']);
  if (!session) return;

  if (req.method === 'GET') {
    await Promise.all([hydrateCatalogStore({ force: true }), hydrateRateLimitStore({ force: true })]);
    return res.status(200).json({
      pending: listPendingResearchBatches().map((preview) => responseForPreview(preview, preview.metadata?.trace || {}, true)),
    });
  }
  if (!requireSameOrigin(req, res)) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), researchTimeoutMs());
  try {
    await Promise.all([
      hydrateCatalogStore({ force: true }),
      hydrateRateLimitStore({ force: true }),
      hydrateUsageBudget({ force: true }),
    ]);
    const payload = await readJson(req, 32 * 1024);
    const requestedRunId = String(payload?.researchRunId || '').trim();
    const requestedBatchIndex = Number(payload?.batchIndex || 0);
    if (requestedRunId) {
      const pending = listPendingResearchBatches().find((batch) => (
        batch.metadata?.researchRequest?.researchRunId === requestedRunId
        && Number(batch.metadata?.researchRequest?.batchIndex || 0) === requestedBatchIndex
      ));
      if (pending) return res.status(200).json(responseForPreview(pending, pending.metadata?.trace || {}, true));
    }
    const limited = await consumeCatalogResearchAttempt(req, session);
    await flushRateLimitStore();
    if (limited) return res.status(429).json({ error: 'too_many_research_attempts' });
    if (!canUseAi('catalog_research')) return res.status(429).json({ error: 'ai_budget_exceeded' });

    const researched = await researchCatalogCandidates(payload, { signal: controller.signal });
    let usageRecorded = true;
    try {
      const usages = Array.isArray(researched.trace.usages) && researched.trace.usages.length
        ? researched.trace.usages
        : [researched.trace.usage || null];
      for (const usage of usages) await recordAiUsageAtomic('catalog_research', usage, researched.trace?.model);
    } catch (error) {
      usageRecorded = false;
      console.warn('catalog_research_usage_record_failed', {
        code: String(error?.message || 'store_update_failed').slice(0, 100),
      });
    }
    const preview = previewCatalogImport(researched.parsed, getCatalog(researched.category));
    preview.metadata = {
      ...preview.metadata,
      trace: safeTrace(researched.trace),
      researchRequest: preview.metadata?.researchRequest || { ...payload, category: researched.category },
    };
    const pendingResearch = { ...preview, metadata: { ...preview.metadata, origin: 'catalog_research' } };
    catalogStore.setPending(pendingResearch);
    await flushCatalogStore();

    return res.status(200).json(responseForPreview(pendingResearch, researched.trace, usageRecorded));
  } catch (error) {
    const message = String(error?.message || 'catalog_research_failed').slice(0, 100);
    console.error('catalog_research_failed', {
      code: message,
      status: Number(error?.status || 0) || undefined,
      provider: String(error?.providerMessage || '').replace(/\s+/g, ' ').slice(0, 300) || undefined,
    });
    if (/^(invalid_research_|research_.*_(required|too_long))/.test(message)) {
      return res.status(400).json({ error: message });
    }
    if (message === 'ai_not_configured') return res.status(503).json({ error: 'ai_unavailable', reason: message });
    if (message === 'budget_exceeded') return res.status(429).json({ error: 'ai_budget_exceeded' });
    if (isAbortError(error)) return res.status(504).json({ error: 'ai_unavailable', reason: 'provider_timeout' });
    if (message.startsWith('store_') || message === 'atomic_lock_timeout') return res.status(503).json({ error: 'research_store_unavailable' });
    return res.status(502).json({ error: 'catalog_research_failed', reason: message });
  } finally {
    clearTimeout(timeout);
  }
}
