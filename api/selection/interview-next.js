import { getSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { consumeInterviewAttempt, hydrateRateLimitStore } from '../../server/lib/auth.js';
import { generateNextQuestionWithProvider } from '../../server/lib/ai.js';
import { InterviewPlanner, MAX_QUESTIONS, MIN_QUESTIONS, QUESTION_BANK } from '../../src/domain/interviewPlanner.js';
import { CATEGORY_IDS, OBJECTIVE_IDS } from '../../src/domain/interview.js';
import { getExampleCoverage } from '../../src/domain/exampleResolver.js';
import { canUseAi, getUsageBudget, hydrateUsageBudget, recordAiUsageAtomic } from '../../server/lib/usageBudget.js';

const MAX_ANSWER_LENGTH = 4000;

function validAnswers(answers) {
  return answers && typeof answers === 'object' && !Array.isArray(answers)
    && Object.keys(answers).length <= MAX_QUESTIONS
    && Object.values(answers).every((value) => typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH);
}

function validState(state) {
  return state && typeof state === 'object' && !Array.isArray(state)
    && CATEGORY_IDS.includes(state.category)
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

function localFallback(answeredState, reason = 'provider_unavailable') {
  const nextState = InterviewPlanner.next(answeredState);
  return {
    state: nextState,
    question: nextState.currentQuestion,
    trace: { provider: 'local-fallback', model: 'semantic-planner-v2', fallback: true, fallbackReason: reason },
  };
}

function asQuestion(value, state) {
  if (!value || value.shouldStop) return null;
  const question = value.question || value;
  if (!question || typeof question !== 'object') return null;
  const targetField = String(value.targetField || question.targetField || question.id || '').trim();
  if (!targetField || !eligibleTargetFields(state).includes(targetField) || !question.prompt || !question.reasonTag) return null;
  const existingDefinition = Object.values(state.questionDefinitions || {}).find((item) => targetFieldFor(item) === targetField);
  const answerEntry = Object.entries(state.answers || {}).find(([id]) => id === targetField || targetFieldFor(state.questionDefinitions?.[id]) === targetField);
  const answerText = String(answerEntry?.[1] || '').trim();
  const alreadyAnswered = Boolean(answerText) && !/^(?:n[aã]o sei|ainda n[aã]o sei|desconhe[cç]o|\?|-)$/i.test(answerText);
  // Legacy direct-field check retained below for old serialized states.
  /* // const alreadyAnswered = Object.prototype.hasOwnProperty.call(state.answers || {}, targetField)
    // && String(state.answers?.[targetField] || '').trim()
    && !/^(?:n[aã]o sei|ainda n[aã]o sei|desconhe[cç]o|\?|-)$/i.test(String(state.answers[targetField]).trim());
  */
  if (existingDefinition && alreadyAnswered) return null;
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
  await hydrateRateLimitStore({ force: true });

  try {
    const payload = await readJson(req);
    const state = payload?.state;
    const answer = typeof payload?.answer === 'string' ? payload.answer.trim() : '';
    const questionId = String(payload?.questionId || '');
    if (!validState(state) || !questionId || questionId !== state.currentQuestion.id || answer.length > MAX_ANSWER_LENGTH) {
      return res.status(400).json({ error: 'invalid_interview_payload' });
    }
    try {
      if (await consumeInterviewAttempt(req, session)) return res.status(429).json({ error: 'interview_rate_limited' });
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable' });
    }
    await hydrateUsageBudget({ force: true });
    const answeredState = InterviewPlanner.answer(state, answer || 'não informado', questionId);
    const local = localFallback(answeredState, 'provider_unavailable');
    if (local.state.status === 'ready') return res.status(200).json(local);
    if (!canUseAi('interview')) return res.status(200).json(localFallback(answeredState, 'ai_budget_exceeded'));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const ai = await generateNextQuestionWithProvider({
        category: answeredState.category,
        objective: answeredState.objective,
        answers: answeredState.answers,
        history: answeredState.history,
        transcript: answeredState.transcript || answeredState.history,
        askedIds: answeredState.askedIds,
        currentQuestion: answeredState.currentQuestion,
        lastAnswer: answer || 'não informado',
        coverage: coverageFor(answeredState),
        remainingGaps: answeredState.validation?.missing || [],
        coveredFields: answeredState.coveredFields || [],
        remainingRequiredFields: answeredState.validation?.missing || [],
        semanticFacts: answeredState.semanticFacts || [],
      }, { signal: controller.signal });
      const budget = await recordAiUsageAtomic('interview', ai.trace?.usage);
      const askedCount = answeredState.askedIds.length;
      if (ai.shouldStop && askedCount >= MIN_QUESTIONS && !(answeredState.validation?.missing || []).length) {
        const ready = { ...answeredState, currentQuestion: null, status: 'ready', validation: { ...answeredState.validation, valid: true }, progress: { asked: askedCount, max: MAX_QUESTIONS } };
        return res.status(200).json({ state: ready, question: null, trace: { ...ai.trace, fallback: false, stopReason: ai.stopReason, budget } });
      }
      const question = asQuestion(ai, answeredState);
      if (!question || askedCount >= MAX_QUESTIONS - 1) return res.status(200).json(local);
      const next = withAdaptiveQuestion({
        ...answeredState,
        semanticFacts: [...new Set([...(answeredState.semanticFacts || []), ...(ai.factsExtracted || [])])].slice(-30),
        remainingGaps: ai.remainingGaps || [],
      }, question);
      return res.status(200).json({ state: next, question, trace: { ...ai.trace, fallback: false, targetField: question.targetField, dimensions: question.dimensions, reasonTag: question.reasonTag, adaptationExplanation: ai.adaptationExplanation || '', remainingGaps: ai.remainingGaps, factsExtracted: ai.factsExtracted, budget } });
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'provider_timeout' : String(error?.message || 'provider_error').slice(0, 80);
      return res.status(200).json(localFallback(answeredState, reason));
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (String(error?.message || '').startsWith('store_') || error?.message === 'atomic_lock_timeout') return res.status(503).json({ error: 'rate_limit_unavailable' });
    return res.status(400).json({ error: 'invalid_interview_request' });
  }
}
