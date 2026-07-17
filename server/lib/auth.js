import crypto from 'node:crypto';
import { createSessionToken, setSessionCookie } from './cookies.js';

const attempts = new Map();
const selectionAttempts = new Map();
const interviewAttempts = new Map();
const radarAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_SELECTION_ATTEMPTS = 12;
const MAX_INTERVIEW_ATTEMPTS = 40;
const RADAR_WINDOW_MS = 10 * 60 * 1000;
const MAX_RADAR_ATTEMPTS = 30;

function clientKey(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function selectionKey(req, session) {
  return `${clientKey(req)}:${session?.username || 'anonymous'}`;
}

export function isSelectionRateLimited(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = selectionAttempts.get(key);
  if (!record || record.resetAt <= now) {
    selectionAttempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return record.count >= MAX_SELECTION_ATTEMPTS;
}

export function recordSelectionAttempt(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = selectionAttempts.get(key);
  if (!record || record.resetAt <= now) selectionAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else record.count += 1;
}

export function isInterviewRateLimited(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = interviewAttempts.get(key);
  if (!record || record.resetAt <= now) {
    interviewAttempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return record.count >= MAX_INTERVIEW_ATTEMPTS;
}

export function recordInterviewAttempt(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = interviewAttempts.get(key);
  if (!record || record.resetAt <= now) interviewAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else record.count += 1;
}

export function isRadarRateLimited(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = radarAttempts.get(key);
  if (!record || record.resetAt <= now) {
    radarAttempts.set(key, { count: 0, resetAt: now + RADAR_WINDOW_MS });
    return false;
  }
  return record.count >= MAX_RADAR_ATTEMPTS;
}

export function recordRadarAttempt(req, session) {
  const key = selectionKey(req, session);
  const now = Date.now();
  const record = radarAttempts.get(key);
  if (!record || record.resetAt <= now) radarAttempts.set(key, { count: 1, resetAt: now + RADAR_WINDOW_MS });
  else record.count += 1;
}

export function isLoginRateLimited(req) {
  const key = clientKey(req);
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

export function recordLoginAttempt(req) {
  const key = clientKey(req);
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    record.count += 1;
  }
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

export function authenticate(username, password) {
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
