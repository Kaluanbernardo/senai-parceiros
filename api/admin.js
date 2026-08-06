import catalogImportBatches from '../server/routes/admin/catalog-import-batches.js';
import catalogImportCommit from '../server/routes/admin/catalog-import-commit.js';
import catalogImportPreview from '../server/routes/admin/catalog-import-preview.js';
import catalogImportRollback from '../server/routes/admin/catalog-import-rollback.js';
import adminStatus from '../server/routes/admin/status.js';
import adminAiCheck from '../server/routes/admin/ai-check.js';

const handlers = {
  'catalog-import-batches': catalogImportBatches,
  'catalog-import-commit': catalogImportCommit,
  'catalog-import-preview': catalogImportPreview,
  'catalog-import-rollback': catalogImportRollback,
  status: adminStatus,
  'ai-check': adminAiCheck,
};

export default async function handler(req, res) {
  const action = new URL(req.url || '/api/admin', 'http://localhost').searchParams.get('action');
  const routeHandler = handlers[action];
  if (!routeHandler) return res.status(404).json({ error: 'not_found' });
  return routeHandler(req, res);
}
