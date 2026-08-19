import catalogImportBatches from '../server/routes/admin/catalog-import-batches.js';
import catalogImportCommit from '../server/routes/admin/catalog-import-commit.js';
import catalogImportPreview from '../server/routes/admin/catalog-import-preview.js';
import catalogImportRollback from '../server/routes/admin/catalog-import-rollback.js';
import catalogResearch from '../server/routes/admin/catalog-research.js';
import adminStatus from '../server/routes/admin/status.js';
import adminAiCheck from '../server/routes/admin/ai-check.js';
import catalogEnrichment from '../server/routes/admin/catalog-enrichment.js';
import aiUsage from '../server/routes/admin/ai-usage.js';

const handlers = {
  'catalog-import-batches': catalogImportBatches,
  'catalog-import-commit': catalogImportCommit,
  'catalog-import-preview': catalogImportPreview,
  'catalog-import-rollback': catalogImportRollback,
  'catalog-enrichment': catalogEnrichment,
  'catalog-research': catalogResearch,
  status: adminStatus,
  'ai-check': adminAiCheck,
  'ai-usage': aiUsage,
};

export default async function handler(req, res) {
  const action = new URL(req.url || '/api/admin', 'http://localhost').searchParams.get('action');
  const routeHandler = handlers[action];
  if (!routeHandler) return res.status(404).json({ error: 'not_found' });
  return routeHandler(req, res);
}
