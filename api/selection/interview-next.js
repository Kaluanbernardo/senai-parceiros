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
    const question = QUESTION_BANK.find((item) => item.id === id);
    question?.dimensions?.forEach((dimension) => dimensions.add(dimension));
  }
  return [...dimensions];
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
  const question = value.question;
  if (!question || typeof question !== 'object') return null;
  if (!question.id || !question.prompt || !question.reasonTag) return null;
  if ((state.askedIds || []).includes(question.id)) return null;
  if (question.prompt.length > 600 || question.helper.length > 500 || question.example.length > 500) return null;
  const context = state.answers?.context || state.context || '';
  return {
    id: question.id,
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
        askedIds: answeredState.askedIds,
        currentQuestion: answeredState.currentQuestion,
        lastAnswer: answer || 'não informado',
        coverage: coverageFor(answeredState),
        remainingGaps: answeredState.validation?.missing || [],
      }, { signal: controller.signal });
      const budget = await recordAiUsageAtomic('interview', ai.trace?.usage);
      const askedCount = answeredState.askedIds.length;
      if (ai.shouldStop && askedCount >= MIN_QUESTIONS && !(answeredState.validation?.missing || []).length) {
        const ready = { ...answeredState, currentQuestion: null, status: 'ready', validation: { ...answeredState.validation, valid: true }, progress: { asked: askedCount, max: MAX_QUESTIONS } };
        return res.status(200).json({ state: ready, question: null, trace: { ...ai.trace, fallback: false, stopReason: ai.stopReason, budget } });
      }
      const question = asQuestion(ai, answeredState);
      if (!question || askedCount >= MAX_QUESTIONS - 1) return res.status(200).json(local);
      return res.status(200).json({ state: withAdaptiveQuestion(answeredState, question), question, trace: { ...ai.trace, fallback: false, remainingGaps: ai.remainingGaps, factsExtracted: ai.factsExtracted, budget } });
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
