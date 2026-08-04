/**
 * Critérios de qualificação da seleção.
 *
 * Antes, cada dimensão era uma soma de constantes escolhidas à mão (44 + 18 +
 * 20…) e os pesos eram fixos para qualquer contexto. Aqui os critérios passam a
 * ser explícitos em três camadas:
 *
 *  1. um perfil de pesos por objetivo (contexto pré-configurado);
 *  2. ajustes derivados do que a pessoa efetivamente respondeu, cada um com
 *     faixa máxima e justificativa registrada;
 *  3. subcritérios nomeados por dimensão, cada um com peso próprio, para que
 *     uma nota possa ser reconstruída campo a campo.
 *
 * Nada aqui inventa informação: todo ajuste aponta para o texto que o
 * disparou, e todo subcritério aponta para os campos públicos que o sustentam.
 */

import { extractSignals } from './answerSignals.js';

export const SELECTION_CRITERIA_VERSION = 'criteria-v2';

export const DIMENSIONS = Object.freeze(['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk']);

export const DIMENSION_GROUPS = Object.freeze({
  strategic: Object.freeze(['impact', 'alignment', 'credibility']),
  viability: Object.freeze(['collaboration', 'feasibility', 'risk']),
});

/** O valor estratégico continua dominante, mas nunca vira a nota inteira. */
export const GROUP_BOUNDS = Object.freeze({ strategicMin: 0.5, strategicMax: 0.7 });

/**
 * Perfis base por objetivo. Um benchmarking pesa alinhamento e credibilidade;
 * uma parceria pesa colaboração e viabilidade; um convite pesa impacto e
 * formato. Este é o "contexto pré-configurado" pedido antes de qualquer
 * resposta do usuário.
 */
export const OBJECTIVE_WEIGHT_PROFILES = Object.freeze({
  speaker: Object.freeze({ impact: 0.21, alignment: 0.22, credibility: 0.16, collaboration: 0.15, feasibility: 0.16, risk: 0.10 }),
  project_partner: Object.freeze({ impact: 0.18, alignment: 0.20, credibility: 0.14, collaboration: 0.22, feasibility: 0.16, risk: 0.10 }),
  benchmark: Object.freeze({ impact: 0.15, alignment: 0.27, credibility: 0.22, collaboration: 0.10, feasibility: 0.14, risk: 0.12 }),
  research_support: Object.freeze({ impact: 0.16, alignment: 0.22, credibility: 0.26, collaboration: 0.12, feasibility: 0.12, risk: 0.12 }),
  guided: Object.freeze({ impact: 0.18, alignment: 0.24, credibility: 0.16, collaboration: 0.14, feasibility: 0.14, risk: 0.14 }),
});

/** Nenhum ajuste pode zerar ou dominar uma dimensão. */
export const WEIGHT_BOUNDS = Object.freeze({
  impact: Object.freeze([0.10, 0.28]),
  alignment: Object.freeze([0.14, 0.34]),
  credibility: Object.freeze([0.10, 0.32]),
  collaboration: Object.freeze([0.08, 0.28]),
  feasibility: Object.freeze([0.08, 0.28]),
  risk: Object.freeze([0.08, 0.26]),
});

/** Ajustes por categoria: um pesquisador é julgado por evidência pública. */
export const CATEGORY_WEIGHT_HINTS = Object.freeze({
  researcher: Object.freeze({ credibility: 0.03, impact: -0.01 }),
  school: Object.freeze({ alignment: 0.02, collaboration: 0.01 }),
  organization: Object.freeze({ collaboration: 0.02, feasibility: 0.01 }),
});

const DEFAULT_SUBCRITERIA = Object.freeze({
  alignment: Object.freeze([
    { id: 'theme_fit', label: 'Aderência aos temas e ao contexto informados', weight: 0.55 },
    { id: 'priority_fit', label: 'Aderência às prioridades estratégicas do SENAI-SP', weight: 0.25 },
    { id: 'profile_fit', label: 'Adequação do tipo de stakeholder ao objetivo', weight: 0.20 },
  ]),
  impact: Object.freeze([
    { id: 'outcome_fit', label: 'Capacidade de entregar o resultado esperado', weight: 0.38 },
    { id: 'audience_fit', label: 'Alcance junto ao público informado', weight: 0.32 },
    { id: 'scale', label: 'Escala e influência demonstradas publicamente', weight: 0.30 },
  ]),
  credibility: Object.freeze([
    { id: 'public_evidence', label: 'Densidade de evidência pública no cadastro', weight: 0.38 },
    { id: 'recognition', label: 'Reconhecimento verificável (citações, prêmios, referência)', weight: 0.32 },
    { id: 'evidence_preference_fit', label: 'Presença do tipo de evidência que o usuário pediu', weight: 0.30 },
  ]),
  collaboration: Object.freeze([
    { id: 'existing_relationship', label: 'Relação já existente com o SENAI', weight: 0.40 },
    { id: 'contribution_fit', label: 'Contribuição oferecida x contribuição desejada', weight: 0.35 },
    { id: 'contactability', label: 'Canal público de contato identificado', weight: 0.25 },
  ]),
  feasibility: Object.freeze([
    { id: 'geography_fit', label: 'Compatibilidade geográfica com a preferência informada', weight: 0.40 },
    { id: 'modality_language_fit', label: 'Modalidade e idioma viáveis', weight: 0.30 },
    { id: 'timeframe_fit', label: 'Compatibilidade com o prazo informado', weight: 0.30 },
  ]),
  risk: Object.freeze([
    { id: 'signal_control', label: 'Ausência de sinais de risco não esclarecidos', weight: 0.50 },
    { id: 'information_completeness', label: 'Completude da informação pública verificável', weight: 0.30 },
    { id: 'constraint_compliance', label: 'Compatibilidade com as restrições declaradas', weight: 0.20 },
  ]),
});

export const SUBCRITERIA = DEFAULT_SUBCRITERIA;

const clampWeight = (dimension, value) => {
  const [min, max] = WEIGHT_BOUNDS[dimension];
  return Math.max(min, Math.min(max, value));
};

function normalize(weights) {
  const total = DIMENSIONS.reduce((sum, dimension) => sum + (weights[dimension] || 0), 0) || 1;
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, Number(((weights[dimension] || 0) / total).toFixed(4))]));
}

function briefText(brief = {}, answers = {}) {
  return [
    brief.context,
    brief.audience,
    brief.collaborationModel,
    ...(brief.themes || []),
    ...(brief.desiredOutcomes || []),
    ...(brief.contributionTypes || []),
    ...(brief.evidencePreferences || []),
    ...(brief.hardConstraints || []),
    brief.riskRules?.description,
    brief.diversityPreferences?.description,
    ...Object.values(brief.feasibility || {}),
    ...Object.values(answers || {}),
  ].filter(Boolean).map(String).join(' \n ');
}

/**
 * Regras de ajuste. Cada uma observa um sinal concreto da entrevista e move um
 * conjunto pequeno de pesos, sempre dentro das faixas declaradas acima.
 */
const WEIGHT_RULES = Object.freeze([
  {
    id: 'deadline_pressure',
    reason: 'Prazo curto declarado na entrevista',
    detect: ({ signals }) => signals.horizons.some((horizon) => ['urgent', 'short'].includes(horizon.id)),
    deltas: { feasibility: 0.05, collaboration: 0.02, alignment: -0.02, credibility: -0.02 },
  },
  {
    id: 'open_deadline',
    reason: 'Sem prazo definido: aderência pesa mais que rapidez',
    detect: ({ signals }) => signals.horizons.some((horizon) => horizon.id === 'open'),
    deltas: { alignment: 0.03, feasibility: -0.03 },
  },
  {
    id: 'evidence_demand',
    reason: 'Usuário pediu evidência pública explícita',
    detect: ({ brief, signals }) => (brief.evidencePreferences || []).length > 0 || signals.evidence.length > 0,
    deltas: { credibility: 0.05, alignment: -0.02, impact: -0.01 },
  },
  {
    id: 'risk_sensitivity',
    reason: 'Restrição de risco, conflito ou critério eliminatório informado',
    detect: ({ brief, signals }) => Boolean(brief.riskRules?.description) || signals.riskMarkers.length > 0,
    deltas: { risk: 0.06, impact: -0.03, alignment: -0.02 },
  },
  {
    id: 'partnership_intent',
    reason: 'Modelo de colaboração descrito pelo usuário',
    detect: ({ brief, signals }) => Boolean(brief.collaborationModel) || signals.contributions.some((item) => ['execution', 'infrastructure', 'funding'].includes(item.id)),
    deltas: { collaboration: 0.05, credibility: -0.02, impact: -0.01 },
  },
  {
    id: 'thematic_specificity',
    reason: 'Temas específicos foram nomeados',
    detect: ({ brief, signals }) => (brief.themes || []).length >= 3 || signals.priorities.length >= 2,
    deltas: { alignment: 0.04, feasibility: -0.02, risk: -0.01 },
  },
  {
    id: 'measurable_outcome',
    reason: 'Resultado esperado descrito de forma mensurável',
    detect: ({ signals }) => signals.measurableMarkers.length > 0,
    deltas: { impact: 0.04, credibility: -0.02 },
  },
  {
    id: 'restricted_geography',
    reason: 'Preferência geográfica ou de modalidade restrita',
    detect: ({ signals }) => signals.geography.some((scope) => ['sao_paulo', 'brazil'].includes(scope.id)) || signals.modalities.some((item) => item.id === 'in_person'),
    deltas: { feasibility: 0.04, impact: -0.02 },
  },
  {
    id: 'tight_budget',
    reason: 'Ausência ou limitação de orçamento declarada',
    detect: ({ signals }) => signals.budgets.some((budget) => ['none', 'limited'].includes(budget.id)),
    deltas: { feasibility: 0.03, collaboration: 0.01, impact: -0.02 },
  },
  {
    id: 'audience_focus',
    reason: 'Público beneficiário nomeado com clareza',
    detect: ({ brief, signals }) => Boolean(brief.audience) && signals.audiences.length > 0,
    deltas: { impact: 0.03, credibility: -0.01 },
  },
  {
    id: 'diversity_request',
    reason: 'Pedido explícito de equilíbrio na shortlist',
    detect: ({ brief }) => Boolean(brief.diversityPreferences?.description),
    deltas: { impact: 0.02, alignment: -0.01 },
  },
  {
    id: 'many_uncertainties',
    reason: 'Várias respostas ficaram em aberto: o risco de informação pesa mais',
    detect: ({ brief }) => (brief.uncertainties || []).length >= 3,
    deltas: { risk: 0.04, alignment: -0.02, impact: -0.02 },
  },
]);

/**
 * Deriva os pesos das dimensões a partir do objetivo, da categoria e das
 * respostas — sem pedir percentuais ao usuário.
 *
 * @returns {{weights:Record<string,number>, profile:string, adjustments:Array, groupWeights:{strategic:number, viability:number}, version:string}}
 */
export function deriveDimensionWeights({ objective, category, brief = {}, answers = {} } = {}) {
  const profile = OBJECTIVE_WEIGHT_PROFILES[objective] ? objective : 'guided';
  const base = { ...OBJECTIVE_WEIGHT_PROFILES[profile] };
  const text = briefText(brief, answers);
  const signals = extractSignals(text);
  const adjustments = [];

  const hints = CATEGORY_WEIGHT_HINTS[category];
  if (hints) {
    for (const [dimension, delta] of Object.entries(hints)) base[dimension] += delta;
    adjustments.push({ id: 'category_profile', reason: `Perfil de avaliação da categoria ${category}`, deltas: hints });
  }

  for (const rule of WEIGHT_RULES) {
    let matched = false;
    try {
      matched = Boolean(rule.detect({ brief, answers, signals, text }));
    } catch {
      matched = false;
    }
    if (!matched) continue;
    for (const [dimension, delta] of Object.entries(rule.deltas)) base[dimension] += delta;
    adjustments.push({ id: rule.id, reason: rule.reason, deltas: rule.deltas });
  }

  const bounded = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, clampWeight(dimension, base[dimension])]));
  const weights = normalize(bounded);
  const strategicRaw = DIMENSION_GROUPS.strategic.reduce((sum, dimension) => sum + weights[dimension], 0);
  const strategic = Number(Math.max(GROUP_BOUNDS.strategicMin, Math.min(GROUP_BOUNDS.strategicMax, strategicRaw)).toFixed(4));

  return {
    version: SELECTION_CRITERIA_VERSION,
    profile,
    baseline: OBJECTIVE_WEIGHT_PROFILES[profile],
    weights,
    adjustments,
    groupWeights: { strategic, viability: Number((1 - strategic).toFixed(4)) },
    signalsUsed: {
      priorities: signals.priorities.map((item) => item.id),
      audiences: signals.audiences.map((item) => item.id),
      contributions: signals.contributions.map((item) => item.id),
      geography: signals.geography.map((item) => item.id),
      horizons: signals.horizons.map((item) => item.id),
      evidence: signals.evidence.map((item) => item.id),
    },
  };
}

/**
 * Pesos relativos de uma dimensão dentro do seu grupo, para compor valor
 * estratégico e viabilidade com os mesmos pesos usados na nota final.
 */
export function groupShares(weights, group) {
  const members = DIMENSION_GROUPS[group];
  const total = members.reduce((sum, dimension) => sum + (weights[dimension] || 0), 0) || 1;
  return Object.fromEntries(members.map((dimension) => [dimension, (weights[dimension] || 0) / total]));
}

/** Rubrica legível enviada ao provider e exibida na rastreabilidade. */
export function describeCriteria(weights) {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    weight: weights?.[dimension] ?? null,
    subcriteria: SUBCRITERIA[dimension].map((item) => ({ id: item.id, label: item.label, weight: item.weight })),
  }));
}
