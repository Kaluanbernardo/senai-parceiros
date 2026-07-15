import { RADAR_SECTIONS } from './radar';
import { CATEGORY_IDS, OBJECTIVE_IDS } from './interview';

const CATEGORIES = CATEGORY_IDS;
const OBJECTIVES = OBJECTIVE_IDS;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function result(valid, errors) {
  return { valid, errors };
}

/** @typedef {{category:string, objective:string, context:string, desiredOutcomes:string[], audience:string, themes:string[], contributionTypes:string[], evidencePreferences:string[], collaborationModel:string, feasibility:Record<string, unknown>, hardConstraints:string[], riskRules:Record<string, unknown>, diversityPreferences:Record<string, unknown>, dimensionWeights:Record<string, number>, uncertainties:string[], answers:Record<string, unknown>}} SelectionBrief */
/** @typedef {{shortlist:Array, candidatePool:Array, trace:Record<string, unknown>}} SelectionResult */
/** @typedef {{section:string, title:string, sourceName:string, sourceUrl:string, publishedAt:string|null, provider:string, externalId:string, provenance:Record<string, unknown>, status:string, contentHash:string}} RadarItem */

/**
 * Creates a transient brief. It is intentionally an in-memory value: callers
 * must not persist it unless a future authenticated backend explicitly allows it.
 * @param {Partial<SelectionBrief>} input
 * @returns {SelectionBrief}
 */
export function createSelectionBrief(input = {}) {
  const answers = isObject(input.answers) ? { ...input.answers } : {};
  const list = (value) => Array.isArray(value) ? value.filter(nonEmpty).map((entry) => entry.trim()) : [];
  const record = (value) => isObject(value) ? { ...value } : {};
  return {
    category: nonEmpty(input.category) ? input.category : '',
    objective: nonEmpty(input.objective) ? input.objective : '',
    context: nonEmpty(input.context) ? input.context.trim() : (nonEmpty(answers.context) ? String(answers.context).trim() : ''),
    desiredOutcomes: list(input.desiredOutcomes),
    audience: nonEmpty(input.audience) ? input.audience.trim() : '',
    themes: list(input.themes),
    contributionTypes: list(input.contributionTypes),
    evidencePreferences: list(input.evidencePreferences),
    collaborationModel: nonEmpty(input.collaborationModel) ? input.collaborationModel.trim() : '',
    feasibility: record(input.feasibility),
    hardConstraints: list(input.hardConstraints),
    riskRules: record(input.riskRules),
    diversityPreferences: record(input.diversityPreferences),
    dimensionWeights: record(input.dimensionWeights),
    uncertainties: list(input.uncertainties),
    answers,
  };
}

/** @param {unknown} value @returns {{valid:boolean, errors:string[]}} */
export function validateSelectionBrief(value) {
  const errors = [];
  if (!isObject(value)) return result(false, ['brief must be an object']);
  if (!CATEGORIES.includes(value.category)) errors.push('category must be researcher, school or organization');
  if (!OBJECTIVES.includes(value.objective)) errors.push('objective is required');
  if (!nonEmpty(value.context)) errors.push('context is required');
  if (!isObject(value.answers)) errors.push('answers must be an object');
  if (!Array.isArray(value.desiredOutcomes)) errors.push('desiredOutcomes must be an array');
  for (const field of ['themes', 'contributionTypes', 'evidencePreferences', 'hardConstraints', 'uncertainties']) {
    if (!Array.isArray(value[field])) errors.push(`${field} must be an array`);
  }
  for (const field of ['feasibility', 'riskRules', 'diversityPreferences', 'dimensionWeights']) {
    if (!isObject(value[field])) errors.push(`${field} must be an object`);
  }
  return result(errors.length === 0, errors);
}

/** @param {unknown} value @returns {{valid:boolean, errors:string[]}} */
export function validateSelectionResult(value) {
  const errors = [];
  if (!isObject(value)) return result(false, ['selection result must be an object']);
  if (!Array.isArray(value.shortlist)) errors.push('shortlist must be an array');
  if (Array.isArray(value.shortlist) && value.shortlist.length > 10) errors.push('shortlist cannot exceed 10 candidates');
  if (!Array.isArray(value.candidatePool)) errors.push('candidatePool must be an array');
  if (!isObject(value.trace)) errors.push('trace must be an object');
  return result(errors.length === 0, errors);
}

/** @param {unknown} value @returns {{valid:boolean, errors:string[]}} */
export function validateRadarItem(value) {
  const errors = [];
  if (!isObject(value)) return result(false, ['radar item must be an object']);
  if (!RADAR_SECTIONS.includes(value.section)) errors.push('section is invalid');
  if (!nonEmpty(value.title)) errors.push('title is required');
  if (!nonEmpty(value.sourceName)) errors.push('sourceName is required');
  if (!nonEmpty(value.provider)) errors.push('provider is required');
  if (!nonEmpty(value.externalId)) errors.push('externalId is required');
  if (!isObject(value.provenance)) errors.push('provenance must be an object');
  if (!nonEmpty(value.status)) errors.push('status is required');
  if (!nonEmpty(value.contentHash)) errors.push('contentHash is required');
  if ((value.sourceUrl === null || value.sourceUrl === undefined) && !['placeholder', 'quarantine'].includes(value.status)) {
    errors.push('sourceUrl is required for published items');
  } else if (value.sourceUrl !== null && value.sourceUrl !== undefined) {
    try {
      const url = new URL(value.sourceUrl);
      if (!['http:', 'https:'].includes(url.protocol)) errors.push('sourceUrl must use http or https');
    } catch {
      errors.push('sourceUrl must be a URL');
    }
  }
  if (value.publishedAt !== null && value.publishedAt !== undefined) {
    const date = typeof value.publishedAt === 'string' ? new Date(`${value.publishedAt}T12:00:00`) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.publishedAt) || !date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.publishedAt) errors.push('publishedAt must use a valid YYYY-MM-DD date or null');
  }
  return result(errors.length === 0, errors);
}

export const CONTRACTS = Object.freeze({
  categories: CATEGORIES,
  objectives: OBJECTIVES,
  shortlistPolicy: Object.freeze({ currentMin: 0, targetMin: 5, max: 10 }),
});
