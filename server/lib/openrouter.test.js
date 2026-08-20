import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateWithAzure, evaluateWithOpenRouter } from './openrouter.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AZURE_OPENAI_ENDPOINT;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AI_MODEL_SELECTION;
});

describe('Azure provider adapter', () => {
  it('uses the Azure deployment endpoint and api-key header', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-test-key';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'senai-deployment';
    const fetchMock = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({ model: 'senai-deployment', choices: [{ message: { content: JSON.stringify({ evaluations: [{ id: '1', dimensions: { impact: 80, alignment: 70, credibility: 60, collaboration: 50, feasibility: 40, risk: 90 }, confidence: 75, summary: 'ok', gaps: [], evidence: [], severeRisk: { confirmed: false, evidence: '' } }] }) } }], usage: { total_tokens: 10 }, requestHeaders: options.headers }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await evaluateWithAzure({ input: { category: 'organization', objective: 'guided', answers: {} }, candidates: [{ id: '1', nome: 'Teste' }] });
    expect(result.provider).toBe('azure');
    expect(fetchMock.mock.calls[0][0]).toContain('/openai/deployments/senai-deployment/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('azure-test-key');
  });
});

describe('OpenRouter provider adapter', () => {
  it('omits temperature for the GPT-5 selection model required in production', async () => {
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    process.env.AI_MODEL_SELECTION = 'openai/gpt-5-mini';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ evaluations: [] }) } }] }),
      };
    }));

    await evaluateWithOpenRouter({ input: {}, candidates: [] });

    expect(bodies[0].temperature).toBeUndefined();
    expect(bodies[0].provider).toEqual({ require_parameters: true });
    expect(bodies[0].response_format.type).toBe('json_schema');
  });
});
