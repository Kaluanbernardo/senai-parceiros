import { authenticate, completeLogin, consumeLoginAttempt, getAuthProvider, hydrateRateLimitStore } from '../../server/lib/auth.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  if (getAuthProvider() !== 'local') return res.status(503).json({ error: 'corporate_identity_provider_not_configured' });
  await hydrateRateLimitStore({ force: true });
  try {
    const { username, password } = await readJson(req);
    if (await consumeLoginAttempt(req)) return res.status(429).json({ error: 'too_many_attempts' });
    const identity = authenticate(username, password);
    if (!identity) return res.status(401).json({ error: 'invalid_credentials' });
    return res.status(200).json({ user: completeLogin(res, identity) });
  } catch (error) {
    if (String(error?.message || '').startsWith('store_') || error?.message === 'atomic_lock_timeout') return res.status(503).json({ error: 'rate_limit_unavailable' });
    return res.status(400).json({ error: 'invalid_request' });
  }
}
