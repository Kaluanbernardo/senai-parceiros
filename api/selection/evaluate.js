import { getSession } from '../../server/lib/cookies.js';
import { readJson, methodNotAllowed, requireSameOrigin } from '../../server/lib/http.js';
import { buildLocalEvaluation, mergeEvaluation } from '../../server/lib/selection.js';
import { evaluateWithProvider } from '../../server/lib/ai.js';
import { getCatalog } from '../../server/lib/catalog.js';
import { rankProviderCandidates } from '../../src/domain/selectionEngine.js';
import { isSelectionRateLimited, recordSelectionAttempt } from '../../server/lib/auth.js';
import { OBJECTIVE_LABELS } from '../../src/domain/interview.js';
import { createSelectionBrief, validateSelectionBrief } from '../../src/domain/contracts.js';
import { hydrateCatalogStore } from '../../server/lib/catalogImport.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!requireSameOrigin(req, res)) return;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'authentication_required' });
  if (isSelectionRateLimited(req, session)) return res.status(429).json({ error: 'selection_rate_limited' });
  try {
    const payload = await readJson(req);
    const validAnswers = payload?.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)
      && Object.keys(payload.answers).length <= 20
      && Object.values(payload.answers).every((value) => typeof value === 'string' && value.length <= 4000);
    if (!payload || !payload.category || !payload.objective || !['researcher', 'school', 'organization'].includes(payload.category) || !Object.prototype.hasOwnProperty.call(OBJECTIVE_LABELS, payload.objective) || !validAnswers) {
      return res.status(400).json({ error: 'invalid_selection_payload' });
    }
    recordSelectionAttempt(req, session);
    await hydrateCatalogStore({ force: true });
    const brief = createSelectionBrief({ ...(payload.brief || {}), category: payload.category, objective: payload.objective, answers: payload.answers });
    if (!validateSelectionBrief(brief).valid) return res.status(400).json({ error: 'invalid_selection_brief' });
    const candidates = getCatalog(payload.category);
    const evaluationInput = { ...payload, brief, candidates };
    const local = await buildLocalEvaluation(evaluationInput);
    let ai = null;
    let fallback = false;
    try {
      const providerPool = rankProviderCandidates(local.candidatePool, 30);
      ai = await evaluateWithProvider({ input: evaluationInput, candidates: providerPool.map((entry) => entry.candidate) });
      ai.providerPreselection = { limit: 30, selected: providerPool.map((entry) => entry.candidate.id), totalCatalog: local.candidatePool.length };
      ai.evaluations = ai.evaluations.map((evaluation) => ({
        ...evaluation,
        id: candidates.find((candidate) => String(candidate.id) === String(evaluation.id))?.id ?? evaluation.id,
        evidence: Array.isArray(evaluation.evidence)
          ? evaluation.evidence.filter((item) => typeof item === 'string' && candidates.some((candidate) => Object.prototype.hasOwnProperty.call(candidate, item) || JSON.stringify(candidate).includes(item)))
          : [],
      }));
    } catch (error) {
      fallback = true;
      ai = { model: 'local-fallback', provider: 'local-fallback', evaluations: [] };
    }
    const result = ai.evaluations.length ? await mergeEvaluation(local, ai) : local;
    return res.status(200).json({
      ...result,
      trace: {
        ...(result.trace || {}),
        provider: ai.provider,
        model: ai.model,
        fallback,
        costQualityTradeoff: ai.costQualityTradeoff ?? null,
        routing: ai.routing || null,
        usage: ai.usage || null,
        providerPreselection: ai.providerPreselection || result.trace?.providerPreselection || null,
      },
    });
  } catch (error) {
    const status = error.message === 'local_engine_unavailable' ? 503 : 400;
    return res.status(status).json({ error: status === 503 ? 'selection_engine_unavailable' : 'invalid_selection_request' });
  }
}
