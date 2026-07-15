import pesquisadores from '../../src/data/pesquisadores.json' with { type: 'json' };
import escolas from '../../src/data/escolas.json' with { type: 'json' };
import stakeholders from '../../src/data/stakeholders.json' with { type: 'json' };

export function getCatalog(category) {
  if (category === 'researcher') return pesquisadores;
  if (category === 'school') return escolas;
  if (category === 'organization') return stakeholders;
  return [];
}
