import { getSession } from '../../server/lib/cookies.js';
import { authenticateEntraToken } from '../../server/lib/entra.js';
import { completeLogin, getAuthProvider } from '../../server/lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  let session = getSession(req);
  if (!session && getAuthProvider() === 'entra' && String(process.env.ENTRA_TRUST_PROXY_HEADERS).toLowerCase() === 'true') {
    const proxyToken = String(req.headers?.['x-ms-token-aad-id-token'] || '').trim();
    if (proxyToken) {
      try {
        const identity = await authenticateEntraToken(proxyToken);
        completeLogin(res, identity);
        session = identity;
      } catch {
        return res.status(401).json({ authenticated: false, user: null, error: 'invalid_corporate_token' });
      }
    }
  }
  return res.status(200).json({ authenticated: Boolean(session), provider: getAuthProvider(), user: session ? { username: session.username, role: session.role } : null });
}
