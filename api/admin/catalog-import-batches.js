import { requireSession } from '../../server/lib/cookies.js';
import { methodNotAllowed } from '../../server/lib/http.js';
import { hydrateCatalogStore, listImportBatches, getCatalogStoreStatus } from '../../server/lib/catalogImport.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res);
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  await hydrateCatalogStore({ force: true });
  return res.status(200).json({ batches: listImportBatches(), store: getCatalogStoreStatus() });
}
