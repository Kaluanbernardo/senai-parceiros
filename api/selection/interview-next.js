import { getSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { consumeInterviewAttempt } from '../../server/lib/auth.js';
import { generateNextQuestionWithProvider } from '../../server/lib/ai.js';
import { InterviewPlanner, MAX_QUESTIONS, MIN_QUESTIONS, QUESTION_BANK } from '../../src/domain/interviewPlanner.js';
import { CATEGORY_IDS, OBJECTIVE_IDS } from '../../src/domain/interview.js';
import { isCatalogSubtype, normalizeCatalogRequest } from '../../src/domain/catalogTaxonomy.js';
import { getExampleCoverage } from '../../src/domain/exampleResolver.js';
import { canUseAi, getUsageBudget, hydrateUsageBudget, recordAiUsageAtomic } from '../../server/lib/usageBudget.js';

const MAX_ANSWER_LENGTH = 4000;
const INTERVIEW_TIMEOUT_MS = Math.max(5000, Math.min(50000, Number(process.env.INTERVIEW_TIMEOUT_MS) || 45000));

function validAnswers(answers) {
  return answers && typeof answers === 'object' && !Array.isArray(answers)
    && Object.keys(answers).length <= MAX_QUESTIONS
    && Object.values(answers).every((value) => typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH);
}

function validState(state) {
  return state && typeof state === 'object' && !Array.isArray(state)
    && CATEGORY_IDS.includes(state.category)
    && (!state.subtype || isCatalogSubtype(state.category, state.subtype))
    && OBJECTIVE_IDS.includes(state.objective)
    && validAnswers(state.answers)
    && Array.isArray(state.askedIds)
    && state.askedIds.length <= MAX_QUESTIONS
    && new Set(state.askedIds).size === state.askedIds.length
    && state.currentQuestion && typeof state.currentQuestion.id === 'string';
}

function coverageFor(state) {
  const dimensions = new Set();
  for (const id of state.askedIds || []) {
    const question = state.questionDefinitions?.[id] || QUESTION_BANK.find((item) => item.id === id);
    question?.dimensions?.forEach((dimension) => dimensions.add(dimension));
  }
  return [...dimensions];
}

function targetFieldFor(question) {
  return String(question?.targetField || question?.id || '').trim();
}

function eligibleTargetFields(state) {
  return QUESTION_BANK
    .filter((question) => {
      if (question.categories && !question.categories.includes(state.category)) return false;
      if (question.objectives && !question.objectives.includes(state.objective)) return false;
      return true;
    })
    .map(targetFieldFor)
    .filter(Boolean);
}

/**
 * Encerrar a entrevista não é gerar pergunta: quando a cobertura já está
 * completa — ou quando o teto de perguntas chegou — não há o que pedir ao
 * modelo, e responder o estado final não é caminho local nenhum.
 */
function readyResponse(state, stopReason, trace = {}) {
  const coverage = InterviewPlanner.coverage(state);
  const ready = {
    ...state,
    currentQuestion: null,
    status: 'ready',
    validation: { ...(state.validation || {}), valid: !coverage.missing.length },
    progress: { asked: state.askedIds.length, max: MAX_QUESTIONS },
  };
  return { state: ready, question: null, trace: { ...trace, fallback: trace.fallback ?? false, degraded: trace.degraded ?? false, stopReason, coverage } };
}

/**
 * Falhas de rede/configuração continuam visíveis. Já uma resposta estruturada
 * inválida não deve quebrar a entrevista: nesse caso o planejador local escolhe
 * o próximo gap obrigatório e o trace deixa claro que houve degradação.
 */
function providerUnavailable(res, reason) {
  const status = reason === 'ai_budget_exceeded' ? 429 : reason === 'ai_not_configured' ? 503 : 502;
  return res.status(status).json({ error: 'ai_unavailable', reason, retryable: reason !== 'ai_not_configured' && reason !== 'ai_budget_exceeded' });
}

function localFallbackResponse(state, reason, trace = {}) {
  const fallback = InterviewPlanner.next(state);
  const coverage = InterviewPlanner.coverage(fallback);
  if (!fallback?.currentQuestion) {
    if (coverage.canStop) return readyResponse(fallback, reason, { ...trace, fallback: true, degraded: true, provider: 'local-fallback', coverage });
    return null;
  }
  return {
    state: fallback,
    question: fallback.currentQuestion,
    trace: {
      ...trace,
      provider: 'local-fallback',
      model: null,
      fallback: true,
      degraded: true,
      stopReason: reason,
      targetField: fallback.currentQuestion.targetField,
      reasonTag: fallback.currentQuestion.reasonTag,
      coverage,
    },
  };
}

/**
 * Campo que a última resposta deveria ter coberto. Quando ela não serve, é
 * exatamente esse campo que precisa ser perguntado de novo.
 */
function lastTargetField(state) {
  const last = (state.history || []).at(-1);
  return String(last?.targetField || last?.questionId || '').trim();
}

function asQuestion(value, state) {
  if (!value || value.shouldStop) return null;
  const question = value.question || value;
  if (!question || typeof question !== 'object') return null;
  const targetField = String(value.targetField || question.targetField || question.id || '').trim();
  if (!targetField || !eligibleTargetFields(state).includes(targetField) || !question.prompt || !question.reasonTag) return null;
  const answerEntry = Object.entries(state.answers || {}).find(([id]) => id === targetField || targetFieldFor(state.questionDefinitions?.[id]) === targetField);
  const answerText = String(answerEntry?.[1] || '').trim();
  const alreadyAnswered = Boolean(answerText) && !/^(?:n[aã]o sei|ainda n[aã]o sei|desconhe[cç]o|\?|-)$/i.test(answerText);
  // Uma resposta fora de propósito deixa o campo formalmente respondido e
  // materialmente vazio. Sem esta exceção, o modelo fazia a coisa certa —
  // voltar a perguntar o que "comer batata" não respondeu — e o servidor
  // recusava a pergunta por já haver texto ali.
  const retryingRejectedAnswer = ['off_topic', 'contradictory'].includes(value.lastAnswerQuality)
    && targetField === lastTargetField(state);
  // A IA pode escolher a melhor formulação e a melhor ordem entre os gaps,
  // mas não pode criar uma etapa opcional enquanto ainda falta informação
  // necessária para distinguir os candidatos. Uma resposta fora de propósito
  // é a exceção: o campo continua sendo o alvo mesmo que o texto inválido o
  // tenha tornado formalmente preenchido.
  const missingRequired = new Set(InterviewPlanner.coverage(state).missing);
  if (missingRequired.size > 0 && !missingRequired.has(targetField) && !retryingRejectedAnswer) return null;
  // Um campo já coberto — perguntado antes ou entregue de passagem numa
  // resposta anterior — nunca volta como próxima pergunta, mesmo reescrito.
  if (!retryingRejectedAnswer && (alreadyAnswered || state.derived?.[targetField])) return null;
  const id = `adaptive_${(state.askedIds || []).length + 1}_${targetField}`;
  if ((state.askedIds || []).includes(id)) return null;
  if (question.prompt.length > 600 || String(question.helper || '').length > 500 || String(question.example || '').length > 500) return null;
  const context = state.answers?.context || state.context || '';
  return {
    id,
    targetField,
    stage: 'adaptive',
    dimensions: Array.isArray(value.dimensionsCovered) ? value.dimensionsCovered : [],
    kind: question.answerKind || 'textarea',
    prompt: question.prompt,
    label: question.prompt,
    helper: question.helper,
    example: question.example,
    reasonTag: question.reasonTag,
    category: state.category,
    subtype: state.subtype || '',
    objective: state.objective,
    context,
    exampleCoverage: getExampleCoverage({ category: state.category, objective: state.objective, context }),
    allowUnknown: true,
    answerHint: 'Você poderá revisar esta resposta antes de calcular o ranking.',
  };
}

function withAdaptiveQuestion(state, question) {
  const askedIds = [...new Set([...(state.askedIds || []), question.id])];
  const questionDefinitions = { ...(state.questionDefinitions || {}), [question.id]: question };
  return {
    ...state,
    askedIds,
    questionDefinitions,
    currentQuestion: question,
    semanticFacts: Array.isArray(state.semanticFacts) ? state.semanticFacts : [],
    remainingGaps: Array.isArray(state.remainingGaps) ? state.remainingGaps : [],
    status: 'active',
    validation: { ...(state.validation || {}), answered: Object.keys(state.answers || {}).length, maxQuestions: MAX_QUESTIONS },
    progress: { asked: askedIds.length, max: MAX_QUESTIONS },
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'authentication_required' });
  try {
    const payload = await readJson(req);
    const invalidRequestedSubtype = Boolean(payload?.state?.subtype && !isCatalogSubtype(payload.state.category, payload.state.subtype));
    const catalogRequest = payload?.state
      ? normalizeCatalogRequest(payload.state.category, payload.state.subtype)
      : null;
    const state = payload?.state
      ? { ...payload.state, category: catalogRequest.category, subtype: catalogRequest.subtype }
      : payload?.state;
    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
    const questionId = String(payload?.questionId || '');
    if (invalidRequestedSubtype || !validState(state) || !questionId || questionId !== state.currentQuestion.id || answer.length > MAX_ANSWER_LENGTH) {
      return res.status(400).json({ error: 'invalid_interview_payload' });
    }
    try {
      if (await consumeInterviewAttempt(req, session)) return res.status(429).json({ error: 'interview_rate_limited' });
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable' });
    }
    await hydrateUsageBudget({ force: true });
    const answeredState = InterviewPlanner.answer(state, answer || 'não informado', questionId);
    const localCoverage = InterviewPlanner.coverage(answeredState);
    // A entrevista já cobriu o necessário: não há próxima pergunta para a IA
    // escrever, então não chamá-la aqui é economia, não indisponibilidade.
    if (localCoverage.canStop && !localCoverage.missing.length) {
      return res.status(200).json(readyResponse(answeredState, 'coverage_complete', { provider: 'none', model: 'coverage-complete' }));
    }
    if (!canUseAi('interview')) return providerUnavailable(res, 'ai_budget_exceeded');

    const controller = new AbortController();
    // O modelo agora lê a situação, declara pressupostos e rascunha candidatas
    // antes de escrever a pergunta, e o roteador é instruído a priorizar
    // qualidade — as duas coisas custam segundos. O teto de 18s foi herdado de
    // um contrato bem mais leve e passou a abortar chamadas que teriam dado
    // certo. Continua abaixo do maxDuration da função, para o erro sair como
    // JSON nosso e não como um 504 da plataforma.
    const timeout = setTimeout(() => controller.abort(), INTERVIEW_TIMEOUT_MS);
    try {
      const ai = await generateNextQuestionWithProvider({
        category: answeredState.category,
        subtype: answeredState.subtype || '',
        objective: answeredState.objective,
        answers: answeredState.answers,
        history: answeredState.history,
        transcript: answeredState.transcript || answeredState.history,
        askedIds: answeredState.askedIds,
        currentQuestion: answeredState.currentQuestion,
        lastAnswer: answer || 'não informado',
        coverage: coverageFor(answeredState),
        remainingGaps: answeredState.validation?.missing || [],
        coveredFields: localCoverage.covered,
        remainingRequiredFields: localCoverage.missing,
        // Só o que o campo já cobre, não o texto inteiro: a resposta original
        // já vai no transcript e repeti-la só encareceria o prompt.
        derivedFields: Object.fromEntries(Object.entries(answeredState.derived || {}).map(([field, detail]) => [field, (detail.evidence || []).slice(0, 3)])),
        semanticFacts: answeredState.semanticFacts || [],
        minQuestions: MIN_QUESTIONS,
        maxQuestions: MAX_QUESTIONS,
      }, { signal: controller.signal });
      const budget = await recordAiUsageAtomic('interview', ai.trace?.usage, ai.trace?.model);
      // O que a IA extraiu da resposta entra no estado antes de qualquer
      // decisão: um campo já satisfeito não deve virar a próxima pergunta,
      // e pode ser o que encerra a entrevista.
      const enrichedState = InterviewPlanner.withProviderCoverage(answeredState, ai.fieldsSatisfied);
      const coverage = InterviewPlanner.coverage(enrichedState);
      const askedCount = enrichedState.askedIds.length;
      if ((ai.shouldStop || !coverage.missing.length) && coverage.canStop) {
        const ready = { ...enrichedState, currentQuestion: null, status: 'ready', validation: { ...enrichedState.validation, valid: true }, progress: { asked: askedCount, max: MAX_QUESTIONS } };
        return res.status(200).json({ state: ready, question: null, trace: { ...ai.trace, fallback: false, degraded: false, stopReason: ai.stopReason || 'coverage_complete', coverage, budget } });
      }
      const question = asQuestion(ai, enrichedState);
      // Teto de perguntas atingido: encerra com o que tem, registrando as
      // lacunas na validação, em vez de escrever a última pergunta localmente.
      if (question && askedCount >= MAX_QUESTIONS - 1) {
        return res.status(200).json(readyResponse(enrichedState, 'question_budget_reached', { ...ai.trace, budget }));
      }
      // A IA respondeu, mas a pergunta não passou na validação (campo já
      // coberto, tamanho, campo inelegível). Se a cobertura permite encerrar,
      // encerra; caso contrário é falha do provedor, não caso de roteiro local.
      if (!question) {
        if (coverage.canStop) return res.status(200).json(readyResponse(enrichedState, 'provider_question_rejected', { ...ai.trace, budget }));
        const fallback = localFallbackResponse(enrichedState, 'provider_question_rejected', { ...ai.trace, budget });
        if (fallback) return res.status(200).json(fallback);
        return providerUnavailable(res, 'provider_question_rejected');
      }
      const next = withAdaptiveQuestion({
        ...enrichedState,
        semanticFacts: [...new Set([...(enrichedState.semanticFacts || []), ...(ai.factsExtracted || [])])].slice(-30),
        remainingGaps: ai.remainingGaps || [],
      }, question);
      // O raciocínio da escolha volta na trace, junto do que já era devolvido a
      // partir das respostas (factsExtracted, fieldsSatisfied): é a mesma sessão
      // e o mesmo usuário autenticado, e é o que torna auditável *por que* esta
      // pergunta veio agora. Nada disso é exibido como texto da pergunta.
      return res.status(200).json({ state: next, question, trace: { ...ai.trace, fallback: false, degraded: false, targetField: question.targetField, dimensions: question.dimensions, reasonTag: question.reasonTag, adaptationExplanation: ai.adaptationExplanation || '', situationRead: ai.situationRead || '', lastAnswerQuality: ai.lastAnswerQuality || 'usable', assumptionsAvoided: ai.assumptionsAvoided || [], chosenBecause: ai.chosenBecause || '', consideredFields: ai.consideredFields || [], remainingGaps: ai.remainingGaps, factsExtracted: ai.factsExtracted, fieldsSatisfied: (ai.fieldsSatisfied || []).map((item) => item.field), coverage, budget } });
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'provider_timeout' : String(error?.message || 'provider_error').slice(0, 80);
      return providerUnavailable(res, reason);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (String(error?.message || '').startsWith('store_') || error?.message === 'atomic_lock_timeout') return res.status(503).json({ error: 'rate_limit_unavailable' });
    return res.status(400).json({ error: 'invalid_interview_request' });
  }
}
