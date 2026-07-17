import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateNextQuestionWithProvider, nextQuestionSchema, normalizeQuestion } from './interviewProvider.js';

const validResponse = {
  shouldStop: false,
  stopReason: '',
  question: {
    id: 'adaptive_publico',
    prompt: 'Quem precisa ser beneficiado por essa escolha?',
    helper: 'Isso ajuda a diferenciar alcance e profundidade.',
    example: 'Ex.: instrutores de cursos técnicos e empresas parceiras.',
    answerKind: 'textarea',
    reasonTag: 'aprofundar_publico',
  },
  dimensionsCovered: ['impact', 'alignment'],
  factsExtracted: ['o foco envolve formação profissional'],
  remainingGaps: ['prazo'],
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe('adaptive interview provider', () => {
  it('normalizes structured questions and rejects incomplete output', () => {
    const value = normalizeQuestion(validResponse);
    expect(value.question.id).toBe('adaptive_publico');
    expect(value.dimensionsCovered).toEqual(['impact', 'alignment']);
    expect(() => normalizeQuestion({ ...validResponse, question: { ...validResponse.question, prompt: '' } })).toThrow('invalid_structured_output');
  });

  it('keeps the JSON schema strict and routes through OpenRouter when configured', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ model: 'openrouter/auto', choices: [{ message: { content: JSON.stringify(validResponse) } }], usage: { total_tokens: 42 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateNextQuestionWithProvider({ category: 'school', objective: 'benchmark', answers: { context: 'benchmarking' }, history: [], askedIds: ['context'] });

    expect(nextQuestionSchema.additionalProperties).toBe(false);
    expect(result.question.id).toBe('adaptive_publico');
    expect(result.trace).toMatchObject({ provider: 'openrouter', model: 'openrouter/auto' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('openrouter.ai');
  });

  it('does not pretend the ChatGPT subscription is an API provider', async () => {
    await expect(generateNextQuestionWithProvider({ category: 'researcher', objective: 'speaker', answers: {}, history: [], askedIds: [] })).rejects.toThrow('ai_not_configured');
  });
});
