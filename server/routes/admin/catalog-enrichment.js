import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, readJson, requireSameOrigin } from '../../lib/http.js';
import {
  commitCatalogEnrichment,
  getCatalogEnrichmentOverview,
  processCatalogEnrichment,
  retryCatalogEnrichment,
  skipCatalogEnrichmentTarget,
  startCatalogEnrichment,
} from '../../lib/catalogEnrichment.js';
import { flushCatalogStore, hydrateCatalogStore } from '../../lib/catalogImport.js';
import { flushUsageBudget, hydrateUsageBudget } from '../../lib/usageBudget.js';

let enrichmentQueue = Promise.resolve();

function withEnrichmentLock(task) {
  const previous = enrichmentQueue;
  let release;
  enrichmentQueue = new Promise((resolve) => { release = resolve; });
  return previous.catch(() => {}).then(task).finally(release);
}

function namedStoreError(code, status = 503) {
  const error = new Error(code);
  error.status = status;
  error.retryable = true;
  return error;
}

async function hydrateStores() {
  try {
    const [catalog, usage] = await Promise.all([
      hydrateCatalogStore({ force: true }),
      hydrateUsageBudget({ force: true }),
    ]);
    if (catalog?.lastError) throw namedStoreError('catalog_store_hydrate_failed');
    if (usage?.lastError) throw namedStoreError('usage_store_hydrate_failed');
  } catch (error) {
    if (error?.message?.endsWith('_hydrate_failed')) throw error;
    throw namedStoreError('catalog_store_hydrate_failed');
  }
}

async function flushStores() {
  try {
    const catalog = await flushCatalogStore();
    if (catalog?.lastError) {
      throw namedStoreError(catalog.lastError, catalog.lastError === 'catalog_store_conflict' ? 409 : 503);
    }
  } catch (error) {
    if (error?.message === 'catalog_store_conflict') throw error;
    throw namedStoreError('catalog_store_flush_failed');
  }
  try {
    const usage = await flushUsageBudget();
    if (usage?.lastError) throw namedStoreError('usage_store_flush_failed');
  } catch (error) {
    if (error?.message === 'usage_store_flush_failed') throw error;
    throw namedStoreError('usage_store_flush_failed');
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  if (req.method === 'POST' && !requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  return withEnrichmentLock(async () => {
    let action = req.method === 'GET' ? 'overview' : '';
    let batchId = '';
    try {
      await hydrateStores();
      if (req.method === 'GET') return res.status(200).json(getCatalogEnrichmentOverview());

      const payload = await readJson(req);
      action = String(payload?.action || '');
      batchId = String(payload?.batchId || '');
      let result;
      if (action === 'start') result = startCatalogEnrichment({ targetKeys: payload.targetKeys });
      else if (action === 'process') result = await processCatalogEnrichment(payload.batchId, { expectedRevision: payload.revision });
      else if (action === 'retry') result = retryCatalogEnrichment(payload.batchId, { expectedRevision: payload.revision });
      else if (action === 'skip') result = skipCatalogEnrichmentTarget(payload.batchId, payload.targetKey, { expectedRevision: payload.revision });
      else if (action === 'commit') result = commitCatalogEnrichment(payload.batchId, { expectedRevision: payload.revision });
      else return res.status(400).json({ error: 'invalid_enrichment_action' });
      await flushStores();
      return res.status(200).json(result);
    } catch (error) {
      const code = String(error?.message || 'catalog_enrichment_failed').slice(0, 100);
      console.error('catalog_enrichment_failed', {
        code,
        action,
        batchId: batchId || undefined,
        stage: error?.stage || undefined,
        status: Number(error?.status || 0) || undefined,
        provider: String(error?.providerMessage || '').replace(/\s+/g, ' ').slice(0, 300) || undefined,
      });
      const status = Number(error?.status || 0) || (
        code === 'provider_timeout' || code === 'catalog_search_timeout' ? 504
          : code === 'budget_exceeded' || code === 'catalog_search_not_configured' || code === 'ai_not_configured'
            || code.endsWith('_hydrate_failed') || code.endsWith('_flush_failed') ? 503
            : code === 'catalog_store_conflict' || code === 'enrichment_source_changed' || code === 'enrichment_commit_quality_failed' ? 409
              : 400
      );
      return res.status(status).json({ error: code });
    }
  });
}
