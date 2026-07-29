import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/auth/session.js';

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

function tokenFor(privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'session-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://login.microsoftonline.com/tenant-session/v2.0', aud: 'client-session', tid: 'tenant-session', oid: 'oid-session',
    preferred_username: 'proxy-user@senai.sp.gov.br', groups: ['user-session'], exp: 4102444800, nbf: 1700000000,
  })).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

afterEach(() => {
  ['AUTH_PROVIDER', 'AUTH_SESSION_SECRET', 'ENTRA_TRUST_PROXY_HEADERS', 'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_ADMIN_GROUP_ID', 'ENTRA_USER_GROUP_ID'].forEach((name) => delete process.env[name]);
  vi.unstubAllGlobals();
});

describe('GET /api/auth/session', () => {
  it('exchanges the Azure Easy Auth proxy header when explicitly enabled', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'session-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';
    process.env.ENTRA_TRUST_PROXY_HEADERS = 'true';
    process.env.ENTRA_TENANT_ID = 'tenant-session';
    process.env.ENTRA_CLIENT_ID = 'client-session';
    process.env.ENTRA_ADMIN_GROUP_ID = 'admin-session';
    process.env.ENTRA_USER_GROUP_ID = 'user-session';
    const res = response();
    await handler({ method: 'GET', headers: { 'x-ms-token-aad-id-token': tokenFor(privateKey) }, socket: { remoteAddress: 'proxy' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ authenticated: true, provider: 'entra', user: { role: 'user', username: 'proxy-user@senai.sp.gov.br' } });
    expect(res.headers['Set-Cookie']).toContain('HttpOnly');
  });

  it('does not trust the proxy header unless explicitly enabled', async () => {
    process.env.AUTH_PROVIDER = 'entra';
    const res = response();
    await handler({ method: 'GET', headers: { 'x-ms-token-aad-id-token': 'not-used' }, socket: { remoteAddress: 'proxy' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ authenticated: false, provider: 'entra', user: null });
  });
});
