import { consumeCatalogResearchAttempt, flushRateLimitStore, hydrateRateLimitStore } from '../../lib/auth.js';
import { getCatalog } from '../../lib/catalog.js';
import { flushCatalogStore, hydrateCatalogStore, previewCatalogImport } from '../../lib/catalogImport.js';
import { researchCatalogCandidates } from '../../lib/catalogResearch.js';
import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, readJson, requireSameOrigin } from '../../lib/http.js';
import { canUseAi, hydrateUsageBudget, recordAiUsageAtomic } from '../../lib/usageBudget.js';

const TIMEOUT_MS = 55_000;

function safeTrace(trace = {}) {
  return {
    provider: trace.provider || '',
    model: trace.model || '',
    webSearchRequests: Number(trace.webSearchRequests || 0),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await Promise.all([
      hydrateCatalogStore({ force: true }),
      hydrateRateLimitStore({ force: true }),
      hydrateUsageBudget({ force: true }),
    ]);
    const limited = await consumeCatalogResearchAttempt(req, session);
    await flushRateLimitStore();
    if (limited) return res.status(429).json({ error: 'too_many_research_attempts' });
    if (!canUseAi('catalog_research')) return res.status(429).json({ error: 'ai_budget_exceeded' });

    const payload = await readJson(req, 32 * 1024);
    const researched = await researchCatalogCandidates(payload, { signal: controller.signal });
    let usageRecorded = true;
    try {
      await recordAiUsageAtomic('catalog_research', researched.trace.usage || null);
    } catch (error) {
      usageRecorded = false;
      console.warn('catalog_research_usage_record_failed', {
        code: String(error?.message || 'store_update_failed').slice(0, 100),
      });
    }
    const preview = previewCatalogImport(researched.parsed, getCatalog(researched.category));
    await flushCatalogStore();

    return res.status(200).json({
      batchId: preview.batchId,
      category: preview.category,
      counts: preview.counts,
      trace: safeTrace(researched.trace),
      usageRecorded,
      rows: preview.rows.map(({ rowNumber, status, match, errors, record, hash }) => ({ rowNumber, status, match, errors, record, hash })),
    });
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
    if (error?.name === 'AbortError') return res.status(504).json({ error: 'ai_unavailable', reason: 'provider_timeout' });
    if (message.startsWith('store_') || message === 'atomic_lock_timeout') return res.status(503).json({ error: 'research_store_unavailable' });
    return res.status(502).json({ error: 'catalog_research_failed', reason: message });
  } finally {
    clearTimeout(timeout);
  }
}
