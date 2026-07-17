import { mergeSchoolSources } from './schoolCatalog';

const STOPWORDS = new Set([
  'para', 'como', 'uma', 'com', 'que', 'dos', 'das', 'por', 'sobre', 'entre', 'mais',
  'esse', 'essa', 'este', 'esta', 'isso', 'ainda', 'não', 'nao', 'sem',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'their', 'about',
]);

export const DEFAULT_WEIGHTS = {
  impact: 0.18,
  alignment: 0.24,
  credibility: 0.16,
  collaboration: 0.14,
  feasibility: 0.14,
  risk: 0.14,
};

export const FORMULA_WEIGHTS = {
  strategic: { impact: 0.42, alignment: 0.43, credibility: 0.15 },
  viability: { collaboration: 0.38, feasibility: 0.38, risk: 0.24 },
  total: { strategic: 0.58, viability: 0.42 },
};

export const SENAI_STRATEGIC_BASELINE = [
  'competitividade e desenvolvimento sustentável da indústria paulista',
  'educação profissional conectada ao trabalho e a oportunidades reais',
  'inovação, tecnologia e empreendedorismo industrial',
  'desenvolvimento regional, acesso e inclusão',
  'transformação digital, Indústria 4.0 e parcerias estratégicas',
  'sustentabilidade, ESG, descarbonização e economia circular',
];

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(text) {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));
}

function numericCitations(value) {
  const match = String(value || '').replace(/\./g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function candidateText(candidate) {
  return [
    candidate.nome,
    candidate.instituicao,
    candidate.pais,
    candidate.areas,
    candidate.pesquisa,
    candidate.descricao,
    candidate.diferencial,
    candidate.relevancia,
    candidate.relacao,
    candidate.miniBio,
    ...(candidate.artigos || []).map((article) => article.titulo),
  ].filter(Boolean).join(' ');
}

function sourceFields(candidate) {
  return Object.entries(candidate)
    .filter(([key, value]) => value && ['nome', 'instituicao', 'pais', 'areas', 'pesquisa', 'descricao', 'diferencial', 'relevancia', 'relacao', 'website', 'scholar'].includes(key))
    .map(([key]) => key);
}

function scoreCandidate({ candidate, input }) {
  const briefText = [input.brief?.context, ...(input.brief?.themes || []), ...(input.brief?.desiredOutcomes || []), ...(input.brief?.contributionTypes || []), input.brief?.audience, input.brief?.collaborationModel].filter(Boolean).join(' ');
  const contextText = Object.values(input.answers || {}).join(' ') + ' ' + briefText + ' ' + SENAI_STRATEGIC_BASELINE.join(' ');
  const contextTokens = [...new Set(tokens(contextText))];
  const candidateTokens = new Set(tokens(candidateText(candidate)));
  const overlap = contextTokens.filter((token) => candidateTokens.has(token));
  const relevance = contextTokens.length ? (overlap.length / Math.min(contextTokens.length, 12)) * 100 : 45;
  const citations = numericCitations(candidate.citacoes);
  const completeness = sourceFields(candidate).length / 11;
  const credibility = Math.min(100, 35 + Math.min(45, Math.log10(citations + 1) * 16) + completeness * 20);
  const hasWebsite = Boolean(candidate.website || candidate.scholar);
  const confirmedPartnership = Boolean(candidate.hasPartnership) || /^(?:✅|🔗)|^parceiro de projetos|^parceiro irmão/i.test(String(candidate.relacao || '').trim());
  const objectiveBoost = {
    speaker: { impact: 8, collaboration: 7, credibility: 3 },
    project_partner: { collaboration: 12, feasibility: 7, impact: 4 },
    benchmark: { alignment: 9, credibility: 8, feasibility: 3 },
    research_support: { credibility: 10, impact: 7, alignment: 3 },
    guided: { alignment: 4, impact: 4 },
  }[input.objective] || {};
  const collaboration = 44 + (hasWebsite ? 18 : 0) + (confirmedPartnership ? 20 : 0) + (input.brief?.collaborationModel ? 6 : 0) + (objectiveBoost.collaboration || 0);
  const geography = fold(input.brief?.feasibility?.geography || input.answers?.geography);
  const sameCountry = geography && candidate.pais && geography.includes(fold(candidate.pais));
  const feasibility = 48 + (sameCountry ? 18 : 0) + (fold(input.brief?.hardConstraints?.join(' ') || input.answers?.constraints).includes('remot') ? 12 : 0) + (objectiveBoost.feasibility || 0);
  const riskSignals = [candidate.risco, candidate.risk, candidate.relacao].filter(Boolean).join(' ');
  const risk = clamp(78 - (fold(riskSignals).includes('sem evid') || fold(riskSignals).includes('conflito') ? 22 : 0) - (sourceFields(candidate).length < 5 ? 8 : 0));
  const impact = clamp(42 + relevance * 0.55 + (candidate.relevancia ? 12 : 0) + (objectiveBoost.impact || 0));
  const alignment = clamp(30 + relevance * 0.7 + (objectiveBoost.alignment || 0));
  const calibratedCredibility = clamp(credibility + (objectiveBoost.credibility || 0));

  const dimensions = {
    impact: clamp(impact),
    alignment,
    credibility: calibratedCredibility,
    collaboration: clamp(collaboration),
    feasibility: clamp(feasibility),
    risk: clamp(risk),
  };
  const strategicValue = clamp(dimensions.impact * FORMULA_WEIGHTS.strategic.impact + dimensions.alignment * FORMULA_WEIGHTS.strategic.alignment + dimensions.credibility * FORMULA_WEIGHTS.strategic.credibility);
  const viability = clamp(dimensions.collaboration * FORMULA_WEIGHTS.viability.collaboration + dimensions.feasibility * FORMULA_WEIGHTS.viability.feasibility + dimensions.risk * FORMULA_WEIGHTS.viability.risk);
  const total = clamp(strategicValue * FORMULA_WEIGHTS.total.strategic + viability * FORMULA_WEIGHTS.total.viability);

  return {
    candidate,
    dimensions,
    strategicValue,
    viability,
    total,
    confidence: clamp(35 + completeness * 50 + Math.min(overlap.length * 3, 15)),
    summary: overlap.length ? 'Aderência encontrada nos termos: ' + overlap.slice(0, 6).join(', ') + (candidate.pais ? `. Diferencial de contexto: atuação em ${candidate.pais}.` : '.') : 'Aderência contextual ainda precisa de validação humana.',
    comparativeEdge: overlap.length ? `Diferencia-se por combinar ${overlap.slice(0, 4).join(', ')}${candidate.pais ? ` e atuação em ${candidate.pais}` : ''}.` : 'Diferencial ainda não demonstrado nas fontes públicas disponíveis.',
    tradeoffs: [
      candidate.pais && geography && !sameCountry ? `Exige avaliar a viabilidade de interação fora de ${geography}.` : null,
      sourceFields(candidate).length < 7 ? 'Há lacunas de informação pública que reduzem a confiança.' : null,
    ].filter(Boolean),
    dimensionRationale: {
      impact: `Sobreposição contextual de ${overlap.length} termo(s) observável(is) no perfil.`,
      alignment: `Aderência ao briefing e ao baseline institucional calculada por termos e temas públicos.`,
      credibility: `${sourceFields(candidate).length} campos públicos relevantes e ${citations || 0} citações localizadas.`,
      collaboration: `${hasWebsite ? 'Fonte institucional disponível' : 'sem site institucional localizado'}${confirmedPartnership ? '; parceria explícita identificada' : '; parceria não confirmada'}.`,
      feasibility: sameCountry ? 'Geografia informada coincide com o país do perfil.' : 'Geografia exige validação de modalidade, idioma e prazo.',
      risk: riskSignals ? 'Sinais de risco foram avaliados nos campos públicos do catálogo.' : 'Nenhum sinal grave foi confirmado nos campos disponíveis.',
    },
    evidence: sourceFields(candidate).slice(0, 6),
    gaps: sourceFields(candidate).length < 5 ? ['Perfil público com campos incompletos.'] : [],
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => b.total - a.total || b.strategicValue - a.strategicValue);
}

export function rankProviderCandidates(entries, limit = 30) {
  const sorted = sortEntries(entries);
  const selected = [];
  const groups = new Set();
  for (const entry of sorted) {
    if (selected.length >= limit) break;
    const group = String(entry.candidate?.instituicao || entry.candidate?.organizacao || entry.candidate?.pais || entry.candidate?.catalogIdentity || entry.candidate?.nome || '').trim().toLowerCase();
    if (group && groups.has(group)) continue;
    selected.push(entry);
    if (group) groups.add(group);
  }
  for (const entry of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  return selected;
}

/**
 * Produces a practical shortlist: up to ten candidates, with at least five
 * whenever the catalog has five or more eligible records. The first pass
 * favors distinct institutions so the result does not collapse into one
 * organization; the second pass fills remaining slots by score.
 */
export function selectShortlist(entries, { minimum = 5, maximum = 10, threshold = 28 } = {}) {
  const sorted = sortEntries(entries);
  const safeMinimum = Math.max(0, Math.min(minimum, maximum));
  const eligible = sorted.filter((entry) => entry.total >= threshold && !entry.severeRisk?.confirmed);
  const fallback = sorted.filter((entry) => !entry.severeRisk?.confirmed);
  const pool = eligible.length >= safeMinimum ? eligible : fallback;
  const target = Math.min(maximum, Math.max(safeMinimum, pool.length));
  const selected = [];
  const institutions = new Set();

  for (const entry of pool) {
    const institution = String(entry.candidate?.instituicao || entry.candidate?.organizacao || entry.candidate?.catalogIdentity || entry.candidate?.nome || '').trim().toLowerCase();
    if (selected.length >= target) break;
    if (institution && institutions.has(institution)) continue;
    selected.push(entry);
    if (institution) institutions.add(institution);
  }
  for (const entry of pool) {
    if (selected.length >= target) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  return selected;
}

export function buildLocalEvaluation({ category, objective, answers, candidates, brief }) {
  const input = { category, objective, answers, brief };
  const all = sortEntries(candidates.map((candidate) => scoreCandidate({ candidate, input })));
  const candidatePool = all;
  const shortlist = selectShortlist(candidatePool);

  return {
    shortlist,
    candidatePool,
    trace: {
      evaluatorVersion: 'local-v1',
      category,
      objective,
      answers,
      brief: brief || null,
      weights: FORMULA_WEIGHTS,
      formula: 'valor estratégico × 0,58 + viabilidade × 0,42; risco grave confirmado zera o valor estratégico',
      sourcePolicy: 'Somente campos do catálogo cadastrado; ausência de evidência reduz confiança.',
      institutionalBaseline: SENAI_STRATEGIC_BASELINE,
      catalogSize: candidates.length,
      shortlistPolicy: { minimum: 5, maximum: 10, threshold: 28, institutionDiversity: true },
      objectiveCalibration: 'objective-specific boosts are bounded and layered over public evidence; provider scores are blended with local evidence',
      providerPreselection: { limit: 30, selected: rankProviderCandidates(candidatePool, 30).map((entry) => entry.candidate.id) },
      shortlistExcluded: candidatePool.filter((entry) => !shortlist.includes(entry)).map((entry) => ({
        id: entry.candidate.id,
        reason: entry.severeRisk?.confirmed ? 'severe-risk' : entry.total < 28 ? 'below-threshold' : 'capacity',
      })),
      generatedAt: new Date().toISOString(),
      provider: 'local-fallback',
      model: null,
    },
  };
}

function normalizeAiDimensions(dimensions, fallback) {
  return Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((key) => {
    const providerValue = Number(dimensions?.[key]);
    const localValue = Number(fallback[key]) || 0;
    // A small local-evidence blend prevents a provider from flattening all
    // candidates to identical scores while preserving its contextual judgment.
    const value = Number.isFinite(providerValue) ? providerValue * 0.78 + localValue * 0.22 : localValue;
    return [key, clamp(value)];
  }));
}

function recompute(entry, ai) {
  const dimensions = normalizeAiDimensions(ai?.dimensions, entry.dimensions);
  const strategicValue = ai?.severeRisk?.confirmed
    ? 0
    : clamp(dimensions.impact * FORMULA_WEIGHTS.strategic.impact + dimensions.alignment * FORMULA_WEIGHTS.strategic.alignment + dimensions.credibility * FORMULA_WEIGHTS.strategic.credibility);
  const viability = clamp(dimensions.collaboration * FORMULA_WEIGHTS.viability.collaboration + dimensions.feasibility * FORMULA_WEIGHTS.viability.feasibility + dimensions.risk * FORMULA_WEIGHTS.viability.risk);
  return {
    ...entry,
    ...ai,
    dimensions,
    strategicValue,
    viability,
    total: clamp(strategicValue * FORMULA_WEIGHTS.total.strategic + viability * FORMULA_WEIGHTS.total.viability),
    severeRisk: ai?.severeRisk || null,
  };
}

export function mergeAiEvaluation(local, aiResult = {}) {
  const aiById = new Map((aiResult.evaluations || []).map((evaluation) => [String(evaluation.id), evaluation]));
  const entries = (local.candidatePool || local.shortlist).map((entry) => recompute(entry, aiById.get(String(entry.candidate.id))));
  const sortedEntries = sortEntries(entries);
  const shortlist = selectShortlist(sortedEntries);
  return {
    ...local,
    shortlist,
    candidatePool: entries,
    trace: {
      ...local.trace,
      provider: aiResult.provider || 'local-fallback',
      model: aiResult.model || null,
      usage: aiResult.usage || null,
      evaluatorVersion: aiResult.provider ? 'openrouter-structured-v1' : local.trace.evaluatorVersion,
      generatedAt: new Date().toISOString(),
      shortlistPolicy: { minimum: 5, maximum: 10, threshold: 28, institutionDiversity: true },
      shortlistExcluded: sortedEntries.filter((entry) => !shortlist.includes(entry)).map((entry) => ({
        id: entry.candidate.id,
        reason: entry.severeRisk?.confirmed ? 'severe-risk' : entry.total < 28 ? 'below-threshold' : 'capacity',
      })),
    },
  };
}

export function getCandidatePool({ category, data }) {
  if (category === 'researcher') return data.pesquisadores || [];
  if (category === 'school') return mergeSchoolSources({ schools: data.escolas || [], stakeholders: data.stakeholders || [] });
  return data.stakeholders || [];
}
