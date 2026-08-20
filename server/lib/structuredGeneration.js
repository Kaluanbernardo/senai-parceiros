/**
 * Server-only boundary for structured model output.
 *
 * Domain modules should not know how a provider is selected, authenticated or
 * how JSON is extracted from a chat completion.  Keeping that concern here
 * also makes the handoff to Azure OpenAI (or an internal SENAI provider) a
 * configuration change instead of a rewrite of the interview flow.
 */

import { aiCacheKey, readAiCache, writeAiCache } from './aiCache.js';
import { requiresDefaultTemperature } from './modelCapabilities.js';

const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_TRADEOFF = 7;
/**
 * Extração e avaliação pedem determinismo. Redação, não: uma entrevista escrita
 * sempre com a mesma temperatura baixa produz perguntas que se parecem entre si
 * a cada sessão. Quem escreve pergunta passa a própria temperatura.
 */
const DEFAULT_TEMPERATURE = 0.15;
/**
 * Teto de saida. Os 1200 anteriores foram dimensionados para um schema bem
 * menor; com um schema maior — e sobretudo com um modelo de raciocinio, cujos
 * tokens de pensamento contam contra este mesmo teto — a resposta era cortada
 * no meio e chegava aqui como JSON invalido. Cortar por engano custa a chamada
 * inteira, entao o teto e alto e quem chama pede o que precisa.
 */
const MAX_OUTPUT_TOKENS = 16000;

function modelForTask(task, requestedModel, providerModel) {
  if (String(requestedModel || '').trim()) return String(requestedModel).trim();
  if (providerModel !== DEFAULT_OPENROUTER_MODEL) return providerModel;
  const name = String(task || '').toLowerCase();
  const mapped = name.includes('interview') ? process.env.AI_MODEL_INTERVIEW
    : name.includes('selection') || name.includes('evaluate') ? process.env.AI_MODEL_SELECTION
      : name.includes('catalog_research') ? process.env.AI_MODEL_CATALOG_RESEARCH
        : name.includes('catalog_enrichment') ? process.env.AI_MODEL_CATALOG_ENRICHMENT
          : name.includes('radar_editorial') ? process.env.AI_MODEL_RADAR_EDITORIAL
            : name.includes('radar') ? process.env.AI_MODEL_RADAR_SUMMARY
              : '';
  return String(mapped || providerModel).trim();
}

/**
 * Nem toda chamada tem o mesmo valor por acerto. Escrever a pergunta da
 * entrevista uma vez errado custa a conversa inteira; reescrever um item do
 * Radar em lote, não. Por isso o equilíbrio custo/qualidade é por chamada, e
 * não uma constante do sistema.
 */
function safeTradeoff(value) {
  const number = Number(value ?? process.env.OPENROUTER_COST_QUALITY_TRADEOFF ?? DEFAULT_TRADEOFF);
  if (!Number.isFinite(number)) return DEFAULT_TRADEOFF;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function safeTemperature(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_TEMPERATURE;
  return Math.max(0, Math.min(1.2, number));
}

function safeInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(number)));
}

/**
 * Configuração pequena e deliberadamente fechada para a busca hospedada pelo
 * OpenRouter. A interface não aceita ferramentas arbitrárias: isso impediria
 * cada domínio de montar corpos de provedor diferentes e transformaria esta
 * seam num simples pass-through.
 */
function webSearchTool(options) {
  if (!options) return null;
  const requested = typeof options === 'object' ? options : {};
  const engines = new Set(['auto', 'native', 'exa', 'firecrawl', 'parallel', 'perplexity']);
  const sizes = new Set(['low', 'medium', 'high']);
  return {
    type: 'openrouter:web_search',
    parameters: {
      engine: engines.has(requested.engine) ? requested.engine : 'auto',
      max_results: safeInteger(requested.maxResults, 1, 25, 8),
      max_total_results: safeInteger(requested.maxTotalResults, 2, 20, 20),
      search_context_size: sizes.has(requested.searchContextSize) ? requested.searchContextSize : 'high',
    },
  };
}

function webSearchSources(message) {
  return (Array.isArray(message?.annotations) ? message.annotations : [])
    .filter((annotation) => annotation?.type === 'url_citation' && /^https?:\/\//i.test(String(annotation.url_citation?.url || '')))
    .map((annotation) => ({
      url: String(annotation.url_citation.url).slice(0, 2000),
      title: String(annotation.url_citation.title || '').slice(0, 240),
      content: String(annotation.url_citation.content || '').slice(0, 1200),
    }));
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

/**
 * Extrai a explicacao do provedor sem carregar corpo arbitrario adiante.
 *
 * Só o campo de mensagem de erro, truncado. Se a resposta não for o JSON de
 * erro esperado, nada é aproveitado: um corpo desconhecido não vira
 * diagnóstico, vira ruído — e pode carregar o que não deveria sair daqui.
 */
async function providerFailureMessage(response) {
  try {
    const raw = await response.text();
    if (!raw || raw.length > 8000) return '';
    const parsed = JSON.parse(raw);
    const message = parsed?.error?.message || parsed?.message || '';
    const reason = parsed?.error?.code || parsed?.error?.type || '';
    return String([reason, message].filter(Boolean).join(': ') || '').slice(0, 300);
  } catch {
    return '';
  }
}

function parseJson(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  // Um modelo de raciocinio pode devolver o pensamento noutro campo e deixar
  // `content` vazio. Isso nao e o mesmo problema que responder prosa, e a
  // correcao e outra — o codigo do erro precisa dizer qual dos dois foi.
  if (!text) throw new Error('empty_output');
  try {
    return JSON.parse(text);
  } catch {
    // Alguns modelos cercam o JSON de uma frase de cortesia. O objeto ainda
    // esta inteiro ali; recusar por causa da moldura seria desperdicar uma
    // resposta boa. Um JSON truncado continua falhando, como deve.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        throw new Error('invalid_output');
      }
    }
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
/**
 * Raciocinio interno desligado por padrao.
 *
 * Um modelo de raciocinio gastou 54 tokens pensando para responder sete de
 * conteudo — e o tempo desse pensamento e tempo de tela parada. Aqui ele e
 * redundante por construcao: o schema ja exige o raciocinio em campos
 * proprios (leitura da situacao, pressupostos recusados, alternativas
 * consideradas, justificativa da escolha), que sao auditaveis. Pensar duas
 * vezes custa o dobro e so a metade fica registrada.
 *
 * `OPENROUTER_REASONING` reativa quando for desejado: low, medium ou high.
 */
function reasoningOption(disableReasoning = false, defaultDisabled = true) {
  if (disableReasoning) return { reasoning: { enabled: false } };
  const configured = String(process.env.OPENROUTER_REASONING || '').trim().toLowerCase();
  if (['low', 'medium', 'high'].includes(configured)) return { reasoning: { effort: configured } };
  return defaultDisabled ? { reasoning: { enabled: false } } : {};
}

function providerOptions(provider, model, costQualityTradeoff, disableReasoning, strictOutput, requireParameters) {
  if (provider !== 'openrouter') return {};
  const isAutoRouter = String(model || '').trim().toLowerCase() === DEFAULT_OPENROUTER_MODEL;
  // Um modelo fixado já define se raciocínio existe. Enviar implicitamente o
  // parâmetro `reasoning` para um modelo que não o declara, junto com
  // `require_parameters`, faz o OpenRouter recusar a chamada antes de gerar.
  // No Auto Router ele continua explícito para evitar que a rota escolha um
  // modelo de raciocínio e reintroduza latência sem o chamador pedir.
  const base = {
    ...(strictOutput && requireParameters ? { provider: { require_parameters: true } } : {}),
    ...reasoningOption(disableReasoning, isAutoRouter),
  };
  if (!isAutoRouter) return base;
  return {
    ...base,
    plugins: [{ id: 'auto-router', cost_quality_tradeoff: safeTradeoff(costQualityTradeoff) }],
  };
}

/**
 * Generate and parse a strict JSON response.
 * `messages` may contain a system message and a user message.  The returned
 * trace is deliberately sanitized: it contains no prompt, response body or
 * credential.
 */
export async function generateStructured({ task = 'structured_generation', schema, messages, model: requestedModel, strictOutput = true, requireParameters = true, maxOutputTokens = 700, temperature = DEFAULT_TEMPERATURE, costQualityTradeoff, disableReasoning = false, webSearch, signal } = {}) {
  if (!schema || !Array.isArray(messages) || !messages.length) throw new Error('invalid_generation_request');
  const searchTool = webSearchTool(webSearch);
  // A ferramenta hospedada de busca usa o contrato do OpenRouter. Quando ela é
  // requerida, cair silenciosamente para OpenAI/Azure produziria uma resposta
  // sem pesquisa atual, apesar de a interface afirmar o contrário.
  const providers = providerConfig().filter((provider) => !searchTool || provider.id === 'openrouter');
  if (!providers.length) throw new Error('ai_not_configured');
  const cacheable = /^catalog_|^radar_/.test(String(task));
  const cacheModel = modelForTask(task, requestedModel, providers[0].model);
  const cacheKey = cacheable ? aiCacheKey({ task, model: cacheModel, schema, messages, strictOutput, requireParameters, webSearch }) : null;
  if (cacheKey) {
    const cached = await readAiCache(cacheKey);
    if (cached) return { data: cached.data, trace: { ...(cached.trace || {}), cacheHit: true, usage: { total_tokens: 0, cost: 0 } } };
  }
  let lastError = null;
  for (const provider of providers) {
    try {
      const providerModel = provider.id === 'openrouter'
        ? modelForTask(task, requestedModel, provider.model)
        : provider.model;
      const options = providerOptions(provider.id, providerModel, costQualityTradeoff, disableReasoning, strictOutput, requireParameters);
      const outputTokenLimit = Math.max(200, Math.min(MAX_OUTPUT_TOKENS, Number(maxOutputTokens) || 700));
      // Os modelos de raciocínio da OpenAI usam o contrato novo de Chat
      // Completions: recusam `max_tokens` e temperaturas diferentes do padrão.
      // Esforço mínimo deixa o orçamento para o JSON auditável da entrevista.
      const reasoningModel = requiresDefaultTemperature(providerModel);
      const generationParameters = provider.id === 'openai'
        ? {
            max_completion_tokens: outputTokenLimit,
            ...(reasoningModel ? { reasoning_effort: 'minimal' } : { temperature: safeTemperature(temperature) }),
          }
        : {
            ...(!reasoningModel ? { temperature: safeTemperature(temperature) } : {}),
            max_tokens: outputTokenLimit,
          };
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(provider.id === 'azure' ? { 'api-key': provider.key } : { Authorization: `Bearer ${provider.key}` }),
          ...providerHeaders(provider.id),
        },
        body: JSON.stringify({
          model: providerModel,
          messages,
          ...generationParameters,
          ...options,
          ...(searchTool ? { tools: [searchTool] } : {}),
          ...(strictOutput ? { response_format: { type: 'json_schema', json_schema: { name: task.replace(/[^a-z0-9_]+/gi, '_').slice(0, 64) || 'structured_output', strict: true, schema } } } : {}),
        }),
      });
      if (!response.ok) {
        const code = response.status === 401 || response.status === 403
          ? 'provider_4xx'
          : response.status === 429
            ? 'budget_exceeded'
            : response.status >= 500 ? 'provider_5xx' : 'provider_4xx';
        const failure = new Error(code);
        failure.status = response.status;
        // O provedor explica a recusa em texto — schema invalido, nenhum
        // endpoint compativel, politica de dados — e sem isso o diagnostico
        // vira tentativa e erro. Fica numa propriedade separada, nunca em
        // `message`: so a superficie administrativa a le, e o codigo continua
        // sendo a unica coisa que chega ao usuario e a trace.
        failure.providerMessage = await providerFailureMessage(response);
        throw failure;
      }
      const payload = await response.json();
      const choice = payload.choices?.[0];
      // `length` significa que a resposta bateu no teto de tokens e parou no
      // meio. Sem distinguir isso de um modelo que ignora o schema, a mesma
      // mensagem levava a dois diagnosticos opostos: "troque o modelo" quando
      // bastava dar mais espaco.
      if (choice?.finish_reason === 'length') throw new Error('output_truncated');
      const data = parseJson(choice?.message?.content);
      const result = {
        data,
        trace: {
          provider: provider.id,
          model: payload.model || providerModel,
          usage: payload.usage || null,
          cost: Number(payload.usage?.cost ?? payload.usage?.cost_usd ?? 0) || 0,
          cacheHit: Boolean(payload.usage?.cache_hit || payload.usage?.cached_tokens),
          task,
          fallback: false,
          costQualityTradeoff: provider.id === 'openrouter' ? safeTradeoff(costQualityTradeoff) : null,
          webSearchRequests: Number(payload.usage?.server_tool_use?.web_search_requests || 0),
          webSearchSources: searchTool ? webSearchSources(choice?.message) : [],
        },
      };
      if (cacheKey) await writeAiCache(cacheKey, task, result.trace.model, { data: result.data, trace: result.trace });
      return result;
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
