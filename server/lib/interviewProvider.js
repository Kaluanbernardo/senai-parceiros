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

// A ordem das propriedades é deliberada: o modelo escreve primeiro a leitura da
// resposta, o que já foi extraído e as alternativas de pergunta que considerou;
// só então redige a pergunta. Como a geração é sequencial, pensar antes de
// perguntar deixa de ser um pedido no prompt e passa a ser parte do formato.
export const nextQuestionSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'situationRead', 'fieldsSatisfied', 'factsExtracted', 'remainingGaps', 'assumptionsAvoided',
    'candidateQuestions', 'chosenBecause', 'shouldStop', 'stopReason', 'targetField',
    'prompt', 'helper', 'example', 'answerKind', 'reasonTag', 'dimensionsCovered', 'adaptationExplanation',
  ],
  properties: {
    // Uma frase sobre o que a última resposta realmente disse — inclusive o que
    // ela deixou em aberto. É o que impede a pergunta seguinte de ser escolhida
    // por posição numa lista.
    situationRead: { type: 'string' },
    // Pressupostos que a situação NÃO autoriza (por exemplo: local do evento,
    // perfil do público). Declarar o pressuposto é o que transforma um palpite
    // em pergunta.
    assumptionsAvoided: { type: 'array', items: { type: 'string' } },
    // Duas a quatro perguntas possíveis, de ângulos diferentes, antes de
    // escolher uma. Sem alternativas escritas, o modelo tende a repetir a
    // mesma fórmula de pergunta a cada turno.
    candidateQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['targetField', 'draft', 'whatItDecides'],
        properties: {
          targetField: { type: 'string', enum: INTERVIEW_TARGET_FIELDS },
          draft: { type: 'string' },
          whatItDecides: { type: 'string' },
        },
      },
    },
    chosenBecause: { type: 'string' },
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
  const assumptionsAvoided = Array.isArray(value.assumptionsAvoided)
    ? value.assumptionsAvoided.map((item) => text(item, 180)).filter(Boolean).slice(0, 6) : [];
  // O raciocínio serve para escolher a pergunta e para explicar a escolha no
  // trace; ele nunca vira texto exibido ao usuário.
  const candidateQuestions = Array.isArray(value.candidateQuestions)
    ? value.candidateQuestions
      .map((item) => ({
        targetField: text(item?.targetField, 80),
        draft: text(item?.draft, 600),
        whatItDecides: text(item?.whatItDecides, 180),
      }))
      .filter((item) => INTERVIEW_TARGET_FIELDS.includes(item.targetField) && item.draft)
      .slice(0, 4)
    : [];
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
    situationRead: text(value.situationRead, 300),
    assumptionsAvoided,
    candidateQuestions,
    chosenBecause: text(value.chosenBecause, 300),
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

/**
 * Frases já mostradas à pessoa. Sem elas, o modelo só sabe *o que* já foi
 * perguntado (askedIds), não *como* — e acaba reescrevendo a mesma construção
 * turno após turno.
 */
function askedPromptsFor(state) {
  const source = Array.isArray(state.transcript) ? state.transcript : Array.isArray(state.history) ? state.history : [];
  return source
    .map((entry) => text(entry.displayedQuestion || entry.prompt || entry.question || '', 200))
    .filter(Boolean)
    .slice(-8);
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
    askedPrompts: askedPromptsFor(state),
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
    'Objetivo da entrevista: obter o mínimo necessário para diferenciar stakeholders do catálogo — contexto, resultado esperado, temas, público, geografia e restrições. Assim que isso estiver coberto, responda shouldStop=true. Perguntar além disso é desperdiçar o tempo da pessoa.',
    '',
    'PENSE ANTES DE PERGUNTAR, nesta ordem, e é isso que os primeiros campos do schema registram:',
    '1) situationRead: em uma frase, o que a última resposta realmente disse e o que ela deixou em aberto.',
    '2) fieldsSatisfied: todo campo que a última resposta já respondeu, mesmo sem ter sido perguntado, com o valor em texto e a confiança de 0 a 1. Um campo em fieldsSatisfied ou em coveredFields NÃO pode ser perguntado de novo, nem com outras palavras.',
    '3) assumptionsAvoided: o que você precisaria supor para pular uma pergunta — local, público, formato, quem paga, quem organiza. Cada suposição dessas é candidata a virar pergunta em vez de virar palpite.',
    '4) candidateQuestions: de duas a quatro perguntas possíveis, cada uma com um targetField DIFERENTE, e o que cada uma decide no ranking.',
    '5) chosenBecause: por que a pergunta escolhida muda mais a recomendação do que as outras candidatas. Escolha pelo que ainda está indefinido e pesa na decisão, não pela ordem de uma lista.',
    '',
    'PRESSUPOSTOS QUE VOCÊ NÃO PODE FAZER:',
    '- Local: um evento, visita, oficina ou reunião pode acontecer em qualquer lugar — numa unidade do SENAI-SP, na sede do parceiro, em outra cidade, em outro país, num espaço neutro ou totalmente online. Nunca escreva a pergunta, o helper ou o exemplo como se fosse "aqui na escola", "na nossa unidade" ou "na sua escola". Se o local muda a viabilidade da escolha, PERGUNTE onde acontece.',
    '- Público: o público não é necessariamente industriário nem gente da indústria. Pode ser estudante, docente, gestor público, pesquisador, comunidade, imprensa, empresa de qualquer setor ou público externo amplo. Nunca presuma indústria no texto da pergunta nem no exemplo. Se o público muda a escolha, PERGUNTE quem é.',
    '- Papel do SENAI-SP: quem usa a ferramenta trabalha no SENAI-SP, mas o SENAI-SP não é necessariamente o anfitrião, o financiador nem o beneficiário da atividade.',
    '- Não converta o objetivo em formato: benchmarking não é evento, apoio a pesquisa não é palestra, e uma instituição de ensino não é um pesquisador.',
    '',
    'VARIAÇÃO — cada pergunta deve soar diferente das anteriores:',
    '- askedPrompts traz as frases que a pessoa já viu. A nova pergunta não pode repetir a abertura, o verbo inicial nem a construção de nenhuma delas.',
    '- Alterne o tipo de pergunta entre turnos: pedir um exemplo concreto, pedir uma escolha entre dois cenários plausíveis, perguntar o que não pode acontecer, pedir o que mudaria depois, pedir a condição que faria a pessoa dizer não.',
    '- Retome a situação, o vocabulário e os detalhes que a pessoa deu. Nunca reutilize uma frase genérica nem cole um prefixo pronto na frente de uma pergunta de formulário.',
    '- Se a resposta anterior foi vaga ou "não sei", faça uma pergunta de descoberta concreta e fácil, com um exemplo tirado do próprio contexto dela — não repita a mesma pergunta em outras palavras.',
    '',
    'Escolha somente um targetField do enum, igual ao de uma das candidateQuestions. Não invente fatos e não recomende stakeholders.',
    'prompt, helper e example são o único texto que a pessoa lê: use uma frase simples em cada um e não deixe o raciocínio dos campos anteriores vazar para eles. Responda somente no JSON schema.',
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
    // O raciocínio (leitura, suposições e candidatas) ocupa espaço antes da
    // pergunta, e num modelo de raciocínio os tokens de pensamento contam
    // contra o mesmo teto. Com 1200 a resposta chegava cortada no meio, o que
    // aparecia como JSON inválido — o custo de um teto folgado é zero quando a
    // resposta cabe, e a chamada inteira quando não cabe.
    maxOutputTokens: Number(process.env.INTERVIEW_MAX_OUTPUT_TOKENS) || 3000,
    // Redigir pergunta não é extração: com temperatura de extração as perguntas
    // saíam parecidas entre si e entre sessões.
    temperature: Number(process.env.INTERVIEW_TEMPERATURE || 0.7),
    // A entrevista é a chamada sensível a qualidade: uma pergunta ruim custa a
    // conversa inteira, e o roteador não conhece a barra desta tarefa. Ela
    // pede o máximo de qualidade por padrão, enquanto o resto do sistema segue
    // o equilíbrio geral. Só vale para openrouter/auto.
    costQualityTradeoff: process.env.INTERVIEW_COST_QUALITY_TRADEOFF ?? 10,
    signal,
  });
  const result = normalizeQuestion(generated.data);
  return {
    ...result,
    trace: { ...generated.trace, model: generated.trace.model || process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL },
  };
}

export { parseContent };
