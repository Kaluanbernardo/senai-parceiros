import { requireSession } from '../../lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../lib/http.js';
import { commitCatalogImport, flushCatalogStore, hydrateCatalogStore } from '../../lib/catalogImport.js';
import { getCatalog } from '../../lib/catalog.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  try {
    await hydrateCatalogStore({ force: true });
    const payload = await readJson(req);
    if (!payload?.batchId || !payload?.decisions || typeof payload.decisions !== 'object') return res.status(400).json({ error: 'invalid_import_commit' });
    const batch = commitCatalogImport(payload.batchId, payload.decisions);
    await flushCatalogStore();
    return res.status(200).json({
      batchId: batch.batchId,
      category: batch.category,
      applied: batch.applied,
      ignored: batch.ignored,
      conflicts: batch.conflicts,
      records: batch.appliedRecords || [],
      catalog: getCatalog(batch.category),
      committedAt: batch.committedAt,
    });
  } catch (error) {
    return res.status(400).json({ error: String(error?.message || 'invalid_import_commit').slice(0, 300) });
  }
}
