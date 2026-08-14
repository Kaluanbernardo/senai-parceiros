export const CATALOG_CATEGORY_LABELS = Object.freeze({
  person: 'Pessoa Física',
  organization: 'Pessoa Jurídica',
});

export const PERSON_SUBTYPES = Object.freeze([
  'Profissional ou especialista',
  'Pesquisador(a) ou acadêmico(a)',
  'Educador(a)',
  'Empreendedor(a) ou liderança empresarial',
  'Jornalista ou comunicador(a)',
  'Personalidade pública',
  'Agente público ou político(a)',
  'Liderança social ou comunitária',
  'Artista ou criador(a)',
  'Outro',
]);

export const ORGANIZATION_SUBTYPES = Object.freeze([
  'Instituição de ensino',
  'Empresa',
  'Órgão público',
  'Entidade setorial ou sindical',
  'Instituto ou fundação',
  'Organização da sociedade civil',
  'Organismo internacional',
  'Centro de pesquisa e inovação',
  'Rede ou consórcio',
  'Outro',
]);

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function exactSubtype(value, choices) {
  const normalized = fold(value);
  return choices.find((choice) => fold(choice) === normalized) || '';
}

export function normalizeCatalogCategory(category) {
  const value = fold(category);
  if (['person', 'researcher', 'pessoa', 'pessoa fisica', 'pf'].includes(value)) return 'person';
  if (['organization', 'organisation', 'school', 'escola', 'instituicao', 'instituicao educacional', 'pessoa juridica', 'pj'].includes(value)) return 'organization';
  return String(category || '').trim().toLowerCase();
}

export function isLegacyEducationCategory(category) {
  return ['school', 'escola', 'instituicao educacional', 'instituicao de educacao'].includes(fold(category));
}

const PERSON_SUBTYPE_ALIASES = Object.freeze([
  [/pesquis|academic|cientist/, PERSON_SUBTYPES[1]],
  [/educador|docent|professor|instrutor/, PERSON_SUBTYPES[2]],
  [/empreend|fundador|empresari|executiv|lideranca empresarial/, PERSON_SUBTYPES[3]],
  [/jornali|imprensa|comunicador|midia/, PERSON_SUBTYPES[4]],
  [/personalidade|influenciador|celebridade/, PERSON_SUBTYPES[5]],
  [/politic|agent[ea] public[oa]|gestao publica|servidor[oa]? public[oa]|secretari[oa] de estado|governo/, PERSON_SUBTYPES[6]],
  [/lideranca social|lideranca comunitaria|ativista/, PERSON_SUBTYPES[7]],
  [/artista|criador|escritor|cineasta|musico/, PERSON_SUBTYPES[8]],
  [/outro/, PERSON_SUBTYPES[9]],
  [/profission|especialista|industria|tecnic/, PERSON_SUBTYPES[0]],
]);

const ORGANIZATION_SUBTYPE_ALIASES = Object.freeze([
  [/escola|educa|ensino|universidade|faculdade|formacao|academy|college/, ORGANIZATION_SUBTYPES[0]],
  [/empresa|companhia|corporacao|startup|privada|industria/, ORGANIZATION_SUBTYPES[1]],
  [/orgao publico|publica|governo|secretaria|minist[eé]rio|prefeitura|autarquia/, ORGANIZATION_SUBTYPES[2]],
  [/setorial|sindical|sindicato|associacao empresarial|federacao empresarial/, ORGANIZATION_SUBTYPES[3]],
  [/instituto|fundacao/, ORGANIZATION_SUBTYPES[4]],
  [/sociedade civil|terceiro setor|ong|osc|organizacao social/, ORGANIZATION_SUBTYPES[5]],
  [/organismo internacional|multilateral|intergovernamental/, ORGANIZATION_SUBTYPES[6]],
  [/centro de pesquisa|centro de inovacao|pesquisa e inovacao|laboratorio/, ORGANIZATION_SUBTYPES[7]],
  [/rede|consorcio|parceria publico privada|ppp/, ORGANIZATION_SUBTYPES[8]],
  [/outro/, ORGANIZATION_SUBTYPES[9]],
]);

function inferredSubtype(value, aliases) {
  const normalized = fold(value);
  if (!normalized) return '';
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] || '';
}

export function normalizePersonSubtype(value) {
  return exactSubtype(value, PERSON_SUBTYPES);
}

export function normalizeOrganizationSubtype(value) {
  return exactSubtype(value, ORGANIZATION_SUBTYPES);
}

export function normalizeCatalogSubtype(category, value) {
  const normalizedCategory = normalizeCatalogCategory(category);
  if (normalizedCategory === 'person') return normalizePersonSubtype(value);
  if (normalizedCategory === 'organization') return normalizeOrganizationSubtype(value);
  return '';
}

export function isCatalogSubtype(category, value) {
  return Boolean(normalizeCatalogSubtype(category, value));
}

export function normalizeCatalogRequest(category, subtype = '') {
  const normalizedCategory = normalizeCatalogCategory(category);
  const implicitSubtype = isLegacyEducationCategory(category) ? ORGANIZATION_SUBTYPES[0] : '';
  return {
    category: normalizedCategory,
    subtype: normalizeCatalogSubtype(normalizedCategory, subtype) || implicitSubtype,
  };
}

export function inferPersonSubtype(record = {}) {
  const explicit = normalizePersonSubtype(record.subtipo) || inferredSubtype(record.subtipo, PERSON_SUBTYPE_ALIASES);
  if (explicit) return explicit;
  const text = fold([
    record.cargo,
    record.perfis_atuacao,
    record.areas,
    record.pesquisa,
    record.miniBio,
  ].flat().filter(Boolean).join(' '));
  if (record.scholar || record.orcid || record.openalex_id || record.h_index || /pesquis|academic|cientist/.test(text)) return PERSON_SUBTYPES[1];
  return PERSON_SUBTYPE_ALIASES.find(([pattern]) => pattern.test(text))?.[1] || PERSON_SUBTYPES[0];
}

export function inferOrganizationSubtype(record = {}) {
  const explicit = normalizeOrganizationSubtype(record.subtipo) || inferredSubtype(record.subtipo, ORGANIZATION_SUBTYPE_ALIASES);
  if (explicit) return explicit;

  // Identidade/natureza declarada vence palavras incidentais do nome ou da
  // descrição. Uma OSC que atua com educação e indústria continua sendo OSC;
  // um órgão público educacional continua sendo órgão público.
  const declaredCategory = fold(record.categoria);
  const declaredNature = fold([record.natureza, record.natureza_juridica].filter(Boolean).join(' '));
  if (/escola|instituicao de ensino|instituicao educacional/.test(declaredCategory)) return ORGANIZATION_SUBTYPES[0];
  if (/terceiro setor|sociedade civil|\bosc\b|\bong\b|organizacao social/.test(`${declaredCategory} ${declaredNature}`)) return ORGANIZATION_SUBTYPES[5];
  if (/orgao publico|publica|governo|autarquia|administracao publica|\bppp\b|parceria publico privada/.test(`${declaredCategory} ${declaredNature}`)) return ORGANIZATION_SUBTYPES[2];
  if (/empresa|companhia|corporacao|startup|privada|industria/.test(`${declaredCategory} ${declaredNature}`)) return ORGANIZATION_SUBTYPES[1];

  const structuralType = fold([record.tipo_instituicao, record.setor].filter(Boolean).join(' '));
  const structural = inferredSubtype(structuralType, ORGANIZATION_SUBTYPE_ALIASES);
  if (structural) return structural;

  const descriptiveText = fold([record.nome, record.atuacao, record.descricao].filter(Boolean).join(' '));
  if (/centro (?:nacional )?(?:de )?(?:pesquisa|investigacao|inovacao)|research (?:centre|center)|laboratorio/.test(descriptiveText)) return ORGANIZATION_SUBTYPES[7];
  if (record.areas_formacao || record.niveis_oferta) return ORGANIZATION_SUBTYPES[0];
  return inferredSubtype(descriptiveText, ORGANIZATION_SUBTYPE_ALIASES) || ORGANIZATION_SUBTYPES[9];
}

export function withCatalogClassification(record = {}, category) {
  const normalizedCategory = normalizeCatalogCategory(category || record.tipo_registro || record.categoria);
  if (normalizedCategory === 'person') {
    return { ...record, categoria: CATALOG_CATEGORY_LABELS.person, subtipo: inferPersonSubtype(record) };
  }
  if (normalizedCategory === 'organization') {
    return { ...record, categoria: CATALOG_CATEGORY_LABELS.organization, subtipo: inferOrganizationSubtype(record) };
  }
  return { ...record };
}
