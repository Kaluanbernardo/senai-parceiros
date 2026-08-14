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
/**
 * Teto de saida. Os 1200 anteriores foram dimensionados para um schema bem
 * menor; com um schema maior — e sobretudo com um modelo de raciocinio, cujos
 * tokens de pensamento contam contra este mesmo teto — a resposta era cortada
 * no meio e chegava aqui como JSON invalido. Cortar por engano custa a chamada
 * inteira, entao o teto e alto e quem chama pede o que precisa.
 */
const MAX_OUTPUT_TOKENS = 4000;

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
  const engine = engines.has(requested.engine) ? requested.engine : 'auto';
  const searchContextSize = sizes.has(requested.searchContextSize) ? requested.searchContextSize : 'medium';
  return {
    type: 'openrouter:web_search',
    parameters: {
      engine,
      max_results: safeInteger(requested.maxResults, 1, 25, 5),
      max_total_results: safeInteger(requested.maxTotalResults, 2, 20, 12),
      search_context_size: searchContextSize,
    },
  };
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
function reasoningOption() {
  const configured = String(process.env.OPENROUTER_REASONING || '').trim().toLowerCase();
  if (['low', 'medium', 'high'].includes(configured)) return { reasoning: { effort: configured } };
  return { reasoning: { enabled: false } };
}

function providerOptions(provider, model, costQualityTradeoff, includeReasoning, strictOutput) {
  if (provider !== 'openrouter') return {};
  const base = {
    ...(strictOutput ? { provider: { require_parameters: true } } : {}),
    ...(includeReasoning ? reasoningOption() : { reasoning: { enabled: false } }),
  };
  if (String(model || '').trim().toLowerCase() !== DEFAULT_OPENROUTER_MODEL) return base;
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
export async function generateStructured({ task = 'structured_generation', schema, messages, model: requestedModel, includeReasoning = true, strictOutput = true, maxOutputTokens = 700, temperature = DEFAULT_TEMPERATURE, costQualityTradeoff, webSearch, signal } = {}) {
  if (!schema || !Array.isArray(messages) || !messages.length) throw new Error('invalid_generation_request');
  const searchTool = webSearchTool(webSearch);
  // A ferramenta hospedada de busca usa o contrato do OpenRouter. Quando ela é
  // requerida, cair silenciosamente para OpenAI/Azure produziria uma resposta
  // sem pesquisa atual, apesar de a interface afirmar o contrário.
  const providers = providerConfig().filter((provider) => !searchTool || provider.id === 'openrouter');
  if (!providers.length) throw new Error('ai_not_configured');
  let lastError = null;
  for (const provider of providers) {
    try {
      const providerModel = provider.id === 'openrouter' && String(requestedModel || '').trim()
        ? String(requestedModel).trim()
        : provider.model;
      const options = providerOptions(provider.id, providerModel, costQualityTradeoff, includeReasoning, strictOutput);
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
          temperature: safeTemperature(temperature),
          max_tokens: Math.max(200, Math.min(MAX_OUTPUT_TOKENS, Number(maxOutputTokens) || 700)),
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
      return {
        data,
        trace: {
          provider: provider.id,
          model: payload.model || providerModel,
          usage: payload.usage || null,
          task,
          fallback: false,
          costQualityTradeoff: provider.id === 'openrouter' ? safeTradeoff(costQualityTradeoff) : null,
          webSearchRequests: Number(payload.usage?.server_tool_use?.web_search_requests || 0),
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
