import { RADAR_FEED_POLICY } from '../server/lib/radar.js';

function feedFormat(body, contentType) {
  const sample = String(body || '').slice(0, 4000);
  if (/<rss\b/i.test(sample)) return 'rss';
  if (/<feed\b/i.test(sample)) return 'atom';
  if (/xml|rss|atom/i.test(contentType || '') && /<(?:channel|entry)\b/i.test(sample)) return 'xml-feed';
  return null;
}

function itemCount(body) {
  return [...String(body || '').matchAll(/<(?:item|entry)\b/gi)].length;
}

async function inspectFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, text/xml, application/xml',
        'User-Agent': 'senai-parceiros/1.0 official-feed-audit',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const format = feedFormat(body, contentType);
    return {
      ...feed,
      finalUrl: response.url,
      status: response.status,
      ready: response.ok && Boolean(format),
      format,
      itemCount: itemCount(body),
      contentType: contentType.split(';')[0],
    };
  } catch (error) {
    return {
      ...feed,
      ready: false,
      error: String(error?.message || 'feed_audit_failed').slice(0, 120),
    };
  }
}

const configured = RADAR_FEED_POLICY.map((feed) => ({ ...feed, source: 'configured' }));
const results = [];
for (const feed of configured) results.push(await inspectFeed(feed));
console.log(JSON.stringify({ auditedAt: new Date().toISOString(), results }, null, 2));
if (results.some((result) => !result.ready)) process.exitCode = 1;
