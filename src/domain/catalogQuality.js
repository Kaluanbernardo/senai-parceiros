export const CATALOG_QUALITY_VERSION = 1;

export const CATALOG_QUALITY_RULES = Object.freeze({
  descriptionMinCharacters: 400,
  organizationMinPublicLinks: 1,
  schoolMinPublicLinks: 1,
  personMinPublicLinks: 3,
  researcherMinPublicationLinks: 5,
});

const EMPTY_VALUES = new Set(['', '-', '—', 'n/a', 'nao localizado', 'não localizado', 'nao informado', 'não informado']);

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
function useful(value) {
  return !EMPTY_VALUES.has(text(value).toLowerCase());
}

function list(value) {
  if (Array.isArray(value)) return value.flatMap(list);
  return text(value).split(/[;,\n]/).map((entry) => entry.trim()).filter(useful);
}

function firstUseful(record, fields) {
  return fields.map((field) => record?.[field]).find(useful);
}

function longest(record, fields) {
  return fields.map((field) => text(record?.[field])).sort((left, right) => right.length - left.length)[0] || '';
}

function normalizeUrl(value) {
  try {
    const url = new URL(text(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.hash = '';
    const normalized = url.toString().replace(/\/$/, '');
    return /^https?:\/\/www\.google\.com\/s2\/favicons/i.test(normalized) ? '' : normalized;
  } catch {
    return '';
  }
}

function urlsIn(value) {
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(urlsIn);
  const direct = normalizeUrl(value);
  if (direct) return [direct];
  return [...text(value).matchAll(/https?:\/\/[^\s;|)\]}]+/g)].map((match) => normalizeUrl(match[0])).filter(Boolean);
}

export function catalogPublicUrls(record = {}) {
  const values = [
    record.website,
    record.website_oficial,
    record.fontes,
    record.evidencias_publicas,
    record.perfil_principal_url,
    record.linkedin_url,
    record.scholar,
    record.google_scholar_url,
    record.artigos,
    record.publicacoes_relevantes,
    record.producoes_relevantes,
  ];
  return [...new Set(values.flatMap(urlsIn))];
}

export function directPublicationUrls(record = {}) {
  const candidates = [record.artigos, record.publicacoes_relevantes, record.producoes_relevantes].flatMap(urlsIn);
  return [...new Set(candidates.filter((value) => {
    try {
      const url = new URL(value);
      return !/(^|\.)scholar\.google\./i.test(url.hostname);
    } catch {
      return false;
    }
  }))];
}

export function isResearchProfile(record = {}) {
  const profiles = list(record.perfis_atuacao).join(' ').toLowerCase();
  return /pesquis|academ|cient/i.test(profiles)
    || ['scholar', 'lattes', 'orcid', 'researchgate', 'academia'].includes(text(record.profileType).toLowerCase())
    || useful(record.h_index)
    || (Array.isArray(record.artigos) && record.artigos.length > 0);
}

const CORE_FIELDS = Object.freeze({
  organization: [
    { id: 'identity', label: 'nome', fields: ['nome', 'instituicao'] },
    { id: 'country', label: 'país', fields: ['pais'] },
    { id: 'classification', label: 'natureza ou setor', fields: ['natureza_juridica', 'natureza', 'setor', 'categoria'] },
    { id: 'activity', label: 'atuação ou diferencial', fields: ['atuacao', 'diferencial', 'relevancia'] },
    { id: 'relationship', label: 'relação pública', fields: ['relacao_publica', 'relacao'] },
    { id: 'website', label: 'website oficial', fields: ['website_oficial', 'website'] },
  ],
  school: [
    { id: 'identity', label: 'instituição', fields: ['instituicao', 'nome'] },
    { id: 'country', label: 'país', fields: ['pais'] },
    { id: 'areas', label: 'áreas de formação', fields: ['areas_formacao', 'areas'] },
    { id: 'relevance', label: 'relevância ou relação com a indústria', fields: ['relevancia', 'relacao_industria', 'diferencial'] },
    { id: 'website', label: 'website oficial', fields: ['website_oficial', 'website'] },
  ],
  person: [
    { id: 'identity', label: 'nome', fields: ['nome'] },
    { id: 'country', label: 'país', fields: ['pais'] },
    { id: 'institution', label: 'instituição atual', fields: ['instituicao', 'instituicao_atual'] },
    { id: 'areas', label: 'áreas de especialidade', fields: ['areas', 'areas_especialidade'] },
    { id: 'profile', label: 'perfil público', fields: ['perfil_principal_url', 'linkedin_url', 'scholar', 'google_scholar_url'] },
  ],
});

function normalizedCategory(category) {
  return category === 'researcher' ? 'person' : category;
}

export function auditCatalogRecord(record = {}, category = 'organization') {
  const resolvedCategory = normalizedCategory(category);
  const description = longest(record, resolvedCategory === 'person'
    ? ['pesquisa', 'descricao', 'miniBio']
    : ['descricao']);
  const publicUrls = catalogPublicUrls(record);
  const publicationUrls = directPublicationUrls(record);
  const researchProfile = resolvedCategory === 'person' && isResearchProfile(record);
  const minimumLinks = resolvedCategory === 'person'
    ? CATALOG_QUALITY_RULES.personMinPublicLinks
    : resolvedCategory === 'school'
      ? CATALOG_QUALITY_RULES.schoolMinPublicLinks
      : CATALOG_QUALITY_RULES.organizationMinPublicLinks;
  const missing = [];

  if (description.length < CATALOG_QUALITY_RULES.descriptionMinCharacters) {
    missing.push({
      id: 'description',
      label: `descrição com pelo menos ${CATALOG_QUALITY_RULES.descriptionMinCharacters} caracteres`,
      actual: description.length,
      expected: CATALOG_QUALITY_RULES.descriptionMinCharacters,
    });
  }
  if (publicUrls.length < minimumLinks) {
    missing.push({ id: 'public_links', label: `${minimumLinks} links públicos`, actual: publicUrls.length, expected: minimumLinks });
  }
  if (researchProfile && publicationUrls.length < CATALOG_QUALITY_RULES.researcherMinPublicationLinks) {
    missing.push({
      id: 'publications',
      label: `${CATALOG_QUALITY_RULES.researcherMinPublicationLinks} publicações com links diretos`,
      actual: publicationUrls.length,
      expected: CATALOG_QUALITY_RULES.researcherMinPublicationLinks,
    });
  }
  for (const field of CORE_FIELDS[resolvedCategory] || []) {
    if (!firstUseful(record, field.fields)) missing.push({ id: `field:${field.id}`, label: field.label, actual: 0, expected: 1 });
  }

  return {
    pass: missing.length === 0,
    category: resolvedCategory,
    version: CATALOG_QUALITY_VERSION,
    missing,
    metrics: {
      descriptionCharacters: description.length,
      publicLinks: publicUrls.length,
      directPublicationLinks: publicationUrls.length,
      researchProfile,
    },
  };
}

export function auditCatalogQuality(catalog = {}) {
  const categories = ['organization', 'school', 'person'].map((category) => {
    const records = Array.isArray(catalog[category]) ? catalog[category] : [];
    const results = records.map((record) => ({ record, quality: auditCatalogRecord(record, category) }));
    return {
      category,
      total: results.length,
      conforming: results.filter((entry) => entry.quality.pass).length,
      needsEnrichment: results.filter((entry) => !entry.quality.pass).length,
      results,
    };
  });
  return {
    version: CATALOG_QUALITY_VERSION,
    total: categories.reduce((sum, entry) => sum + entry.total, 0),
    conforming: categories.reduce((sum, entry) => sum + entry.conforming, 0),
    needsEnrichment: categories.reduce((sum, entry) => sum + entry.needsEnrichment, 0),
    categories,
  };
}

export function catalogQualityPublicContract() {
  return {
    version: CATALOG_QUALITY_VERSION,
    descriptionMinCharacters: CATALOG_QUALITY_RULES.descriptionMinCharacters,
    organizationMinPublicLinks: CATALOG_QUALITY_RULES.organizationMinPublicLinks,
    schoolMinPublicLinks: CATALOG_QUALITY_RULES.schoolMinPublicLinks,
    personMinPublicLinks: CATALOG_QUALITY_RULES.personMinPublicLinks,
    researcherMinPublicationLinks: CATALOG_QUALITY_RULES.researcherMinPublicationLinks,
  };
}
