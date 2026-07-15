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
  const contextText = Object.values(input.answers || {}).join(' ') + ' ' + SENAI_STRATEGIC_BASELINE.join(' ');
  const contextTokens = [...new Set(tokens(contextText))];
  const candidateTokens = new Set(tokens(candidateText(candidate)));
  const overlap = contextTokens.filter((token) => candidateTokens.has(token));
  const relevance = contextTokens.length ? (overlap.length / Math.min(contextTokens.length, 12)) * 100 : 45;
  const citations = numericCitations(candidate.citacoes);
  const completeness = sourceFields(candidate).length / 11;
  const credibility = Math.min(100, 35 + Math.min(45, Math.log10(citations + 1) * 16) + completeness * 20);
  const hasWebsite = Boolean(candidate.website || candidate.scholar);
  const collaboration = 44 + (hasWebsite ? 18 : 0) + (candidate.relacao && !fold(candidate.relacao).includes('sem registro') ? 20 : 0);
  const geography = fold(input.answers?.geography);
  const sameCountry = geography && candidate.pais && geography.includes(fold(candidate.pais));
  const feasibility = 48 + (sameCountry ? 18 : 0) + (fold(input.answers?.constraints).includes('remot') ? 12 : 0);
  const risk = 72;
  const impact = clamp(42 + relevance * 0.55 + (candidate.relevancia ? 12 : 0));
  const alignment = clamp(30 + relevance * 0.7);

  const dimensions = {
    impact: clamp(impact),
    alignment,
    credibility: clamp(credibility),
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
    summary: overlap.length ? 'Aderência encontrada nos termos: ' + overlap.slice(0, 6).join(', ') + '.' : 'Aderência contextual ainda precisa de validação humana.',
    evidence: sourceFields(candidate).slice(0, 6),
    gaps: sourceFields(candidate).length < 5 ? ['Perfil público com campos incompletos.'] : [],
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => b.total - a.total || b.strategicValue - a.strategicValue);
}

export function buildLocalEvaluation({ category, objective, answers, candidates }) {
  const input = { category, objective, answers };
  const all = sortEntries(candidates.map((candidate) => scoreCandidate({ candidate, input })));
  const candidatePool = all;
  const shortlist = candidatePool.filter((entry) => entry.total >= 28).slice(0, 5);

  return {
    shortlist,
    candidatePool,
    trace: {
      evaluatorVersion: 'local-v1',
      category,
      objective,
      answers,
      weights: FORMULA_WEIGHTS,
      formula: 'valor estratégico × 0,58 + viabilidade × 0,42; risco grave confirmado zera o valor estratégico',
      sourcePolicy: 'Somente campos do catálogo cadastrado; ausência de evidência reduz confiança.',
      institutionalBaseline: SENAI_STRATEGIC_BASELINE,
      catalogSize: candidates.length,
      generatedAt: new Date().toISOString(),
      provider: 'local-fallback',
      model: null,
    },
  };
}

function normalizeAiDimensions(dimensions, fallback) {
  return Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((key) => [key, clamp(dimensions?.[key] ?? fallback[key])]));
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
  const shortlist = sortEntries(entries).filter((entry) => entry.total >= 28).slice(0, 5);
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
    },
  };
}

export function getCandidatePool({ category, data }) {
  if (category === 'researcher') return data.pesquisadores || [];
  if (category === 'school') return data.escolas || [];
  return data.stakeholders || [];
}
