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
  delete process.env.OPENROUTER_COST_QUALITY_TRADEOFF;
  delete process.env.OPENROUTER_REASONING;
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

  it('uses the completion-token contract accepted by the default OpenAI model', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'server-only-test-key';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], maxOutputTokens: 2200 });

    expect(bodies[0].max_completion_tokens).toBe(2200);
    expect(bodies[0].max_tokens).toBeUndefined();
    expect(bodies[0].temperature).toBeUndefined();
    expect(bodies[0].reasoning_effort).toBe('minimal');
  });

  it('routes with the auto-router plugin only for the Auto Router', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    const bodies = [];
    const fetchMock = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });
    expect(bodies[0].plugins).toEqual([expect.objectContaining({ id: 'auto-router' })]);
    expect(bodies[0].provider).toEqual({ require_parameters: true });
  });

  it('uses hosted OpenRouter search and exposes only public citation evidence', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"value":"ok"}',
              annotations: [{
                type: 'url_citation',
                url_citation: { url: 'https://example.org/fonte', title: 'Fonte pública', content: 'Trecho público.' },
              }],
            },
          }],
          usage: { total_tokens: 42, server_tool_use: { web_search_requests: 2 } },
        }),
      };
    }));

    const result = await generateStructured({
      schema,
      messages: [{ role: 'user', content: 'pesquise' }],
      webSearch: { engine: 'exa', maxResults: 99, maxTotalResults: 99, searchContextSize: 'high' },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('openrouter.ai');
    expect(requests[0].body.tools).toEqual([{
      type: 'openrouter:web_search',
      parameters: { engine: 'exa', max_results: 25, max_total_results: 20, search_context_size: 'high' },
    }]);
    expect(result.trace).toMatchObject({
      webSearchRequests: 2,
      webSearchSources: [{ url: 'https://example.org/fonte', title: 'Fonte pública', content: 'Trecho público.' }],
    });
  });

  it('can keep the strict schema while bypassing provider parameter pre-filtering', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({
      schema,
      messages: [{ role: 'user', content: 'pesquise' }],
      model: 'openai/gpt-4.1-mini',
      requireParameters: false,
      webSearch: { engine: 'native' },
    });

    expect(bodies[0].provider).toBeUndefined();
    expect(bodies[0].response_format.json_schema.strict).toBe(true);
    expect(bodies[0].tools).toEqual([expect.objectContaining({ type: 'openrouter:web_search' })]);
  });

  it('lets an internal task pin a faster OpenRouter model without invoking the auto-router', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], model: 'openai/gpt-5-mini', disableReasoning: true, strictOutput: false });

    expect(bodies[0].model).toBe('openai/gpt-5-mini');
    expect(bodies[0].plugins).toBeUndefined();
    expect(bodies[0].provider).toBeUndefined();
    expect(bodies[0].reasoning).toEqual({ enabled: false });
    expect(bodies[0].response_format).toBeUndefined();
  });

  it('keeps a pinned model instead of letting the auto-router replace it', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    // A free-only setup must not be silently routed to a paid model.
    process.env.OPENROUTER_MODEL = 'openrouter/free';
    const bodies = [];
    const fetchMock = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });
    expect(bodies[0].model).toBe('openrouter/free');
    expect(bodies[0].plugins).toBeUndefined();
    // The strict schema requirement must survive, so an incompatible free
    // model degrades to a visible fallback instead of free-form text.
    expect(bodies[0].provider).toEqual({ require_parameters: true });
    expect(bodies[0].response_format.json_schema.strict).toBe(true);
  });

  it('lets one latency-sensitive call pin a compatible model without changing the global setting', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({
      schema,
      messages: [{ role: 'user', content: 'x' }],
      model: 'openai/gpt-4.1-mini',
    });

    expect(bodies[0].model).toBe('openai/gpt-4.1-mini');
    expect(bodies[0].plugins).toBeUndefined();
    expect(bodies[0].provider).toEqual({ require_parameters: true });
    expect(bodies[0].reasoning).toBeUndefined();
  });

  it('lets the caller choose the temperature and keeps extraction deterministic by default', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    const bodies = [];
    const fetchMock = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], temperature: 0.7 });
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], temperature: 9 });
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], temperature: 'quente' });
    expect(bodies.map((body) => body.temperature)).toEqual([0.15, 0.7, 1.2, 0.15]);
  });

  it('lets a quality-sensitive call ask the router for more quality than the rest of the system', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
    process.env.OPENROUTER_COST_QUALITY_TRADEOFF = '7';
    const bodies = [];
    const fetchMock = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const traces = [];
    traces.push((await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).trace);
    traces.push((await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], costQualityTradeoff: 10 })).trace);
    traces.push((await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], costQualityTradeoff: 99 })).trace);

    expect(bodies.map((body) => body.plugins[0].cost_quality_tradeoff)).toEqual([7, 10, 10]);
    // O valor realmente enviado fica auditável na trace, não só na env.
    expect(traces.map((trace) => trace.costQualityTradeoff)).toEqual([7, 10, 10]);
  });

  it('never sends the router preference alongside a pinned model', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_MODEL = 'deepseek/pinned-model';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], costQualityTradeoff: 10 });

    // Com modelo fixo não há roteador a instruir: pedir qualidade aqui seria
    // autorizar a troca do modelo escolhido de propósito.
    expect(bodies[0].plugins).toBeUndefined();
    expect(bodies[0].model).toBe('deepseek/pinned-model');
  });

  it('separa resposta truncada de modelo que ignora o schema', async () => {
    // Os dois chegavam como invalid_output e levavam a diagnósticos opostos:
    // "troque o modelo" quando bastava dar mais espaço de saída.
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"value":"ok' } }] }),
    })));

    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('output_truncated');
  });

  it('separa conteúdo vazio de conteúdo malformado', async () => {
    // Um modelo de raciocínio pode devolver o pensamento noutro campo e deixar
    // `content` vazio; a correção disso não é a mesma de uma resposta em prosa.
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '' } }] }),
    })));

    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('empty_output');
  });

  it('normaliza uma resposta HTTP 200 sem JSON válido do provedor', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
    })));

    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] }))
      .rejects.toThrow('provider_invalid_response');
  });

  it('aproveita o JSON quando o modelo o cerca de uma frase de cortesia', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'Claro! Aqui está:\n{"value":"ok"}\nEspero ter ajudado.' } }] }),
    })));

    const result = await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });

    expect(result.data).toEqual({ value: 'ok' });
  });

  it('deixa a entrevista pedir mais espaço de saída do que o padrão antigo', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], maxOutputTokens: 3000 });
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], maxOutputTokens: 99999 });

    expect(bodies.map((body) => body.max_tokens)).toEqual([3000, 16000]);
  });

  it('desliga o raciocínio interno, que o schema já exige de forma explícita', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });
    process.env.OPENROUTER_REASONING = 'low';
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });
    process.env.OPENROUTER_REASONING = 'talvez';
    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] });

    // Pensar duas vezes custa o dobro do tempo e só metade fica registrada.
    expect(bodies.map((body) => body.reasoning)).toEqual([{ enabled: false }, { effort: 'low' }, { enabled: false }]);
    delete process.env.OPENROUTER_REASONING;
  });

  it('permite que uma tarefa estruturada recuse o raciocínio global', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    process.env.OPENROUTER_REASONING = 'high';
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));

    await generateStructured({ schema, messages: [{ role: 'user', content: 'x' }], disableReasoning: true });

    expect(bodies[0].reasoning).toEqual({ enabled: false });
  });

  it('normalizes provider failures without leaking response content', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429, text: async () => 'secret provider body' }));
    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('provider_rate_limited');
  });

  it('retries a transient provider rate limit once', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, status: 429, headers: { get: () => '0' }, text: async () => JSON.stringify({ error: { code: 'rate_limit_exceeded' } }) };
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) };
    }));
    await expect(generateStructured({ schema, messages: [{ role: 'user', content: 'x' }] })).resolves.toMatchObject({ data: { value: 'ok' } });
    expect(attempts).toBe(2);
  });

  it('does not cache live web-search calls', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'server-only-test-key';
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"value":"ok"}' } }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const options = { task: 'catalog_research_organization_batch_1', schema, messages: [{ role: 'user', content: 'live query' }], webSearch: { engine: 'native' } };
    await generateStructured(options);
    await generateStructured(options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
