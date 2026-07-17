import crypto from 'node:crypto';
import { getSession } from '../../server/lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { refreshRadarSnapshot, getRadarStoreStatus } from '../../server/lib/radar.js';

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hasCronSecret(req) {
  const configured = process.env.RADAR_CRON_SECRET || process.env.CRON_SECRET;
  const authorization = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(configured && safeEqual(authorization, configured));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  const session = getSession(req);
  const authorized = hasCronSecret(req) || session?.role === 'admin';
  if (!authorized) return res.status(401).json({ error: 'authentication_required' });
  if (session?.role === 'admin' && !hasCronSecret(req) && !requireSameOrigin(req, res)) return;
  const startedAt = Date.now();
  const result = await refreshRadarSnapshot();
  return res.status(result.refreshed ? 200 : 503).json({
    refreshed: Boolean(result.refreshed),
    stale: Boolean(result.stale),
    durationMs: Date.now() - startedAt,
    lastRun: result.lastRun || getRadarStoreStatus().lastRun,
    store: getRadarStoreStatus(),
  });
}
