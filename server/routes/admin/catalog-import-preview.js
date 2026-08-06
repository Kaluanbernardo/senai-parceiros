import { requireSession } from '../../lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../lib/http.js';
import { getCatalog } from '../../lib/catalog.js';
import { flushCatalogStore, hydrateCatalogStore, parseCatalogWorkbook, previewCatalogImport } from '../../lib/catalogImport.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  try {
    await hydrateCatalogStore({ force: true });
    const payload = await readJson(req, 8 * 1024 * 1024);
    const parsed = await parseCatalogWorkbook(payload);
    const preview = previewCatalogImport(parsed, getCatalog(parsed.category));
    await flushCatalogStore();
    return res.status(200).json({
      batchId: preview.batchId,
      category: preview.category,
      filename: preview.filename,
      metadata: preview.metadata,
      counts: preview.counts,
      rows: preview.rows.map(({ rowNumber, status, match, errors, record, hash }) => ({ rowNumber, status, match, errors, record, hash })),
    });
  } catch (error) {
    const message = String(error?.message || 'invalid_import').slice(0, 500);
    return res.status(400).json({ error: message });
  }
}
