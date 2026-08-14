import { withCatalogClassification } from './catalogTaxonomy.js';
import { mergeSchoolSources } from './schoolCatalog.js';

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function websiteHost(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function leadName(value) {
  return fold(String(value || '').split(/[—(/\[]/)[0]);
}

function sameOrganization(left, right) {
  if (fold(left.nome) && fold(left.nome) === fold(right.nome) && fold(left.pais) === fold(right.pais)) return true;
  const leftHost = websiteHost(left.website);
  const rightHost = websiteHost(right.website);
  if (!leftHost || leftHost !== rightHost) return false;
  const leftLead = leadName(left.nome);
  const rightLead = leadName(right.nome);
  const shorter = leftLead.length <= rightLead.length ? leftLead : rightLead;
  const longer = leftLead.length > rightLead.length ? leftLead : rightLead;
  return Boolean(shorter.length >= 4 && (leftLead === rightLead || (shorter.length >= 8 && longer.startsWith(`${shorter} `))));
}

function isEducationRecord(record) {
  return fold(record?.categoria).includes('escola')
    || fold(record?.subtipo).includes('instituicao de ensino');
}

function relationIsPartnership(value) {
  const relation = String(value || '');
  return /^(?:✅|🔗)\s*|^sim\b.*\bparcer|^parceiro\s+(?:de projetos|irm[aã]o)\b/i.test(relation)
    && !/sem registro|sem evid[eê]ncia|nenhuma parceria|n[aã]o encontrei|n[aã]o identifiquei|sem parceria|potencial/i.test(relation);
}

function organizationRecord(record) {
  return withCatalogClassification({
    ...record,
    nome: record.nome || record.instituicao || '',
    descricao: record.descricao || record.diferencial || record.relevancia || '',
    website: record.website || record.website_oficial || '',
    hasPartnership: record.hasPartnership ?? relationIsPartnership(record.relacao || record.relacao_publica),
    _type: record._type || 'stakeholder',
    _original: record._original || record,
  }, 'organization');
}

function identity(record) {
  if (record.catalogIdentity) return record.catalogIdentity;
  if (record.id !== undefined && record.id !== null) return `id:${String(record.id)}`;
  return `name:${fold(record.nome)}|country:${fold(record.pais)}`;
}

export function buildLegalEntityCatalog({ schools = [], stakeholders = [] } = {}) {
  const education = mergeSchoolSources({ schools, stakeholders });
  const organizations = stakeholders.filter((record) => !isEducationRecord(record)).map(organizationRecord);
  const records = [];
  const indexes = new Map();
  for (const record of [...education, ...organizations]) {
    const key = identity(record);
    const index = indexes.get(key) ?? records.findIndex((existing) => sameOrganization(existing, record));
    if (index === undefined) {
      indexes.set(key, records.length);
      records.push(record);
    } else if (index < 0) {
      indexes.set(key, records.length);
      records.push(record);
    } else {
      const previous = records[index];
      records[index] = {
        ...previous,
        ...record,
        subtipo: previous.subtipo,
        hasPartnership: Boolean(previous.hasPartnership || record.hasPartnership),
        aliases: [...new Set([...(previous.aliases || []), ...(record.aliases || []), previous.nome, record.nome].filter(Boolean))],
        sourceRecords: [...(previous.sourceRecords || []), ...(record.sourceRecords || [])],
      };
      indexes.set(key, index);
    }
  }
  return records.sort((left, right) => String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-BR'));
}
