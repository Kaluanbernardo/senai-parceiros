import { clearSessionCookie } from '../../server/lib/cookies.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
