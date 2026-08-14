import { formatInstitutionName } from './institutionName.js';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function domain(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const ALIASES = [
  [/\b(senai|servico nacional de aprendizagem industrial)\b/, 'senai'],
  [/\b(senac|servico nacional de aprendizagem comercial)\b/, 'senac'],
  [/centro (estadual de educacao tecnologica )?paula souza/, 'centro-paula-souza'],
  [/\bconalep\b/, 'conalep'],
  [/\bafpa\b|agence nationale pour la formation professionnelle des adultes/, 'afpa'],
  [/\bivy tech\b/, 'ivy-tech'],
  [/\bsait\b|southern alberta institute of technology/, 'sait'],
  [/\bits academy\b|istituti tecnologici superiori/, 'its-academy'],
  [/\bkosen\b|national institute of technology japan/, 'kosen'],
  [/\bjeed\b|japan organization for employment/, 'jeed'],
  [/\bkorea polytechnics\b|\bkopo\b/, 'korea-polytechnics'],
  [/\butn\b|universidad tecnologica nacional/, 'utn'],
  [/\bsena\b|servicio nacional de aprendizaje/, 'sena'],
  [/\btafe nsw\b/, 'tafe-nsw'],
  [/\btvtc\b|technical and vocational training corporation/, 'tvtc'],
  [/\bshenzhen polytechnic university\b/, 'shenzhen-polytechnic-university'],
  [/\bindustrial training institutes\b|\biti system\b|\bsistema de itis\b/, 'iti-system'],
  [/\btvet colleges\b/, 'tvet-colleges-system'],
];

function aliasKey(name, website = '', country = '') {
  const value = fold(name);
  const alias = ALIASES.find(([pattern]) => pattern.test(value))?.[1] || '';
  if (!alias) return '';
  // Keep a national network separate from regional departments and local
  // units (e.g. SENAI national versus SENAI-SP or a named SENAI campus).
  const acronym = new RegExp(`\\b${alias}\\b`);
  const canonicalNetworkName = alias === 'senai'
    ? /^(?:senai )?servico nacional de aprendizagem industrial$/
    : alias === 'senac'
      ? /^(?:senac )?servico nacional de aprendizagem comercial$/
      : null;
  const namedUnit = Boolean(canonicalNetworkName && acronym.test(value) && !canonicalNetworkName.test(value));
  const localScope = namedUnit || /\b(sp|sao paulo|regional|departamento|unidade|campus|etec|fatec)\b/.test(value);
  if (localScope) return `scoped:${alias}:${value}`;
  // These generic labels are used by several national systems. Keep the
  // official domain/country in the identity so an imported ITI or TVET
  // network from another country cannot be merged accidentally.
  if (['shenzhen-polytechnic-university', 'iti-system', 'tvet-colleges-system'].includes(alias)) {
    const host = domain(website);
    const scope = [host, fold(country)].filter(Boolean).join('|');
    return scope ? `${alias}|${scope}` : `${alias}|${value}`;
  }
  return alias;
}

function normalizeRecord(record, source) {
  const name = record.nome || record.instituicao || '';
  const website = record.website || '';
  const relation = String(record.relacao || '').trim();
  const negativeRelation = /sem registro|sem evid[eê]ncia|nenhuma parceria|n[aã]o encontrei|n[aã]o identifiquei|sem parceria|potencial parceiro|potencial|poss[ií]veis? di[aá]logos?|parceiro natural|benchmark|di[aá]logo via|lista .* como parceiro|estudou modelo|trocam experi[eê]ncias/i.test(relation);
  const positiveRelation = /^(?:✅|🔗)\s*|^sim\b.*\bparcer|^parceiro\s+(?:de projetos|irm[aã]o)\b/i.test(relation);
  const normalizedName = fold(name);
  const namedNetworkUnit = /^(senai|senac)\s+/.test(normalizedName)
    && !/^(?:senai|senac) servico nacional de aprendizagem (industrial|comercial)$/.test(normalizedName);
  const scope = namedNetworkUnit || /\b(unidade|campus|etec|fatec|escola)\b/.test(normalizedName)
    ? 'local'
    : /\b(sp|sao paulo|regional|departamento)\b/.test(normalizedName)
      ? 'regional'
      : 'national_or_network';
  return {
    id: `${source}:${record.id}`,
    nome: formatInstitutionName(name),
    descricao: record.descricao || record.diferencial || record.relevancia || '',
    relevancia: record.relevancia || record.diferencial || '',
    pais: record.pais || '',
    logo: record.logo || '',
    website,
    state: record.estado || record.uf || '',
    city: record.cidade || '',
    acronym: record.sigla || '',
    scope,
    categoria: 'Escola',
    areas: Array.isArray(record.areas || record.areas_formacao)
      ? (record.areas || record.areas_formacao).join('; ')
      : (record.areas || record.areas_formacao || ''),
    hasPartnership: source === 'stakeholders' && positiveRelation && !negativeRelation,
    _source: source,
    _sourceId: record.id,
    _original: record,
  };
}

function matchKey(record) {
  const alias = aliasKey(record.nome, record.website, record.pais);
  if (alias) return `alias:${alias}`;
  const normalizedName = fold(record.nome);
  const host = domain(record.website);
  return host ? `name:${normalizedName}|domain:${host}` : `name:${normalizedName}|country:${fold(record.pais)}`;
}

function mergeGroup(records) {
  const ordered = [...records].sort((a, b) => (a._source === 'escolas' ? -1 : 1) - (b._source === 'escolas' ? -1 : 1));
  const first = ordered[0];
  const names = [...new Set(ordered.map((record) => record.nome).filter(Boolean))];
  const descriptionSource = ordered.filter((record) => record.descricao).sort((a, b) => b.descricao.length - a.descricao.length)[0];
  const areaSources = ordered.filter((record) => record.areas).map((record) => ({ source: record._source, id: record._sourceId }));
  const fieldProvenance = {};
  for (const field of ['nome', 'descricao', 'pais', 'state', 'city', 'website', 'areas']) {
    const source = ordered.find((record) => record[field]);
    if (source) fieldProvenance[field] = { source: source._source, id: source._sourceId };
  }
  const areas = [...new Set(ordered.flatMap((record) => String(record.areas || '').split(';').map((area) => area.trim()).filter(Boolean)))].join('; ');
  const descricao = descriptionSource?.descricao || '';
  const relevancia = longestValue(ordered, 'relevancia');
  if (descriptionSource) fieldProvenance.descricao = { source: descriptionSource._source, id: descriptionSource._sourceId };
  if (areaSources.length > 1) fieldProvenance.areas = areaSources;
  return {
    ...first,
    descricao,
    relevancia,
    areas,
    id: `school:${first._source}:${first._sourceId}`,
    aliases: names,
    sourceRecords: ordered.map((record) => ({ source: record._source, id: record._sourceId })),
    sourceTypes: [...new Set(ordered.map((record) => record._source))],
    fieldProvenance,
    hasPartnership: ordered.some((record) => record.hasPartnership),
    catalogIdentity: matchKey(first),
  };
}

function longestValue(records, field) {
  return records.map((record) => record[field]).filter(Boolean).sort((left, right) => String(right).length - String(left).length)[0] || '';
}

export function mergeSchoolSources({ schools = [], stakeholders = [] } = {}) {
  let records = [
    ...schools.map((record) => normalizeRecord(record, 'escolas')),
    ...stakeholders.filter((record) => fold(record.categoria).includes('escola')).map((record) => normalizeRecord(record, 'stakeholders')),
  ];
  const hasFederalNetwork = records.some((record) => /^rede federal de educacao profissional cientifica e tecnologica\b/.test(fold(record.nome)) || /^rede federal de ept\b/.test(fold(record.nome)));
  if (hasFederalNetwork) {
    records = records.filter((record) => !/^cefet(?: mg| rj)\b/.test(fold(record.nome)));
  }
  const groups = new Map();
  for (const record of records) {
    const key = matchKey(record);
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups.values()].map(mergeGroup).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function normalizeSchoolName(value) {
  return fold(value);
}
