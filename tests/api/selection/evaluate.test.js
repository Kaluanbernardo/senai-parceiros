import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/selection/evaluate.js';
import { createSessionToken } from '../../../server/lib/cookies.js';
import { evaluateWithProvider } from '../../../server/lib/ai.js';

vi.mock('../../../server/lib/ai.js', () => ({ evaluateWithProvider: vi.fn() }));

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

function request() {
  const token = createSessionToken({ username: 'user', role: 'user' });
  return {
    method: 'POST',
    headers: { cookie: `senai_session=${encodeURIComponent(token)}` },
    socket: { remoteAddress: 'evaluate-test' },
    body: {
      category: 'organization',
      subtype: 'Instituição de ensino',
      objective: 'benchmark',
      answers: {
        context: 'Comparar currículos de educação profissional com outra instituição',
        desired_outcome: 'Levar uma recomendação para a reunião de gestão',
        themes: 'currículo, aprendizagem prática',
        audience: 'coordenação pedagógica e docentes',
        geography: 'São Paulo, presencial ou remoto',
        constraints: 'sem orçamento para viagem',
      },
    },
  };
}

afterEach(() => {
  vi.mocked(evaluateWithProvider).mockReset();
});

describe('POST /api/selection/evaluate', () => {
  it('não entrega o cálculo determinístico sozinho quando a IA falha', async () => {
    // O motor local monta o pool e os pesos que a IA recebe, mas entregar esse
    // cálculo como se fosse a recomendação esconderia que ninguém a revisou.
    vi.mocked(evaluateWithProvider).mockRejectedValue(new Error('provider_4xx'));
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: 'ai_unavailable', reason: 'provider_4xx', retryable: true });
    expect(res.body.shortlist).toBeUndefined();
    expect(evaluateWithProvider).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ subtype: 'Instituição de ensino', brief: expect.objectContaining({ subtype: 'Instituição de ensino' }) }),
      candidates: expect.arrayContaining([expect.objectContaining({ subtipo: 'Instituição de ensino' })]),
    }));
    expect(vi.mocked(evaluateWithProvider).mock.calls[0][0].candidates.every((candidate) => candidate.subtipo === 'Instituição de ensino')).toBe(true);
  });

  it('trata provedor ausente como problema de configuração, não como falha temporária', async () => {
    vi.mocked(evaluateWithProvider).mockRejectedValue(new Error('ai_not_configured'));
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: 'ai_unavailable', reason: 'ai_not_configured', retryable: false });
  });

  it('recusa uma resposta do provedor sem nenhuma avaliação', async () => {
    // Zero avaliações significa que nada seria mesclado: o resultado seria o
    // cálculo local com a etiqueta da IA em cima.
    vi.mocked(evaluateWithProvider).mockResolvedValue({ provider: 'openrouter', model: 'test/model', evaluations: [] });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: 'ai_unavailable', reason: 'provider_empty_evaluation' });
  });
});
