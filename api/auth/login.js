import { authenticate, completeLogin, isLoginRateLimited, recordLoginAttempt } from '../../server/lib/auth.js';
import { readJson, methodNotAllowed } from '../../server/lib/http.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (isLoginRateLimited(req)) return res.status(429).json({ error: 'too_many_attempts' });
  try {
    const { username, password } = await readJson(req);
    recordLoginAttempt(req);
    const identity = authenticate(username, password);
    if (!identity) return res.status(401).json({ error: 'invalid_credentials' });
    return res.status(200).json({ user: completeLogin(res, identity) });
  } catch {
    return res.status(400).json({ error: 'invalid_request' });
  }
}
