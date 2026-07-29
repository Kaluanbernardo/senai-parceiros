import catalogImportBatches from '../../server/routes/admin/catalog-import-batches.js';
import catalogImportCommit from '../../server/routes/admin/catalog-import-commit.js';
import catalogImportPreview from '../../server/routes/admin/catalog-import-preview.js';
import catalogImportRollback from '../../server/routes/admin/catalog-import-rollback.js';
import adminStatus from '../../server/routes/admin/status.js';

const handlers = {
  'catalog-import-batches': catalogImportBatches,
  'catalog-import-commit': catalogImportCommit,
  'catalog-import-preview': catalogImportPreview,
  'catalog-import-rollback': catalogImportRollback,
  status: adminStatus,
};

export default async function handler(req, res) {
  const pathname = new URL(req.url || '/api/admin/', 'http://localhost').pathname;
  const action = pathname.split('/').filter(Boolean).at(-1);
  const routeHandler = handlers[action];

  if (!routeHandler) return res.status(404).json({ error: 'not_found' });
  return routeHandler(req, res);
}
