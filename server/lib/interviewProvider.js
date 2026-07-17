const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
const DEFAULT_TRADEOFF = 7;

export const INTERVIEW_DIMENSIONS = Object.freeze([
  'impact',
  'alignment',
  'credibility',
  'collaboration',
  'feasibility',
  'risk',
]);

export const nextQuestionSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['shouldStop', 'stopReason', 'question', 'dimensionsCovered', 'factsExtracted', 'remainingGaps'],
  properties: {
    shouldStop: { type: 'boolean' },
    stopReason: { type: 'string' },
    question: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'prompt', 'helper', 'example', 'answerKind', 'reasonTag'],
      properties: {
        id: { type: 'string' },
        prompt: { type: 'string' },
        helper: { type: 'string' },
        example: { type: 'string' },
        answerKind: { type: 'string', enum: ['text', 'textarea', 'multiline'] },
        reasonTag: { type: 'string' },
      },
    },
    dimensionsCovered: { type: 'array', items: { type: 'string', enum: INTERVIEW_DIMENSIONS } },
    factsExtracted: { type: 'array', items: { type: 'string' } },
    remainingGaps: { type: 'array', items: { type: 'string' } },
  },
});

function parseContent(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function normalizeQuestion(value) {
  if (!value || typeof value !== 'object') throw new Error('invalid_structured_output');
  const question = value.question || {};
  const dimensionsCovered = Array.isArray(value.dimensionsCovered)
    ? value.dimensionsCovered.filter((item) => INTERVIEW_DIMENSIONS.includes(item))
    : [];
  const factsExtracted = Array.isArray(value.factsExtracted) ? value.factsExtracted.map((item) => text(item, 180)).filter(Boolean) : [];
  const remainingGaps = Array.isArray(value.remainingGaps) ? value.remainingGaps.map((item) => text(item, 180)).filter(Boolean) : [];
  const answerKind = ['text', 'textarea', 'multiline'].includes(question.answerKind) ? question.answerKind : 'textarea';
  const normalized = {
    shouldStop: Boolean(value.shouldStop),
    stopReason: text(value.stopReason, 300),
    question: {
      id: text(question.id, 80),
      prompt: text(question.prompt, 600),
      helper: text(question.helper, 500),
      example: text(question.example, 500),
      answerKind,
      reasonTag: text(question.reasonTag, 100),
    },
    dimensionsCovered,
    factsExtracted,
    remainingGaps,
  };
  if (!normalized.shouldStop && (!normalized.question.id || !normalized.question.prompt || !normalized.question.reasonTag)) {
    throw new Error('invalid_structured_output');
  }
  return normalized;
}

function interviewPrompt(state) {
  const { category, objective, answers, history, askedIds, currentQuestion, lastAnswer, coverage, remainingGaps } = state;
  return [
    'Você é o entrevistador adaptativo da ferramenta de stakeholders do SENAI-SP.',
    'Interprete semanticamente a última resposta e formule apenas a próxima pergunta mais útil para diferenciar candidatos do catálogo.',
    'O usuário pode ser leigo: use linguagem simples, explique por que a pergunta importa e adapte o exemplo ao contexto real.',
    'Nunca invente fatos, não recomende stakeholders e não revele raciocínio interno. Responda somente no JSON schema.',
    'A seleção considera educação profissional de qualidade, desenvolvimento da indústria paulista, inovação, tecnologia, sustentabilidade e desenvolvimento regional.',
    'Não repita perguntas já respondidas. Se uma informação já estiver clara, aprofunde outra lacuna ou encerre.',
    'A entrevista deve ter no mínimo 8 e no máximo 20 perguntas; não peça dados privados ou segredos.',
    JSON.stringify({ category, objective, answers, history, askedIds, currentQuestion, lastAnswer, coverage, remainingGaps }),
  ].join('\n');
}

async function callProvider({ endpoint, apiKey, model, headers, body, signal, plugins, providerOptions }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Responda somente JSON válido conforme o schema solicitado.' },
        { role: 'user', content: body },
      ],
      temperature: 0.2,
      ...(plugins ? { plugins } : {}),
      ...(providerOptions ? { provider: providerOptions } : {}),
      response_format: { type: 'json_schema', json_schema: { name: 'adaptive_interview_question', strict: true, schema: nextQuestionSchema } },
    }),
  });
  if (!response.ok) throw new Error(`ai_http_${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  return { result: normalizeQuestion(parseContent(content)), payload };
}

export async function generateNextQuestionWithProvider(state, { signal } = {}) {
  const preferred = String(process.env.AI_PROVIDER || '').toLowerCase();
  const providers = preferred === 'openai'
    ? [{ id: 'openai', key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, endpoint: 'https://api.openai.com/v1/chat/completions' }]
    : preferred === 'openrouter'
      ? [{ id: 'openrouter', key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL, endpoint: 'https://openrouter.ai/api/v1/chat/completions' }]
      : [
        { id: 'openai', key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, endpoint: 'https://api.openai.com/v1/chat/completions' },
        { id: 'openrouter', key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL, endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
      ];
  const provider = providers.find((item) => item.key);
  if (!provider) throw new Error('ai_not_configured');
  const headers = provider.id === 'openrouter'
    ? {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://senai-parceiros.vercel.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'SENAI-SP Parceiros',
      'X-OpenRouter-Metadata': 'enabled',
    }
    : {};
  const { result, payload } = await callProvider({
    endpoint: provider.endpoint,
    apiKey: provider.key,
    model: provider.model,
    headers,
    body: interviewPrompt(state),
    signal,
    plugins: provider.id === 'openrouter' ? [{ id: 'auto-router', cost_quality_tradeoff: Math.max(0, Math.min(10, Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF)))) }] : undefined,
    providerOptions: provider.id === 'openrouter' ? { require_parameters: true } : undefined,
  });
  return {
    ...result,
    trace: {
      provider: provider.id,
      model: payload.model || provider.model,
      usage: payload.usage || null,
      costQualityTradeoff: provider.id === 'openrouter' ? Math.round(Number(process.env.OPENROUTER_COST_QUALITY_TRADEOFF || DEFAULT_TRADEOFF)) : null,
    },
  };
}

export { normalizeQuestion };
