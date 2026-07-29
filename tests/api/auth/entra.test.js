import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/auth/entra.js';
import { resetEntraJwksCache } from '../../../server/lib/entra.js';

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

function request(body, overrides = {}) {
  return {
    method: 'POST',
    headers: { host: 'app.test', origin: 'http://app.test', ...(overrides.headers || {}) },
    body,
    socket: { remoteAddress: 'entra-test' },
    ...overrides,
  };
}

function tokenFor(privateKey, claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://login.microsoftonline.com/tenant-123/v2.0',
    aud: 'client-123',
    tid: 'tenant-123',
    oid: 'oid-123',
    preferred_username: 'person@senai.sp.gov.br',
    groups: ['user-group'],
    iat: 1700000000,
    nbf: 1700000000,
    exp: 4102444800,
    ...claims,
  })).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  return `${input}.${signature}`;
}

afterEach(() => {
  ['AUTH_PROVIDER', 'AUTH_SESSION_SECRET', 'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_ADMIN_GROUP_ID', 'ENTRA_USER_GROUP_ID'].forEach((name) => delete process.env[name]);
  vi.unstubAllGlobals();
  resetEntraJwksCache();
});

describe('POST /api/auth/entra', () => {
  it('validates the Entra signature and maps groups to a user session', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';
    process.env.ENTRA_TENANT_ID = 'tenant-123';
    process.env.ENTRA_CLIENT_ID = 'client-123';
    process.env.ENTRA_ADMIN_GROUP_ID = 'admin-group';
    process.env.ENTRA_USER_GROUP_ID = 'user-group';
    const res = response();

    await handler(request({ token: tokenFor(privateKey) }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'person@senai.sp.gov.br', role: 'user' });
    expect(res.headers['Set-Cookie']).toContain('HttpOnly');
  });

  it('rejects a validly signed token with the wrong audience or group', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';
    process.env.ENTRA_TENANT_ID = 'tenant-123';
    process.env.ENTRA_CLIENT_ID = 'client-123';
    process.env.ENTRA_ADMIN_GROUP_ID = 'admin-group';
    process.env.ENTRA_USER_GROUP_ID = 'user-group';

    const audienceRes = response();
    await handler(request({ token: tokenFor(privateKey, { aud: 'other-client' }) }), audienceRes);
    expect(audienceRes.statusCode).toBe(401);

    resetEntraJwksCache();
    const groupRes = response();
    await handler(request({ token: tokenFor(privateKey, { groups: ['other-group'] }) }), groupRes);
    expect(groupRes.statusCode).toBe(401);

    resetEntraJwksCache();
    const expiredRes = response();
    await handler(request({ token: tokenFor(privateKey, { exp: 1 }) }), expiredRes);
    expect(expiredRes.statusCode).toBe(401);

    resetEntraJwksCache();
    const overageRes = response();
    await handler(request({ token: tokenFor(privateKey, { _claim_names: { groups: 'src1' }, hasgroups: true }) }), overageRes);
    expect(overageRes.statusCode).toBe(401);
  });

  it('accepts an Authorization bearer token for Azure Easy Auth or a corporate proxy', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })));
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';
    process.env.ENTRA_TENANT_ID = 'tenant-123';
    process.env.ENTRA_CLIENT_ID = 'client-123';
    process.env.ENTRA_ADMIN_GROUP_ID = 'admin-group';
    process.env.ENTRA_USER_GROUP_ID = 'user-group';
    const res = response();
    await handler(request({}, { headers: { host: 'app.test', origin: 'http://app.test', authorization: `Bearer ${tokenFor(privateKey)}` } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe('user');
  });
});
