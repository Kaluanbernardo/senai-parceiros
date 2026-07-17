import { requireSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { flushCatalogStore, hydrateCatalogStore, rollbackCatalogImport } from '../../server/lib/catalogImport.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  try {
    await hydrateCatalogStore({ force: true });
    const payload = await readJson(req);
    if (!payload?.batchId) return res.status(400).json({ error: 'batch_id_required' });
    const result = rollbackCatalogImport(payload.batchId);
    await flushCatalogStore();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: String(error?.message || 'rollback_failed').slice(0, 300) });
  }
}
