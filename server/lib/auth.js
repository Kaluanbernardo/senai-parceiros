import crypto from 'node:crypto';
import { createSessionToken, setSessionCookie } from './cookies.js';
import { rateLimitStore } from './rateLimitStore.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_SELECTION_ATTEMPTS = 12;
const MAX_INTERVIEW_ATTEMPTS = 40;
const RADAR_WINDOW_MS = 10 * 60 * 1000;
const MAX_RADAR_ATTEMPTS = 30;

function clientKey(req) {
  const raw = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function selectionKey(req, session) {
  return `${clientKey(req)}:${session?.username || 'anonymous'}`;
}

function check(key, limit, windowMs) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, { count: 0, resetAt: now + windowMs });
    return false;
  }
  return record.count >= limit;
}

function record(key, windowMs) {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
  else rateLimitStore.set(key, { ...current, count: current.count + 1 });
}

export function isSelectionRateLimited(req, session) {
  return check(`selection:${selectionKey(req, session)}`, MAX_SELECTION_ATTEMPTS, WINDOW_MS);
}

export function recordSelectionAttempt(req, session) {
  record(`selection:${selectionKey(req, session)}`, WINDOW_MS);
}

export function isInterviewRateLimited(req, session) {
  return check(`interview:${selectionKey(req, session)}`, MAX_INTERVIEW_ATTEMPTS, WINDOW_MS);
}

export function recordInterviewAttempt(req, session) {
  record(`interview:${selectionKey(req, session)}`, WINDOW_MS);
}

export function isRadarRateLimited(req, session) {
  return check(`radar:${selectionKey(req, session)}`, MAX_RADAR_ATTEMPTS, RADAR_WINDOW_MS);
}

export function recordRadarAttempt(req, session) {
  record(`radar:${selectionKey(req, session)}`, RADAR_WINDOW_MS);
}

export function isLoginRateLimited(req) {
  return check(`login:${clientKey(req)}`, MAX_ATTEMPTS, WINDOW_MS);
}

export function recordLoginAttempt(req) {
  record(`login:${clientKey(req)}`, WINDOW_MS);
}

export async function hydrateRateLimitStore({ force = false } = {}) {
  return rateLimitStore.hydrate({ force });
}

export async function flushRateLimitStore() {
  return rateLimitStore.flush();
}

export function getRateLimitStoreStatus() {
  return rateLimitStore.status();
}

export function resetRateLimitsForTests() {
  rateLimitStore.resetForTests();
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function credentials() {
  return [
    {
      username: process.env.AUTH_ADMIN_USERNAME || 'admin',
      password: process.env.AUTH_ADMIN_PASSWORD,
      role: 'admin',
    },
    {
      username: process.env.AUTH_USER_USERNAME || 'user',
      password: process.env.AUTH_USER_PASSWORD,
      role: 'user',
    },
  ].filter((credential) => credential.password);
}

export function getAuthProvider() {
  return String(process.env.AUTH_PROVIDER || 'local').trim().toLowerCase() || 'local';
}

export function authenticate(username, password) {
  if (getAuthProvider() !== 'local') return null;
  const match = credentials().find((credential) => safeEqual(credential.username, username) && safeEqual(credential.password, password));
  if (!match) return null;
  return {
    username: match.username,
    role: match.role,
    token: createSessionToken({ username: match.username, role: match.role }),
  };
}

export function completeLogin(res, identity) {
  setSessionCookie(res, identity.token);
  return { username: identity.username, role: identity.role };
}
