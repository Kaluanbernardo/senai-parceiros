import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, readJson, requireSameOrigin } from '../../lib/http.js';
import {
  commitCatalogEnrichment,
  getCatalogEnrichmentOverview,
  processCatalogEnrichment,
  retryCatalogEnrichment,
  startCatalogEnrichment,
} from '../../lib/catalogEnrichment.js';
import { flushCatalogStore, hydrateCatalogStore } from '../../lib/catalogImport.js';
import { flushUsageBudget, hydrateUsageBudget } from '../../lib/usageBudget.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  if (req.method === 'POST' && !requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  try {
    await Promise.all([hydrateCatalogStore({ force: true }), hydrateUsageBudget({ force: true })]);
    if (req.method === 'GET') return res.status(200).json(getCatalogEnrichmentOverview());

    const payload = await readJson(req);
    let result;
    if (payload?.action === 'start') result = startCatalogEnrichment();
    else if (payload?.action === 'process') result = await processCatalogEnrichment(payload.batchId);
    else if (payload?.action === 'retry') result = retryCatalogEnrichment(payload.batchId);
    else if (payload?.action === 'commit') result = commitCatalogEnrichment(payload.batchId);
    else return res.status(400).json({ error: 'invalid_enrichment_action' });
    await Promise.all([flushCatalogStore(), flushUsageBudget()]);
    return res.status(200).json(result);
  } catch (error) {
    const code = String(error?.message || 'catalog_enrichment_failed').slice(0, 100);
    const status = code === 'budget_exceeded' || code === 'catalog_search_not_configured' || code === 'ai_not_configured' ? 503
      : code === 'enrichment_source_changed' || code === 'enrichment_commit_quality_failed' ? 409
        : 400;
    return res.status(status).json({ error: code });
  }
}
