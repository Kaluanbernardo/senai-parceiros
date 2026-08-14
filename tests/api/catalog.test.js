import { afterEach, describe, expect, it } from 'vitest';
import handler from '../../api/catalog.js';
import { createSessionToken } from '../../server/lib/cookies.js';
import { catalogStore } from '../../server/lib/catalogStore.js';

process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123';

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

function request(role = 'user') {
  const token = createSessionToken({ username: role, role });
  return { method: 'GET', headers: { cookie: `senai_session=${encodeURIComponent(token)}` } };
}

afterEach(() => catalogStore.configure({ driver: 'memory' }));

describe('GET /api/catalog', () => {
  it('returns authenticated imported records without exposing store internals', async () => {
    catalogStore.replaceCategory('organization', [{ id: 'o-import-1', nome: 'Importada' }], ['hash-1']);
    const res = response();
    await handler(request(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.records.organization).toEqual([expect.objectContaining({ id: 'o-import-1', nome: 'Importada', categoria: 'Pessoa Jurídica', subtipo: 'Outro' })]);
    expect(res.body.records.person).toEqual([]);
    expect(res.body.records).not.toHaveProperty('school');
    expect(res.body).not.toHaveProperty('pendingBatches');
  });

  it('rejects unauthenticated catalog reads', async () => {
    const res = response();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('authentication_required');
  });
});
