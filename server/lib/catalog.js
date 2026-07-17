import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };
import { canonicalizeResearchers, resolveResearcherId } from '../../src/domain/researcherCatalog.js';
import { mergeSchoolSources } from '../../src/domain/schoolCatalog.js';

const researcherCatalog = canonicalizeResearchers(pesquisadores);
const canonicalResearchers = researcherCatalog.records;

export function getResearcherAliases() {
  return researcherCatalog.aliases;
}

export function resolveCatalogResearcher(id) {
  return resolveResearcherId(canonicalResearchers, id);
}

export function getCatalog(category) {
  if (category === 'researcher') return canonicalResearchers;
  if (category === 'school') return mergeSchoolSources({ schools: escolas, stakeholders });
  if (category === 'organization') return stakeholders;
  return [];
}
