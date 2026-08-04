/**
 * Leitura semântica de uma resposta livre da entrevista.
 *
 * A entrevista deixou de ser um formulário: em vez de perguntar campo a campo,
 * o planejador lê o que a pessoa escreveu e marca como coberto tudo aquilo que
 * a resposta já entrega. Uma frase como "evento em outubro, em São Paulo, para
 * instrutores, sobre economia circular" cobre tema, público, geografia e prazo
 * de uma vez — e nenhuma dessas perguntas precisa ser repetida.
 *
 * O módulo é puro e determinístico: serve tanto para a entrevista local quanto
 * para validar/complementar o que o provider de IA extrai.
 */

import {
  AUDIENCE_PROFILES, BUDGET_LEVELS, CONTRIBUTION_TYPES, EVIDENCE_TYPES, GEOGRAPHY_SCOPES,
  LANGUAGES, LEXICAL_MARKERS, MODALITIES, STRATEGIC_PRIORITIES, TIME_HORIZONS,
  fold, hasMarker, matchTaxonomy,
} from './senaiContext.js';

export const ANSWER_SIGNALS_VERSION = 'answer-signals-v1';

/** Confiança mínima para que um campo derivado dispense a pergunta. */
export const COVERAGE_CONFIDENCE_THRESHOLD = 0.6;

const UNKNOWN_PATTERN = /^(?:n[aã]o sei(?: ainda)?|ainda n[aã]o sei|desconhe[cç]o|sem prefer[eê]ncia|indefinido|n[aã]o informado|nao informado|\?|-)$/i;

export function isUnknownAnswer(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (UNKNOWN_PATTERN.test(text)) return true;
  // "não sei ainda, talvez algo sobre robótica" ainda traz informação; só é
  // desconhecido quando a frase inteira se resume à negativa.
  return text.length <= 24 && hasMarker(text, LEXICAL_MARKERS.unknown).length > 0;
}

function words(text) {
  return fold(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Extrai todos os sinais reconhecíveis de um texto livre.
 * @param {string} text
 */
export function extractSignals(text) {
  const value = String(text || '').trim();
  const empty = !value || isUnknownAnswer(value);
  const dates = /\b(?:\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s+de\s+[a-zç]+|\d{4})\b/i.test(value);
  return {
    version: ANSWER_SIGNALS_VERSION,
    unknown: empty,
    wordCount: empty ? 0 : words(value).length,
    priorities: empty ? [] : matchTaxonomy(value, STRATEGIC_PRIORITIES),
    contributions: empty ? [] : matchTaxonomy(value, CONTRIBUTION_TYPES),
    audiences: empty ? [] : matchTaxonomy(value, AUDIENCE_PROFILES),
    evidence: empty ? [] : matchTaxonomy(value, EVIDENCE_TYPES),
    geography: empty ? [] : matchTaxonomy(value, GEOGRAPHY_SCOPES),
    modalities: empty ? [] : matchTaxonomy(value, MODALITIES),
    languages: empty ? [] : matchTaxonomy(value, LANGUAGES),
    horizons: empty ? [] : matchTaxonomy(value, TIME_HORIZONS),
    budgets: empty ? [] : matchTaxonomy(value, BUDGET_LEVELS),
    constraintMarkers: empty ? [] : hasMarker(value, LEXICAL_MARKERS.constraint),
    riskMarkers: empty ? [] : hasMarker(value, LEXICAL_MARKERS.risk),
    outcomeMarkers: empty ? [] : hasMarker(value, LEXICAL_MARKERS.outcome),
    measurableMarkers: empty ? [] : hasMarker(value, LEXICAL_MARKERS.measurable),
    hasDate: !empty && dates,
  };
}

function labels(matches, limit = 3) {
  return matches.slice(0, limit).map((match) => match.label);
}

/**
 * Confiança de cobertura: um único termo reconhecido sugere o assunto, dois ou
 * mais tornam a resposta suficiente para não repetir a pergunta.
 */
function confidenceFor(matches, bonus = 0) {
  if (!matches.length) return 0;
  const terms = matches.reduce((total, match) => total + match.matched.length, 0);
  return Math.min(1, 0.4 + terms * 0.2 + bonus);
}

/**
 * Descobre quais campos canônicos da entrevista uma resposta já satisfaz.
 * @param {string} text resposta livre
 * @param {{field?:string}} options campo que estava sendo perguntado (sempre coberto)
 * @returns {Record<string, {value:string, confidence:number, evidence:string[]}>}
 */
export function deriveFieldCoverage(text, { field = '' } = {}) {
  const value = String(text || '').trim();
  const signals = extractSignals(value);
  const coverage = {};
  const add = (id, confidence, evidence) => {
    if (!id || confidence < COVERAGE_CONFIDENCE_THRESHOLD) return;
    if (id === field) return;
    const existing = coverage[id];
    if (existing && existing.confidence >= confidence) return;
    coverage[id] = { value, confidence: Number(confidence.toFixed(2)), evidence };
  };
  if (signals.unknown) return coverage;

  add('themes', confidenceFor(signals.priorities), labels(signals.priorities));
  add('audience', confidenceFor(signals.audiences), labels(signals.audiences));
  add('contribution_types', confidenceFor(signals.contributions), labels(signals.contributions));
  add('evidence_preferences', confidenceFor(signals.evidence), labels(signals.evidence));
  add('geography', confidenceFor(signals.geography), labels(signals.geography));
  add('language_modality', confidenceFor([...signals.modalities, ...signals.languages]), labels([...signals.modalities, ...signals.languages]));
  add('timeframe', confidenceFor(signals.horizons, signals.hasDate ? 0.2 : 0), labels(signals.horizons));
  add('budget', confidenceFor(signals.budgets), labels(signals.budgets));
  add('constraints', signals.constraintMarkers.length ? 0.4 + signals.constraintMarkers.length * 0.2 : 0, signals.constraintMarkers.slice(0, 3));
  add('risk_rules', signals.riskMarkers.length ? 0.4 + signals.riskMarkers.length * 0.3 : 0, signals.riskMarkers.slice(0, 3));
  add('desired_outcome', signals.outcomeMarkers.length && signals.wordCount >= 8 ? 0.4 + signals.outcomeMarkers.length * 0.2 : 0, signals.outcomeMarkers.slice(0, 3));
  add('success_indicators', signals.measurableMarkers.length ? 0.4 + signals.measurableMarkers.length * 0.2 : 0, signals.measurableMarkers.slice(0, 3));
  return coverage;
}

/**
 * Verbos e conectivos de abertura que não dizem nada sobre o assunto.
 * Removê-los faz a citação começar no que a pessoa realmente descreveu.
 */
// A fronteira usa lookahead unicode: `\b` é ASCII e falharia logo depois de
// uma palavra acentuada como "será".
const LEAD_WORDS = /^(?:eu|n[oó]s|quero|queremos|preciso|precisamos|pretendo|pretendemos|gostaria|gostar[ií]amos|estamos|estou|vamos|vou|busco|buscamos|procuro|procuramos|penso|ser[aá]|seria|[ée]|de|do|da|em|no|na|um|uma|o|a|os|as|meu|nosso|nossa|comparar|entender|encontrar|conhecer|montar|organizar|realizar|promover|fazer|ter|trazer|convidar|sobre|para|que|com)(?![\p{L}\p{N}])[\s,;:—-]*/iu;

const MAX_FOCUS_LENGTH = 72;

function trimLead(text) {
  let value = String(text || '').trim();
  for (let step = 0; step < 4; step += 1) {
    const next = value.replace(LEAD_WORDS, '');
    if (next === value || !next) break;
    value = next;
  }
  return value.trim();
}

/**
 * Trecho curto e legível do que a pessoa acabou de dizer, usado para encadear
 * a próxima pergunta com as palavras dela — não com um rótulo interno.
 */
export function focusTermFor(text) {
  const value = String(text || '').trim();
  if (!value || isUnknownAnswer(value)) return '';
  const clause = value.split(/[.;\n]/).map((part) => part.trim()).filter(Boolean)[0] || value;
  const focus = trimLead(clause) || clause;
  if (focus.length <= MAX_FOCUS_LENGTH) return focus.replace(/[.!?,;:]+$/u, '');
  const clipped = focus.slice(0, MAX_FOCUS_LENGTH);
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary > 24 ? clipped.slice(0, boundary) : clipped).replace(/[.!?,;:]+$/u, '')}…`;
}
