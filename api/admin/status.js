import { requireSession } from '../../server/lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { getOperationalStatus } from '../../server/lib/operationalStatus.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  return res.status(200).json(getOperationalStatus());
}
