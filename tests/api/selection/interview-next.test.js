import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/selection/interview-next.js';
import { createSessionToken } from '../../../server/lib/cookies.js';
import { InterviewPlanner } from '../../../src/domain/interviewPlanner.js';
import { generateNextQuestionWithProvider } from '../../../server/lib/ai.js';

vi.mock('../../../server/lib/ai.js', () => ({ generateNextQuestionWithProvider: vi.fn() }));

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

function request(state, answer = 'Escola para benchmarking de formação dual') {
  const token = createSessionToken({ username: 'user', role: 'user' });
  return {
    method: 'POST',
    headers: { cookie: `senai_session=${encodeURIComponent(token)}` },
    socket: { remoteAddress: 'interview-test' },
    body: { state, questionId: state.currentQuestion.id, answer },
  };
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  vi.mocked(generateNextQuestionWithProvider).mockReset();
});

const providerAnswer = {
  shouldStop: false,
  stopReason: '',
  targetField: 'benchmark_focus',
  question: { id: 'x', targetField: 'benchmark_focus', prompt: 'Qual prática dessa comparação é a que você quer transferir?', helper: '', example: '', answerKind: 'textarea', reasonTag: 'aprofundar_benchmark' },
  dimensionsCovered: ['alignment'],
  factsExtracted: [],
  fieldsSatisfied: [],
  remainingGaps: [],
  adaptationExplanation: '',
  trace: { provider: 'openrouter', model: 'test/model' },
};

/** Avança a entrevista local até um estado com uma pergunta em aberto. */
async function advance(state, answers) {
  let current = state;
  for (const value of answers) {
    current = InterviewPlanner.next(InterviewPlanner.answer(current, value));
  }
  return current;
}

describe('POST /api/selection/interview/next', () => {
  it('falha visivelmente quando não há provedor de IA, em vez de escrever a pergunta localmente', async () => {
    // Uma pergunta escrita localmente é indistinguível de uma pergunta adaptada:
    // a entrevista continuaria parecendo funcionar sem nunca ter sido adaptada.
    vi.mocked(generateNextQuestionWithProvider).mockRejectedValue(new Error('ai_not_configured'));
    const state = InterviewPlanner.start({ category: 'organization', objective: 'benchmark' });
    const res = response();
    await handler(request(state), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: 'ai_unavailable', reason: 'ai_not_configured', retryable: false });
    expect(res.body.state).toBeUndefined();
  });

  it('marca o timeout do provedor como tentável de novo', async () => {
    vi.mocked(generateNextQuestionWithProvider).mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const state = InterviewPlanner.start({ category: 'organization', objective: 'benchmark' });
    const res = response();
    await handler(request(state), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: 'ai_unavailable', reason: 'provider_timeout', retryable: true });
  });

  it('serves the question written by the provider and keeps what it extracted', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = InterviewPlanner.start({ category: 'school', objective: 'benchmark' });
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      fieldsSatisfied: [{ field: 'audience', value: 'coordenação pedagógica', confidence: 0.9 }],
    });

    const res = response();
    await handler(request(state, 'Comparar como outras escolas organizam a formação dual'), res);

    expect(res.statusCode).toBe(200);
    expect(generateNextQuestionWithProvider).toHaveBeenCalledOnce();
    expect(generateNextQuestionWithProvider).toHaveBeenCalledWith(expect.objectContaining({ subtype: 'Instituição de ensino' }), expect.anything());
    expect(res.body.trace.provider).toBe('openrouter');
    expect(res.body.question.prompt).toBe(providerAnswer.question.prompt);
    expect(res.body.state.derived.audience).toMatchObject({ value: 'coordenação pedagógica', source: 'provider' });
    expect(res.body.state.validation.missing).not.toContain('audience');
    expect(res.body.state.subtype).toBe('Instituição de ensino');
  });

  it('rejects optional questions while decision-critical fields are still missing', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = InterviewPlanner.start({ category: 'organization', objective: 'benchmark' });
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      targetField: 'budget',
      question: { ...providerAnswer.question, targetField: 'budget', prompt: 'Qual é o orçamento?', reasonTag: 'definir_recursos' },
    });

    const res = response();
    await handler(request(state, 'Comparar práticas de formação dual'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.trace).toMatchObject({ provider: 'local-fallback', fallback: true, degraded: true, stopReason: 'provider_question_rejected' });
    expect(res.body.question.targetField).not.toBe('budget');
  });

  it('refuses a question about a field the answer already covered', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = InterviewPlanner.start({ category: 'organization', objective: 'project_partner' });
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      targetField: 'audience',
      question: { ...providerAnswer.question, targetField: 'audience', prompt: 'Quem é o público?' },
      fieldsSatisfied: [{ field: 'audience', value: 'instrutores da rede', confidence: 0.9 }],
    });

    const res = response();
    await handler(request(state, 'Um piloto com instrutores da rede'), res);

    // A cobertura ainda não permite encerrar; o fallback local retoma o próximo
    // gap obrigatório sem repetir o público que já foi extraído.
    expect(res.statusCode).toBe(200);
    expect(res.body.trace).toMatchObject({ provider: 'local-fallback', fallback: true, degraded: true });
    expect(res.body.question.targetField).not.toBe('audience');
  });

  it('deixa reperguntar o campo que uma resposta fora de propósito não respondeu', async () => {
    // Sem isto o modelo fazia a coisa certa — voltar ao que "comer batata" não
    // respondeu — e o servidor recusava a pergunta por já haver texto no campo.
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = InterviewPlanner.start({ category: 'researcher', objective: 'speaker' });
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      lastAnswerQuality: 'off_topic',
      targetField: 'context',
      question: { ...providerAnswer.question, targetField: 'context', prompt: 'Você escreveu “comer batata”. Que situação de trabalho você tem em mente?' },
      fieldsSatisfied: [],
    });

    const res = response();
    await handler(request(state, 'Comer batata'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.question.targetField).toBe('context');
    expect(res.body.question.prompt).toMatch(/comer batata/i);
    expect(res.body.trace.lastAnswerQuality).toBe('off_topic');
  });

  it('stops when the fields the provider extracted complete the required coverage', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = await advance(
      InterviewPlanner.start({ category: 'organization', objective: 'benchmark' }),
      ['Resposta de contexto', 'Resposta seguinte', 'Mais uma resposta'],
    );
    const missing = InterviewPlanner.coverage(state).missing;
    expect(missing.length).toBeGreaterThan(0);
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      shouldStop: true,
      stopReason: 'informação suficiente',
      fieldsSatisfied: missing.map((field) => ({ field, value: `valor de ${field}`, confidence: 0.9 })),
    });

    const res = response();
    await handler(request(state, 'Última resposta com bastante detalhe'), res);

    expect(res.statusCode).toBe(200);
    expect(generateNextQuestionWithProvider).toHaveBeenCalledOnce();
    expect(res.body.trace.stopReason).toBe('informação suficiente');
    expect(res.body.state.status).toBe('ready');
    expect(res.body.question).toBeNull();
    expect(res.body.state.askedIds.length).toBeLessThan(8);
  });

  it('ignores a low-confidence or unknown field claimed by the provider', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const state = InterviewPlanner.start({ category: 'organization', objective: 'benchmark' });
    vi.mocked(generateNextQuestionWithProvider).mockResolvedValue({
      ...providerAnswer,
      fieldsSatisfied: [
        { field: 'geography', value: 'talvez Brasil', confidence: 0.2 },
        { field: 'campo_inventado', value: 'x', confidence: 1 },
      ],
    });

    const res = response();
    await handler(request(state, 'Comparar a formação dual de outras escolas'), res);

    expect(generateNextQuestionWithProvider).toHaveBeenCalledOnce();
    expect(res.body.trace.provider).toBe('openrouter');
    expect(res.body.state.derived).not.toHaveProperty('geography');
    expect(res.body.state.derived).not.toHaveProperty('campo_inventado');
  });

  it('rejects a question mismatch without calling the planner', async () => {
    const state = InterviewPlanner.start({ category: 'researcher', objective: 'speaker' });
    const res = response();
    const req = request(state);
    req.body.questionId = 'different-question';
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_interview_payload');
  });
});
