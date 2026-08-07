import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };
import { canonicalizeResearchers, resolveResearcherId } from '../../src/domain/researcherCatalog.js';
import { mergeSchoolSources } from '../../src/domain/schoolCatalog.js';
import { getImportedRecords } from './catalogImport.js';

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
  if (normalizedCategory === 'organization') return [...stakeholders, ...imported];
  return [];
}
