import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStructured } from './structuredGeneration.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: { type: 'string' } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AI_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENAI_API_KEY;
});

describe('structured generation boundary', () => {
  it('fails explicitly when the selected provider is not configured', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('ai_not_configured');
  });

  it('returns parsed data and sanitized trace without response/prompt contents', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ model: 'provider-selected-model', choices: [{ message: { content: '{"value":"ok"}' } }], usage: { total_tokens: 11 } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateStructured({ task: 'test_task', schema, messages: [{ role: 'user', content: 'private prompt' }] });
    expect(result.data).toEqual({ value: 'ok' });
    expect(result.trace).toMatchObject({ provider: 'openrouter', model: 'provider-selected-model', fallback: false });
    expect(JSON.stringify(result.trace)).not.toContain('private prompt');
    expect(JSON.stringify(result.trace)).not.toContain('server-only-test-key');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('normalizes provider failures without leaking response content', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429, text: async () => 'secret provider body' }));
    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('budget_exceeded');
  });
});
