import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };
import { canonicalizeResearchers, resolveResearcherId } from '../../src/domain/researcherCatalog.js';
import { mergeSchoolSources } from '../../src/domain/schoolCatalog.js';
import { getImportedRecords } from './catalogImport.js';

function overlayKey(record) {
  if (record?.id !== undefined && record?.id !== null) return `id:${String(record.id)}`;
  return `name:${String(record?.nome || record?.instituicao || '').trim().toLowerCase()}|country:${String(record?.pais || '').trim().toLowerCase()}`;
}

function applyOverlays(records) {
  const merged = [];
  const indexes = new Map();
  for (const record of records) {
    const key = overlayKey(record);
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, merged.length);
      merged.push(record);
    } else {
      merged[index] = { ...merged[index], ...record };
    }
  }
  return merged;
}

export function getResearcherAliases() {
  return canonicalizeResearchers(getCatalog('person')).aliases;
}

export function resolveCatalogResearcher(id) {
  return resolveResearcherId(getCatalog('person'), id);
}

export function getCatalog(category) {
  const normalizedCategory = category === 'researcher' ? 'person' : category;
  const imported = getImportedRecords(normalizedCategory);
  if (normalizedCategory === 'person') return canonicalizeResearchers([...pesquisadores.map((person) => ({ ...person, perfis_atuacao: person.perfis_atuacao || ['pesquisa'] })), ...imported]).records;
  if (normalizedCategory === 'school') return mergeSchoolSources({ schools: [...escolas, ...imported], stakeholders });
  if (normalizedCategory === 'organization') return applyOverlays([...stakeholders, ...imported]);
  return [];
}
