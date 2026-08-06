/**
 * Server-only boundary for structured model output.
 *
 * Domain modules should not know how a provider is selected, authenticated or
 * how JSON is extracted from a chat completion.  Keeping that concern here
 * also makes the handoff to Azure OpenAI (or an internal SENAI provider) a
 * configuration change instead of a rewrite of the interview flow.
 */

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_TRADEOFF = 7;
/**
 * Extração e avaliação pedem determinismo. Redação, não: uma entrevista escrita
 * sempre com a mesma temperatura baixa produz perguntas que se parecem entre si
 * a cada sessão. Quem escreve pergunta passa a própria temperatura.
 */
const DEFAULT_TEMPERATURE = 0.15;

function safeTemperature(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_TEMPERATURE;
  return Math.max(0, Math.min(1.2, number));
}

function providerConfig() {
  const preferred = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  const azureEndpoint = String(process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL || '';
  const azureUrl = azureEndpoint && azureDeployment
    ? (azureEndpoint.includes('/openai/deployments/')
      ? `${azureEndpoint}${azureEndpoint.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || '2024-10-21')}`
      : `${azureEndpoint}/openai/deployments/${encodeURIComponent(azureDeployment)}/chat/completions?api-version=${encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || '2024-10-21')}`)
    : '';
  const all = {
    openrouter: {
      id: 'openrouter',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    },
    openai: {
      id: 'openai',
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      endpoint: 'https://api.openai.com/v1/chat/completions',
    },
    azure: {
      id: 'azure',
      key: process.env.AZURE_OPENAI_API_KEY,
      model: azureDeployment,
      endpoint: azureUrl,
    },
  };
  const order = preferred === 'azure'
    ? ['azure']
    : preferred === 'openrouter'
      ? ['openrouter']
      : preferred === 'openai'
        ? ['openai', 'openrouter']
        : ['openai', 'openrouter'];
  return order.map((id) => all[id]).filter((item) => item.key && item.endpoint);
}

function parseJson(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!text) throw new Error('invalid_output');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid_output');
  }
}

function providerHeaders(provider) {
  if (provider !== 'openrouter') return {};
  return {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://senai-parceiros.vercel.app',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'SENAI-SP Farol de Parcerias',
    'X-OpenRouter-Metadata': 'enabled',
  };
}

/**
 * `require_parameters` keeps routing restricted to providers that accept the
 * strict JSON schema, so an incompatible model degrades to a visible fallback
 * instead of returning free-form text.
 *
 * The auto-router plugin only applies to the Auto Router itself: sending it
 * alongside a pinned model lets OpenRouter route somewhere else, which would
 * silently defeat a deliberate choice of model — including a free-only setup.
 */
function providerOptions(provider, model) {
  if (provider !== 'openrouter') return {};
  const base = { provider: { require_parameters: true } };
  if (String(model || '').trim().toLowerCase() !== DEFAULT_OPENROUTER_MODEL) return base;
  const tradeoff = Math.max(0, Math.min(10, Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF))));
  return {
    ...base,
    plugins: [{ id: 'auto-router', cost_quality_tradeoff: tradeoff }],
  };
}

/**
 * Generate and parse a strict JSON response.
 * `messages` may contain a system message and a user message.  The returned
 * trace is deliberately sanitized: it contains no prompt, response body or
 * credential.
 */
export async function generateStructured({ task = 'structured_generation', schema, messages, maxOutputTokens = 700, temperature = DEFAULT_TEMPERATURE, signal } = {}) {
  if (!schema || !Array.isArray(messages) || !messages.length) throw new Error('invalid_generation_request');
  const providers = providerConfig();
  if (!providers.length) throw new Error('ai_not_configured');
  let lastError = null;
  for (const provider of providers) {
    try {
      const options = providerOptions(provider.id, provider.model);
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(provider.id === 'azure' ? { 'api-key': provider.key } : { Authorization: `Bearer ${provider.key}` }),
          ...providerHeaders(provider.id),
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: safeTemperature(temperature),
          max_tokens: Math.max(200, Math.min(1200, Number(maxOutputTokens) || 700)),
          ...options,
          response_format: { type: 'json_schema', json_schema: { name: task.replace(/[^a-z0-9_]+/gi, '_').slice(0, 64) || 'structured_output', strict: true, schema } },
        }),
      });
      if (!response.ok) {
        const code = response.status === 401 || response.status === 403
          ? 'provider_4xx'
          : response.status === 429
            ? 'budget_exceeded'
            : response.status >= 500 ? 'provider_5xx' : 'provider_4xx';
        throw new Error(code);
      }
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      const data = parseJson(content);
      return {
        data,
        trace: {
          provider: provider.id,
          model: payload.model || provider.model,
          usage: payload.usage || null,
          task,
          fallback: false,
          costQualityTradeoff: provider.id === 'openrouter' ? Math.max(0, Math.min(10, Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF)))) : null,
        },
      };
    } catch (error) {
      lastError = error;
      // An explicitly selected provider must not silently switch to another
      // provider.  For the implicit MVP setting, OpenAI may fall back to
      // OpenRouter when its key is present.
      if (String(process.env.AI_PROVIDER || '').trim()) break;
    }
  }
  throw lastError || new Error('provider_error');
}

export { parseJson };
