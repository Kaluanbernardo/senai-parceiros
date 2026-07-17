import { requireSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed } from '../../server/lib/http.js';
import { rollbackCatalogImport } from '../../server/lib/catalogImport.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  try {
    const payload = await readJson(req);
    if (!payload?.batchId) return res.status(400).json({ error: 'batch_id_required' });
    return res.status(200).json(rollbackCatalogImport(payload.batchId));
  } catch (error) {
    return res.status(400).json({ error: String(error?.message || 'rollback_failed').slice(0, 300) });
  }
}
