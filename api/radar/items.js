import { getSession } from '../../server/lib/cookies.js';
import { getRadarItems, getRadarFeedPolicy, getRadarFeedReadiness, RADAR_SECTIONS, RADAR_SOURCE_POLICY, RADAR_WEB_POLICY } from '../../server/lib/radar.js';
import { consumeRadarAttempt, hydrateRateLimitStore } from '../../server/lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'authentication_required' });
  await hydrateRateLimitStore({ force: true });
  const url = new URL(req.url || '/api/radar/items', 'http://localhost');
  const section = url.searchParams.get('section') || undefined;
  if (section && !RADAR_SECTIONS.includes(section)) return res.status(400).json({ error: 'invalid_radar_section' });
  const rawQuery = url.searchParams.get('query') || '';
  if (rawQuery.length > 120) return res.status(400).json({ error: 'radar_query_too_long' });
  const filters = {
    section,
    query: url.searchParams.get('query') || '',
    period: url.searchParams.get('period') || 'all',
    topic: url.searchParams.get('topic') || '',
    contentType: url.searchParams.get('contentType') || '',
    source: url.searchParams.get('source') || '',
    sort: url.searchParams.get('sort') || 'relevance',
  };
  try {
    if (await consumeRadarAttempt(req, session)) return res.status(429).json({ error: 'radar_rate_limited' });
  } catch {
    return res.status(503).json({ error: 'rate_limit_unavailable' });
  }
  try {
    // Reading the radar is intentionally snapshot-only. External sources are
    // consulted exclusively by the protected refresh endpoint/cron, so a
    // visitor never pays the latency or cost of a live collection run.
    const result = await getRadarItems({
      filters,
      live: false,
    });
    return res.status(200).json({
      ...result,
      sourcePolicy: [...RADAR_SOURCE_POLICY, ...getRadarFeedPolicy(), ...RADAR_WEB_POLICY],
      feedReadiness: getRadarFeedReadiness(),
      mode: result.liveProvider ? 'live+curated' : 'curated-fallback',
    });
  } catch {
    return res.status(503).json({ error: 'radar_unavailable' });
  }
}
