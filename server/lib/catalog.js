import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };
import { canonicalizeResearchers, resolveResearcherId } from '../../src/domain/researcherCatalog.js';
import { mergeSchoolSources } from '../../src/domain/schoolCatalog.js';
import { getImportedRecords } from './catalogImport.js';

export function getResearcherAliases() {
  return canonicalizeResearchers(getCatalog('researcher')).aliases;
}

export function resolveCatalogResearcher(id) {
  return resolveResearcherId(getCatalog('researcher'), id);
}

export function getCatalog(category) {
  const imported = getImportedRecords(category);
  if (category === 'researcher') return canonicalizeResearchers([...pesquisadores, ...imported]).records;
  if (category === 'school') return mergeSchoolSources({ schools: [...escolas, ...imported], stakeholders });
  if (category === 'organization') return [...stakeholders, ...imported];
  return [];
}
