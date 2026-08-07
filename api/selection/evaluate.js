import { getSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { buildLocalEvaluation, mergeEvaluation } from '../../server/lib/selection.js';
import { evaluateWithProvider } from '../../server/lib/ai.js';
import { getCatalog } from '../../server/lib/catalog.js';
import { rankProviderCandidates } from '../../src/domain/selectionEngine.js';
import { consumeSelectionAttempt, hydrateRateLimitStore } from '../../server/lib/auth.js';
import { OBJECTIVE_LABELS } from '../../src/domain/interview.js';
import { createSelectionBrief, validateSelectionBrief } from '../../src/domain/contracts.js';
import { hydrateCatalogStore } from '../../server/lib/catalogImport.js';
import { canUseAi, getUsageBudget, hydrateUsageBudget, recordAiUsageAtomic } from '../../server/lib/usageBudget.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'authentication_required' });
  await hydrateRateLimitStore({ force: true });
  try {
    const payload = await readJson(req);
    if (payload?.category === 'researcher') payload.category = 'person';
    // O briefing traz um campo por informação coberta, não por pergunta feita:
    // uma resposta rica cobre vários campos de uma vez, então o teto acompanha
    // o número de campos canônicos, e não o número de perguntas.
    const validAnswers = payload?.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)
      && Object.keys(payload.answers).length <= 32
      && Object.values(payload.answers).every((value) => typeof value === 'string' && value.length <= 4000);
    if (!payload || !payload.category || !payload.objective || !['person', 'school', 'organization'].includes(payload.category) || !Object.prototype.hasOwnProperty.call(OBJECTIVE_LABELS, payload.objective) || !validAnswers) {
      return res.status(400).json({ error: 'invalid_selection_payload' });
    }
    try {
      if (await consumeSelectionAttempt(req, session)) return res.status(429).json({ error: 'selection_rate_limited' });
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable' });
    }
    await hydrateCatalogStore({ force: true });
    await hydrateUsageBudget({ force: true });
    const brief = createSelectionBrief({ ...(payload.brief || {}), category: payload.category, objective: payload.objective, answers: payload.answers });
    if (!validateSelectionBrief(brief).valid) return res.status(400).json({ error: 'invalid_selection_brief' });
    const candidates = getCatalog(payload.category);
    const evaluationInput = { ...payload, brief, candidates };
    const local = await buildLocalEvaluation(evaluationInput);
    // O motor determinístico continua sendo a base da chamada: ele monta o pool
    // e os pesos que a IA recebe e sobre os quais o merge acontece. O que deixou
    // de existir é entregar esse cálculo sozinho como se fosse a recomendação.
    if (!canUseAi('selection')) {
      return res.status(429).json({ error: 'ai_unavailable', reason: 'ai_budget_exceeded', retryable: false, budget: getUsageBudget('selection') });
    }
    let ai = null;
    try {
      const providerPool = rankProviderCandidates(local.candidatePool, 30);
      // O provider recebe a mesma rubrica e os mesmos pesos derivados que o
      // cálculo local usa, para que as duas notas sejam comparáveis.
      ai = await evaluateWithProvider({ input: { ...evaluationInput, criteria: local.trace?.criteria || null }, candidates: providerPool.map((entry) => entry.candidate) });
      ai.providerPreselection = { limit: 30, selected: providerPool.map((entry) => entry.candidate.id), totalCatalog: local.candidatePool.length };
      ai.budget = await recordAiUsageAtomic('selection', ai.usage);
      ai.evaluations = ai.evaluations.map((evaluation) => ({
        ...evaluation,
        id: candidates.find((candidate) => String(candidate.id) === String(evaluation.id))?.id ?? evaluation.id,
        evidence: Array.isArray(evaluation.evidence)
          ? evaluation.evidence.filter((item) => typeof item === 'string' && candidates.some((candidate) => Object.prototype.hasOwnProperty.call(candidate, item) || JSON.stringify(candidate).includes(item)))
          : [],
      }));
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'provider_timeout' : String(error?.message || 'provider_error').slice(0, 80);
      const status = reason === 'ai_not_configured' ? 503 : 502;
      return res.status(status).json({ error: 'ai_unavailable', reason, retryable: reason !== 'ai_not_configured' });
    }
    // Provider que responde sem nenhuma avaliação entregaria o cálculo local
    // com a etiqueta da IA — é falha, não resultado.
    if (!ai.evaluations.length) {
      return res.status(502).json({ error: 'ai_unavailable', reason: 'provider_empty_evaluation', retryable: true });
    }
    const result = await mergeEvaluation(local, ai);
    return res.status(200).json({
      ...result,
      trace: {
        ...(result.trace || {}),
        provider: ai.provider,
        model: ai.model,
        fallback: false,
        costQualityTradeoff: ai.costQualityTradeoff ?? null,
        routing: ai.routing || null,
        usage: ai.usage || null,
        providerPreselection: ai.providerPreselection || result.trace?.providerPreselection || null,
        budget: ai.budget || getUsageBudget('selection'),
      },
    });
  } catch (error) {
    const unavailable = error.message === 'local_engine_unavailable' || String(error?.message || '').startsWith('store_') || error?.message === 'atomic_lock_timeout';
    const status = unavailable ? 503 : 400;
    return res.status(status).json({ error: error.message === 'local_engine_unavailable' ? 'selection_engine_unavailable' : unavailable ? 'rate_limit_unavailable' : 'invalid_selection_request' });
  }
}
