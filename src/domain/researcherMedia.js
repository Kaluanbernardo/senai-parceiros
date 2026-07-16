export const RESEARCHER_IMAGE_STATUSES = Object.freeze([
  'approved',
  'needs-review',
  'missing',
  'blocked',
]);

export const RESEARCHER_IMAGE_SOURCE_TYPES = Object.freeze([
  'institutional',
  'academic-profile',
  'public-professional',
  'social',
  'licensed-stock',
  'legacy-local',
  'unknown',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value, pattern) {
  return value === null || value === undefined || (
    typeof value === 'string'
    && pattern.test(value)
    && !Number.isNaN(new Date(value).getTime())
  );
}

function validUrl(value) {
  if (value === null || value === undefined || value === '') return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeResearcherImage(image = {}) {
  image = isObject(image) ? image : {};
  const status = RESEARCHER_IMAGE_STATUSES.includes(image.status) ? image.status : 'missing';
  const confidence = Number(image.confidence);
  return {
    path: nonEmpty(image.path) ? image.path.trim() : null,
    sourceUrl: nonEmpty(image.sourceUrl) ? image.sourceUrl.trim() : null,
    sourceType: RESEARCHER_IMAGE_SOURCE_TYPES.includes(image.sourceType) ? image.sourceType : 'unknown',
    license: nonEmpty(image.license) ? image.license.trim() : 'unknown',
    attribution: nonEmpty(image.attribution) ? image.attribution.trim() : null,
    retrievedAt: image.retrievedAt || null,
    status,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
    reviewedAt: image.reviewedAt || null,
  };
}

export function validateResearcherImage(value) {
  const errors = [];
  if (!isObject(value)) return { valid: false, errors: ['image must be an object'] };
  if (!nonEmpty(value.path) || !value.path.startsWith('/fotos/')) errors.push('path must point to a local /fotos asset');
  if (!validUrl(value.sourceUrl)) errors.push('sourceUrl must be an http(s) URL or null');
  if (!RESEARCHER_IMAGE_SOURCE_TYPES.includes(value.sourceType)) errors.push('sourceType is invalid');
  if (!nonEmpty(value.license)) errors.push('license is required');
  if (!validDate(value.retrievedAt, ISO_DATE) && !validDate(value.retrievedAt, ISO_TIMESTAMP)) errors.push('retrievedAt must be an ISO date/timestamp or null');
  if (!RESEARCHER_IMAGE_STATUSES.includes(value.status)) errors.push('status is invalid');
  if (!Number.isFinite(Number(value.confidence)) || Number(value.confidence) < 0 || Number(value.confidence) > 100) errors.push('confidence must be between 0 and 100');
  if (!validDate(value.reviewedAt, ISO_DATE) && !validDate(value.reviewedAt, ISO_TIMESTAMP)) errors.push('reviewedAt must be an ISO date/timestamp or null');
  if (value.status === 'approved' && !nonEmpty(value.sourceUrl)) errors.push('approved images require sourceUrl provenance');
  return { valid: errors.length === 0, errors };
}

export function createResearcherImage(input = {}) {
  const image = normalizeResearcherImage(input);
  const validation = validateResearcherImage(image);
  if (!validation.valid) throw new Error(`invalid_researcher_image:${validation.errors.join(';')}`);
  return image;
}

export function isApprovedResearcherImage(image) {
  return validateResearcherImage(image).valid && image.status === 'approved';
}

export function buildResearcherImageManifest(researchers = []) {
  return researchers.map((researcher) => ({
    researcherId: researcher?.id ?? null,
    name: researcher?.nome || '',
    image: normalizeResearcherImage(researcher?.image),
  }));
}

export function summarizeImageCoverage(manifest = []) {
  return manifest.reduce((coverage, entry) => {
    const status = RESEARCHER_IMAGE_STATUSES.includes(entry?.image?.status) ? entry.image.status : 'missing';
    coverage.total += 1;
    coverage[status] += 1;
    return coverage;
  }, {
    total: 0,
    approved: 0,
    'needs-review': 0,
    missing: 0,
    blocked: 0,
  });
}
