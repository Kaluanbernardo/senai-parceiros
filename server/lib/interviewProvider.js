import { generateStructured } from './structuredGeneration.js';

const DEFAULT_OPENROUTER_MODEL = 'openrouter/auto';
export const INTERVIEW_DIMENSIONS = Object.freeze([
  'impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk',
]);

// The model may choose only fields that the brief/ranking already understands.
// The API applies the category/objective eligibility rules a second time.
export const INTERVIEW_TARGET_FIELDS = Object.freeze([
  'context', 'desired_outcome', 'success_indicators', 'themes', 'contribution_types',
  'audience', 'communication_style', 'partnership_model', 'benchmark_focus',
  'research_output', 'evidence_preferences', 'geography', 'timeframe',
  'language_modality', 'budget', 'constraints', 'risk_rules', 'diversity_preferences',
]);

export const nextQuestionSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['shouldStop', 'stopReason', 'targetField', 'prompt', 'helper', 'example', 'answerKind', 'reasonTag', 'dimensionsCovered', 'factsExtracted', 'fieldsSatisfied', 'remainingGaps', 'adaptationExplanation'],
  properties: {
    shouldStop: { type: 'boolean' },
    stopReason: { type: 'string' },
    targetField: { type: 'string', enum: INTERVIEW_TARGET_FIELDS },
    prompt: { type: 'string' },
    helper: { type: 'string' },
    example: { type: 'string' },
    answerKind: { type: 'string', enum: ['text', 'textarea', 'multiline'] },
    reasonTag: { type: 'string' },
    dimensionsCovered: { type: 'array', items: { type: 'string', enum: INTERVIEW_DIMENSIONS } },
    factsExtracted: { type: 'array', items: { type: 'string' } },
    // Campos que a última resposta já entregou sem terem sido perguntados.
    // É o que permite encerrar a entrevista assim que o mínimo necessário
    // estiver coberto, em vez de percorrer um roteiro fixo.
    fieldsSatisfied: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'value', 'confidence'],
        properties: {
          field: { type: 'string', enum: INTERVIEW_TARGET_FIELDS },
          value: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    remainingGaps: { type: 'array', items: { type: 'string' } },
    adaptationExplanation: { type: 'string' },
  },
});

function text(value, max = 500) { return String(value || '').trim().slice(0, max); }

function parseContent(content) {
  if (content && typeof content === 'object') return content;
  const value = String(content || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(value);
}

export function normalizeQuestion(value, allowedTargetFields = INTERVIEW_TARGET_FIELDS) {
  if (!value || typeof value !== 'object') throw new Error('invalid_structured_output');
  // Accept the v2 nested contract while emitting the v4 flat contract. This
  // keeps old mocks and in-flight sessions compatible during the handoff.
  const nested = value.question && typeof value.question === 'object' ? value.question : value;
  // Legacy provider responses used an arbitrary question id (for example
  // `adaptive_publico`) instead of a canonical target field. Keep that id for
  // compatibility, while routing the response through a safe canonical
  // field until the provider adopts the new contract.
  const legacyTarget = typeof nested.id === 'string' && nested.id.startsWith('adaptive_') ? 'audience' : '';
  const targetField = text(value.targetField || nested.targetField || (INTERVIEW_TARGET_FIELDS.includes(nested.id) ? nested.id : legacyTarget), 80);
  const dimensionsCovered = Array.isArray(value.dimensionsCovered)
    ? value.dimensionsCovered.filter((item) => INTERVIEW_DIMENSIONS.includes(item)) : [];
  const factsExtracted = Array.isArray(value.factsExtracted) ? value.factsExtracted.map((item) => text(item, 180)).filter(Boolean) : [];
  const fieldsSatisfied = Array.isArray(value.fieldsSatisfied)
    ? value.fieldsSatisfied
      .map((item) => ({ field: text(item?.field, 80), value: text(item?.value, 500), confidence: Number(item?.confidence) }))
      .filter((item) => INTERVIEW_TARGET_FIELDS.includes(item.field) && item.value && Number.isFinite(item.confidence))
      .map((item) => ({ ...item, confidence: Math.max(0, Math.min(1, item.confidence)) }))
      .slice(0, INTERVIEW_TARGET_FIELDS.length)
    : [];
  const remainingGaps = Array.isArray(value.remainingGaps) ? value.remainingGaps.map((item) => text(item, 180)).filter(Boolean) : [];
  const answerKind = ['text', 'textarea', 'multiline'].includes(nested.answerKind) ? nested.answerKind : 'textarea';
  const normalized = {
    shouldStop: Boolean(value.shouldStop),
    stopReason: text(value.stopReason, 300),
    targetField,
    question: {
      // `id` is deliberately not trusted by the API; it derives a stable id
      // from turn + targetField. Retaining it here is for backwards clients.
      id: text(nested.id || targetField, 80),
      targetField,
      prompt: text(value.prompt || nested.prompt, 600),
      helper: text(value.helper || nested.helper, 500),
      example: text(value.example || nested.example, 500),
      answerKind,
      reasonTag: text(value.reasonTag || nested.reasonTag, 100),
    },
    dimensionsCovered,
    factsExtracted,
    fieldsSatisfied,
    remainingGaps,
    adaptationExplanation: text(value.adaptationExplanation, 300),
  };
  if (!normalized.shouldStop && (!allowedTargetFields.includes(normalized.targetField) || !normalized.question.prompt || !normalized.question.reasonTag)) {
    throw new Error('invalid_structured_output');
  }
  return normalized;
}

function transcriptFor(state) {
  const source = Array.isArray(state.transcript) ? state.transcript : Array.isArray(state.history) ? state.history : [];
  let total = 0;
  const output = [];
  for (const entry of source.slice(-20)) {
    const item = {
      turn: Number(entry.turn || output.length + 1),
      displayedQuestion: text(entry.displayedQuestion || entry.prompt || entry.question || '', 600),
      answer: text(entry.answer, 4000),
      targetField: text(entry.targetField || entry.questionId, 80),
      dimensions: Array.isArray(entry.dimensions) ? entry.dimensions.filter((d) => INTERVIEW_DIMENSIONS.includes(d)) : [],
    };
    const length = JSON.stringify(item).length;
    if (total + length > 24000) break;
    output.push(item);
    total += length;
  }
  return output;
}

function interviewPrompt(state) {
  const payload = {
    category: state.category,
    objective: state.objective,
    context: text(state.context || state.answers?.context, 2000),
    transcript: transcriptFor(state),
    coveredFields: Array.isArray(state.coveredFields) ? state.coveredFields : [],
    remainingRequiredFields: Array.isArray(state.remainingRequiredFields) ? state.remainingRequiredFields : [],
    semanticFacts: Array.isArray(state.semanticFacts) ? state.semanticFacts.slice(-20) : [],
    remainingGaps: Array.isArray(state.remainingGaps) ? state.remainingGaps.slice(-20) : [],
    askedIds: Array.isArray(state.askedIds) ? state.askedIds : [],
    currentQuestion: state.currentQuestion ? {
      prompt: text(state.currentQuestion.prompt, 600),
      targetField: text(state.currentQuestion.targetField || state.currentQuestion.id, 80),
    } : null,
    lastAnswer: text(state.lastAnswer, 4000),
    derivedFields: state.derivedFields && typeof state.derivedFields === 'object' ? state.derivedFields : {},
    limits: {
      minQuestions: Number(state.minQuestions) || 4,
      maxQuestions: Number(state.maxQuestions) || 12,
      aggregateCharacters: 24000,
    },
  };
  return [
    'Você conduz uma entrevista conversacional para a ferramenta de stakeholders do SENAI-SP. Fale como alguém que está realmente escutando, não como um formulário.',
    'Escreva UMA próxima pergunta que só faça sentido depois de ler a última resposta: retome a situação, o vocabulário e os detalhes que a pessoa deu. Nunca reutilize uma frase genérica.',
    'Antes de perguntar, extraia: liste em fieldsSatisfied todo campo que a última resposta já respondeu, mesmo sem ter sido perguntado, com o valor em texto e a confiança de 0 a 1. Um campo em fieldsSatisfied ou em coveredFields NÃO pode ser perguntado de novo, nem com outras palavras.',
    'Objetivo da entrevista: obter o mínimo necessário para diferenciar stakeholders do catálogo — contexto, resultado esperado, temas, público, geografia e restrições. Assim que isso estiver coberto, responda shouldStop=true. Perguntar além disso é desperdiçar o tempo da pessoa.',
    'Se a resposta anterior foi vaga ou "não sei", faça uma pergunta de descoberta concreta e fácil, com um exemplo do próprio contexto dela — não repita a mesma pergunta em outras palavras.',
    'Escolha somente um targetField do enum. Não invente fatos, não recomende stakeholders e não revele raciocínio interno.',
    'Use linguagem simples, de uma frase. Adapte o exemplo ao contexto informado (benchmarking não é evento; escola não é pesquisador). Responda somente no JSON schema.',
    `Não encerre antes de ${payload.limits.minQuestions} perguntas ou com campo obrigatório ausente em remainingRequiredFields; nunca ultrapasse ${payload.limits.maxQuestions}.`,
    JSON.stringify(payload),
  ].join('\n');
}

export async function generateNextQuestionWithProvider(state, { signal } = {}) {
  const generated = await generateStructured({
    task: 'adaptive_interview_question',
    schema: nextQuestionSchema,
    messages: [
      { role: 'system', content: 'Responda somente JSON válido conforme o schema solicitado.' },
      { role: 'user', content: interviewPrompt(state) },
    ],
    maxOutputTokens: 800,
    signal,
  });
  const result = normalizeQuestion(generated.data);
  return {
    ...result,
    trace: { ...generated.trace, model: generated.trace.model || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL },
  };
}

export { parseContent };
