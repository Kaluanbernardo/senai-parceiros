import { getSession } from '../../server/lib/cookies.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const session = getSession(req);
  return res.status(200).json({ authenticated: Boolean(session), user: session ? { username: session.username, role: session.role } : null });
}
