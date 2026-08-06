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
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
});

describe('adaptive interview provider', () => {
  it('normalizes structured questions and rejects incomplete output', () => {
    const value = normalizeQuestion(validResponse);
    expect(value.question.id).toBe('adaptive_publico');
    expect(value.dimensionsCovered).toEqual(['impact', 'alignment']);
    expect(() => normalizeQuestion({ ...validResponse, question: { ...validResponse.question, prompt: '' } })).toThrow('invalid_structured_output');
  });

  it('keeps only satisfied fields that the brief understands, with a usable confidence', () => {
    const value = normalizeQuestion({
      ...validResponse,
      fieldsSatisfied: [
        { field: 'audience', value: 'instrutores', confidence: 0.9 },
        { field: 'geography', value: 'São Paulo', confidence: 3 },
        { field: 'campo_inventado', value: 'x', confidence: 1 },
        { field: 'timeframe', value: '', confidence: 1 },
        { field: 'budget', value: 'sem verba', confidence: 'alta' },
      ],
    });

    expect(value.fieldsSatisfied).toEqual([
      { field: 'audience', value: 'instrutores', confidence: 0.9 },
      { field: 'geography', value: 'São Paulo', confidence: 1 },
    ]);
  });

  it('requires the extraction field in the strict schema', () => {
    expect(nextQuestionSchema.required).toContain('fieldsSatisfied');
    expect(nextQuestionSchema.properties.fieldsSatisfied.items.properties.field.enum).toContain('audience');
  });

  it('makes the model read the situation and weigh alternatives before writing the question', () => {
    const order = nextQuestionSchema.required;
    // A geração é sequencial: a leitura da situação e as candidatas precisam
    // vir antes do texto da pergunta, senão o raciocínio vira justificativa.
    expect(order.indexOf('situationRead')).toBeLessThan(order.indexOf('prompt'));
    expect(order.indexOf('candidateQuestions')).toBeLessThan(order.indexOf('prompt'));
    expect(order.indexOf('assumptionsAvoided')).toBeLessThan(order.indexOf('candidateQuestions'));
    expect(nextQuestionSchema.properties.candidateQuestions.items.required).toEqual(['targetField', 'draft', 'whatItDecides']);

    const value = normalizeQuestion({
      ...validResponse,
      situationRead: 'A pessoa descreveu um evento aberto, sem dizer onde acontece.',
      assumptionsAvoided: ['o local do evento', 'que o público seja da indústria'],
      chosenBecause: 'o público define a profundidade técnica esperada',
      candidateQuestions: [
        { targetField: 'audience', draft: 'Quem estará na plateia?', whatItDecides: 'profundidade técnica' },
        { targetField: 'geography', draft: 'Onde isso acontece?', whatItDecides: 'viabilidade de deslocamento' },
        { targetField: 'campo_inventado', draft: 'x', whatItDecides: 'nada' },
      ],
    });

    expect(value.situationRead).toBe('A pessoa descreveu um evento aberto, sem dizer onde acontece.');
    expect(value.assumptionsAvoided).toHaveLength(2);
    expect(value.candidateQuestions.map((item) => item.targetField)).toEqual(['audience', 'geography']);
  });

  it('does not presume a SENAI-SP venue or an industry audience, and asks for varied wording', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    const bodies = [];
    const fetchMock = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(validResponse) } }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateNextQuestionWithProvider({
      category: 'organization',
      objective: 'speaker',
      answers: { context: 'um evento aberto' },
      transcript: [{ turn: 1, displayedQuestion: 'Em que conversa ou evento essa organização entraria?', answer: 'um evento aberto', targetField: 'context' }],
      askedIds: ['context'],
    });

    const prompt = bodies[0].messages.at(-1).content;
    expect(prompt).toMatch(/pode acontecer em qualquer lugar/i);
    expect(prompt).toMatch(/n[ãa]o [ée] necessariamente industri[áa]rio/i);
    expect(prompt).toMatch(/askedPrompts/);
    expect(prompt).toContain('Em que conversa ou evento essa organização entraria?');
    // Redigir pergunta com temperatura de extração é o que fazia as perguntas
    // saírem parecidas entre si.
    expect(bodies[0].temperature).toBeGreaterThan(0.3);
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

  it('supports the future Azure OpenAI adapter without changing the interview contract', async () => {
    process.env.AI_PROVIDER = 'azure';
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-test-key';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'senai-deployment';
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ model: 'senai-deployment', choices: [{ message: { content: JSON.stringify(validResponse) } }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateNextQuestionWithProvider({ category: 'school', objective: 'benchmark', answers: { context: 'benchmarking' }, history: [], askedIds: ['context'] });
    expect(result.trace.provider).toBe('azure');
    expect(fetchMock.mock.calls[0][0]).toContain('/openai/deployments/senai-deployment/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('azure-test-key');
  });
});
