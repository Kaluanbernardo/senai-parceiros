import crypto from 'node:crypto';
import { getSession } from '../../server/lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { refreshRadarEditorials, refreshRadarSnapshot, getRadarStoreStatus } from '../../server/lib/radar.js';
import { emitOperationalAlert } from '../../server/lib/alerts.js';

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
  // Collecting ten external sources consumes almost the whole function budget
  // before the editorial pass gets a turn, so rewriting has to be runnable on
  // its own. It touches no source: it reads the stored snapshot, rewrites what
  // is still showing the source's wording and writes it back.
  const mode = new URL(req.url || '/api/radar/refresh', 'http://localhost').searchParams.get('mode');
  if (mode === 'editorial') {
    const editorial = await refreshRadarEditorials();
    const status = editorial.refreshed ? 200 : editorial.error === 'radar_editorial_budget_exceeded' ? 429 : 503;
    return res.status(status).json(editorial);
  }
  const startedAt = Date.now();
  let result;
  try {
    result = await refreshRadarSnapshot({ includeAi: mode !== 'collection' });
  } catch (error) {
    await emitOperationalAlert('radar_refresh_failed', { severity: 'critical', details: { status: 'error', driver: getRadarStoreStatus().driver } });
    // Returning the run and its cause is what makes this branch diagnosable:
    // the bare `radar_refresh_failed` left the operator with a failure that
    // pointed at nothing at all.
    const status = getRadarStoreStatus();
    return res.status(503).json({
      refreshed: false,
      stale: true,
      error: String(error?.message || 'radar_refresh_failed').slice(0, 160),
      lastRun: status.lastRun || { status: 'failed', error: String(error?.message || 'radar_refresh_failed').slice(0, 160), sourceStatus: {} },
      store: status,
    });
  }
  if (!result.refreshed || result.stale) {
    await emitOperationalAlert('radar_snapshot_stale', { severity: result.stale ? 'warning' : 'critical', details: { status: result.lastRun?.status || 'stale', driver: getRadarStoreStatus().driver } });
  }
  return res.status(result.refreshed ? 200 : 503).json({
    refreshed: Boolean(result.refreshed),
    stale: Boolean(result.stale),
    durationMs: Date.now() - startedAt,
    lastRun: result.lastRun || getRadarStoreStatus().lastRun,
    store: getRadarStoreStatus(),
  });
}
