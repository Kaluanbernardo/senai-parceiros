import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../server/routes/admin/ai-check.js';
import { createSessionToken } from '../../../server/lib/cookies.js';

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

function request(role = 'admin') {
  const token = createSessionToken({ username: 'user', role });
  return { method: 'GET', headers: { cookie: `senai_session=${encodeURIComponent(token)}` }, socket: { remoteAddress: 'ai-check-test' } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
});

describe('GET /api/admin/ai-check', () => {
  it('mede uma chamada mínima e não devolve conteúdo nenhum da resposta', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ model: 'deepseek/test', choices: [{ message: { content: '{"ok":"pong"}' } }], usage: { total_tokens: 9 } }),
    })));
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, provider: 'openrouter', model: 'deepseek/test' });
    expect(typeof res.body.elapsedMs).toBe('number');
    expect(JSON.stringify(res.body)).not.toContain('pong');
    expect(JSON.stringify(res.body)).not.toContain('test-key');
  });

  it('reporta a falha como código, com o tempo gasto até ela', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 402, text: async () => 'segredo do provedor' })));
    const res = response();

    await handler(request(), res);

    // Falha de medição ainda é medição: 200 com o diagnóstico dentro, para o
    // painel poder mostrar o motivo em vez de um erro genérico de rota.
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: false, reason: 'provider_4xx' });
    expect(JSON.stringify(res.body)).not.toContain('segredo');
  });

  it('não responde a quem não é admin', async () => {
    const res = response();
    await handler(request('user'), res);
    expect(res.statusCode).toBe(403);
  });
});
