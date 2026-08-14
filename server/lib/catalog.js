import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };
import { canonicalizeResearchers, resolveResearcherId } from '../../src/domain/researcherCatalog.js';
import { buildLegalEntityCatalog } from '../../src/domain/legalEntityCatalog.js';
import { normalizeCatalogRequest, withCatalogClassification } from '../../src/domain/catalogTaxonomy.js';
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
  const { category: normalizedCategory, subtype } = normalizeCatalogRequest(category);
  const imported = getImportedRecords(normalizedCategory);
  if (normalizedCategory === 'person') return canonicalizeResearchers([
    ...pesquisadores.map((person) => withCatalogClassification({ ...person, perfis_atuacao: person.perfis_atuacao || ['pesquisa'] }, 'person')),
    ...imported.map((person) => withCatalogClassification(person, 'person')),
  ]).records;
  if (normalizedCategory === 'organization') {
    const records = applyOverlays(buildLegalEntityCatalog({ schools: escolas, stakeholders: [...stakeholders, ...imported] }));
    return subtype ? records.filter((record) => record.subtipo === subtype) : records;
  }
  return [];
}
