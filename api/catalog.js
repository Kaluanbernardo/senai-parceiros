import { requireSession } from '../server/lib/cookies.js';
import { methodNotAllowed } from '../server/lib/http.js';
import { getImportedRecords, hydrateCatalogStore, getCatalogStoreStatus } from '../server/lib/catalogImport.js';

// Returns only records added through the durable catalog store. The client
// already ships with the reviewed seed catalog and merges these records into
// it after authentication, so the endpoint never duplicates the seed payload.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res);
  const session = requireSession(req, res);
  if (!session) return;
  await hydrateCatalogStore({ force: true });
  return res.status(200).json({
    records: {
      person: getImportedRecords('person'),
      organization: getImportedRecords('organization'),
    },
    store: getCatalogStoreStatus(),
  });
}
