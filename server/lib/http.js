export function json(res, status, body) {
  res.status(status).json(body);
}

export function methodNotAllowed(res, allowed = ['POST']) {
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'method_not_allowed' });
}

function requestOrigin(req) {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
  const host = String(req.headers?.host || '').trim();
  return host ? `${protocol}://${host}` : '';
}

export function requireSameOrigin(req, res) {
  const origin = String(req.headers?.origin || '').trim();
  const referer = String(req.headers?.referer || '').trim();
  if (!origin && !referer) return true;
  const supplied = origin || (() => { try { return new URL(referer).origin; } catch { return ''; } })();
  const allowed = new Set([requestOrigin(req), process.env.PUBLIC_APP_ORIGIN].filter(Boolean).map((value) => value.replace(/\/$/, '')));
  if (allowed.has(supplied.replace(/\/$/, ''))) return true;
  res.status(403).json({ error: 'origin_not_allowed' });
  return false;
}

export async function readJson(req, maxBytes = 512 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('request_too_large');
  }
  return raw ? JSON.parse(raw) : {};
}
