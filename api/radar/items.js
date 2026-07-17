import { getSession } from '../../server/lib/cookies.js';
import { getRadarItems, RADAR_FEED_POLICY, RADAR_SECTIONS, RADAR_SOURCE_POLICY } from '../../server/lib/radar.js';
import { isRadarRateLimited, recordRadarAttempt } from '../../server/lib/auth.js';

function bool(value) {
  return String(value).toLowerCase() === 'true';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'authentication_required' });
  if (isRadarRateLimited(req, session)) return res.status(429).json({ error: 'radar_rate_limited' });
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
  recordRadarAttempt(req, session);
  try {
    const result = await getRadarItems({
      filters,
      live: process.env.RADAR_LIVE_SOURCES === undefined ? true : bool(process.env.RADAR_LIVE_SOURCES),
    });
    return res.status(200).json({
      ...result,
      sourcePolicy: [...RADAR_SOURCE_POLICY, ...RADAR_FEED_POLICY],
      mode: result.liveProvider ? 'live+curated' : 'curated-fallback',
    });
  } catch {
    return res.status(503).json({ error: 'radar_unavailable' });
  }
}
