const DEFAULT_MODEL = 'openrouter/auto';
const DEFAULT_TRADEOFF = 7;

const evaluationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evaluations'],
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'dimensions', 'confidence', 'summary', 'gaps', 'evidence', 'severeRisk'],
        properties: {
          id: { type: 'string' },
          dimensions: {
            type: 'object',
            additionalProperties: false,
            required: ['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk'],
            properties: {
              impact: { type: 'number' },
              alignment: { type: 'number' },
              credibility: { type: 'number' },
              collaboration: { type: 'number' },
              feasibility: { type: 'number' },
              risk: { type: 'number' },
            },
          },
          confidence: { type: 'number' },
          summary: { type: 'string' },
          gaps: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { type: 'string' } },
          severeRisk: {
            type: 'object',
            additionalProperties: false,
            required: ['confirmed', 'evidence'],
            properties: {
              confirmed: { type: 'boolean' },
              evidence: { type: 'string' },
            },
          },
          dimensionRationale: {
            type: 'object',
            additionalProperties: false,
            properties: {
              impact: { type: 'string' }, alignment: { type: 'string' }, credibility: { type: 'string' },
              collaboration: { type: 'string' }, feasibility: { type: 'string' }, risk: { type: 'string' },
            },
          },
          comparativeEdge: { type: 'string' },
          tradeoffs: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function normalizeEvaluation(value) {
  if (!value || !Array.isArray(value.evaluations)) throw new Error('invalid_structured_output');
  return {
    evaluations: value.evaluations.map((entry) => ({
      ...entry,
      dimensions: Object.fromEntries(Object.entries(entry.dimensions || {}).map(([key, item]) => [key, clamp(item)])),
      confidence: clamp(entry.confidence),
      summary: String(entry.summary || ''),
      gaps: Array.isArray(entry.gaps) ? entry.gaps.map(String) : [],
      evidence: Array.isArray(entry.evidence) ? entry.evidence.map(String) : [],
      severeRisk: (() => {
        const evidence = String(entry.severeRisk?.evidence || '').trim();
        return { confirmed: Boolean(entry.severeRisk?.confirmed && evidence), evidence };
      })(),
      dimensionRationale: Object.fromEntries(Object.entries(entry.dimensionRationale || {}).map(([key, value]) => [key, String(value).slice(0, 500)])),
      comparativeEdge: String(entry.comparativeEdge || '').slice(0, 600),
      tradeoffs: Array.isArray(entry.tradeoffs) ? entry.tradeoffs.map(String).slice(0, 6) : [],
    })),
  };
}

function parseContent(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

async function evaluateWithEndpoint({ input, candidates, signal, apiKey, model, endpoint, provider, headers = {}, authHeaders, plugins, providerOptions }) {
  if (!apiKey) throw new Error(`${provider}_not_configured`);
  const tradeoff = Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF));
  const { candidates: _catalog, ...inputContext } = input || {};
  const prompt = [
    'Você é um avaliador de stakeholders do SENAI-SP.',
    'Avalie exclusivamente os candidatos fornecidos, considerando o contexto e as respostas.',
    'Use apenas informações presentes no perfil; registre lacunas em gaps e não invente evidências.',
    'Além do contexto informado, considere o baseline SENAI-SP: competitividade e desenvolvimento sustentável da indústria paulista; educação profissional conectada ao trabalho; inovação e tecnologia; desenvolvimento regional; parcerias; Indústria 4.0; ESG; descarbonização e economia circular.',
    'Pontue cada dimensão de 0 a 100. Risco grave só pode ser confirmado com evidência objetiva e verificável.',
    'Não aplique a mesma nota a candidatos diferentes sem justificar a equivalência. Para cada candidato, explique em dimensionRationale quais fatos sustentam as dimensões, registre comparativeEdge (em que ele difere dos demais) e tradeoffs (o que se ganha e o que se perde).',
    'Retorne o id de cada candidato como texto, exatamente como foi fornecido.',
    'Em evidence, cite somente nomes de campos ou URLs que aparecem no perfil fornecido.',
    JSON.stringify({ input: inputContext, candidates }),
  ].join('\n');
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(authHeaders || { Authorization: `Bearer ${apiKey}` }), ...headers },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: 'Responda somente JSON válido conforme o schema solicitado.' }, { role: 'user', content: prompt }],
      temperature: 0.1,
      ...(plugins ? { plugins } : {}),
      ...(providerOptions ? { provider: providerOptions } : {}),
      response_format: { type: 'json_schema', json_schema: { name: 'selection_evaluation', strict: true, schema: evaluationSchema } },
    }),
  });
  if (!response.ok) throw new Error(`${provider}_http_${response.status}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  const result = normalizeEvaluation(parseContent(choice?.message?.content));
  return {
    ...result,
    model: payload.model || model,
    provider,
    costQualityTradeoff: provider === 'openrouter' ? tradeoff : null,
    routing: provider === 'openrouter' ? payload.openrouter_metadata || null : null,
    usage: payload.usage || null,
  };
}

export async function evaluateWithOpenRouter({ input, candidates, signal }) {
  return evaluateWithEndpoint({
    input,
    candidates,
    signal,
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    provider: 'openrouter',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://senai-parceiros.vercel.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'SENAI-SP Parceiros',
      'X-OpenRouter-Metadata': 'enabled',
    },
    plugins: [{ id: 'auto-router', cost_quality_tradeoff: Math.max(0, Math.min(10, Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF)))) }],
    providerOptions: { require_parameters: true },
  });
}

export async function evaluateWithOpenAI({ input, candidates, signal }) {
  return evaluateWithEndpoint({
    input,
    candidates,
    signal,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    provider: 'openai',
  });
}

export async function evaluateWithAzure({ input, candidates, signal }) {
  const endpoint = String(process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  const deployment = encodeURIComponent(process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL || '');
  if (!endpoint || !deployment || !process.env.AZURE_OPENAI_API_KEY) throw new Error('azure_not_configured');
  const apiVersion = encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || '2024-10-21');
  const url = endpoint.includes('/openai/deployments/')
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}api-version=${apiVersion}`
    : `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  return evaluateWithEndpoint({
    input, candidates, signal, apiKey: process.env.AZURE_OPENAI_API_KEY,
    model: process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_MODEL || deployment,
    endpoint: url, provider: 'azure', authHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
  });
}

export { evaluationSchema };
