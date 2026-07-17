import { authenticateEntraToken } from '../../server/lib/entra.js';
import { completeLogin, consumeLoginAttempt, getAuthProvider, hydrateRateLimitStore } from '../../server/lib/auth.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  if (getAuthProvider() !== 'entra') return res.status(404).json({ error: 'corporate_identity_login_disabled' });
  await hydrateRateLimitStore({ force: true });
  try {
    const { token } = await readJson(req);
    if (await consumeLoginAttempt(req)) return res.status(429).json({ error: 'too_many_attempts' });
    const identity = await authenticateEntraToken(token);
    return res.status(200).json({ user: completeLogin(res, identity) });
  } catch (error) {
    const safeErrors = new Set(['entra_adapter_not_configured', 'entra_jwks_unavailable', 'entra_jwks_empty', 'entra_fetch_unavailable']);
    if (String(error?.message || '').startsWith('store_') || error?.message === 'atomic_lock_timeout') return res.status(503).json({ error: 'rate_limit_unavailable' });
    if (safeErrors.has(error?.message)) return res.status(503).json({ error: 'corporate_identity_provider_unavailable' });
    return res.status(401).json({ error: 'invalid_corporate_token' });
  }
}
