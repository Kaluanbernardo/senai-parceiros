import crypto from 'node:crypto';

const SESSION_COOKIE = 'senai_session';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function secret() {
  const value = process.env.AUTH_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters');
  }
  return value;
}

function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
    return cookies;
  }, {});
}

export function createSessionToken({ username, role, ttlSeconds = 8 * 60 * 60 }) {
  const payload = base64url(JSON.stringify({
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }));
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = signature(payload);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(fromBase64url(payload));
    if (!value?.username || !value?.role || value.exp <= Math.floor(Date.now() / 1000)) return null;
    return value;
  } catch {
    return null;
  }
}

export function getSession(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return verifySessionToken(cookies[SESSION_COOKIE]);
}

export function setSessionCookie(res, token, ttlSeconds = 8 * 60 * 60) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${ttlSeconds}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

export function requireSession(req, res, roles = []) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'authentication_required' });
    return null;
  }
  if (roles.length && !roles.includes(session.role)) {
    res.status(403).json({ error: 'insufficient_role' });
    return null;
  }
  return session;
}

export { SESSION_COOKIE };
