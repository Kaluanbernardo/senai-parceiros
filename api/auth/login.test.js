import { afterEach, describe, expect, it } from 'vitest';
import handler from './login.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(overrides = {}) {
  return {
    method: 'POST',
    headers: { host: 'app.test', ...(overrides.headers || {}) },
    body: { username: 'admin', password: 'test-password' },
    socket: { remoteAddress: 'login-test' },
    ...overrides,
  };
}

afterEach(() => {
  ['AUTH_PROVIDER', 'AUTH_ADMIN_PASSWORD', 'AUTH_SESSION_SECRET'].forEach((name) => delete process.env[name]);
});

describe('POST /api/auth/login', () => {
  it('rejects cross-origin login attempts', async () => {
    process.env.AUTH_ADMIN_PASSWORD = 'test-password';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';
    const res = response();

    await handler(request({ headers: { host: 'app.test', origin: 'https://evil.example' } }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('origin_not_allowed');
  });

  it('fails closed while a corporate provider is selected without its adapter', async () => {
    process.env.AUTH_PROVIDER = 'entra';
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe('corporate_identity_provider_not_configured');
  });
});
