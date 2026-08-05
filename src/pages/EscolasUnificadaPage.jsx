import React, { useMemo, useState } from 'react';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import CatalogShell from '../components/catalog/CatalogShell';
import EntityCard from '../components/catalog/EntityCard';
import FilterBar from '../components/catalog/FilterBar';
import DetailModal from '../components/DetailModal';
import { useCatalogState } from '../app/useCatalogState';
import { useData } from '../context/DataContext';
import {
  collectFacetValues,
  collectTokenValues,
  describeActiveFilters,
  matchesFacet,
  matchesQuery,
  matchesTokenizedFacet,
  sortItems,
} from '../domain/catalogFilters';
import { formatInstitutionName } from '../domain/institutionName';
import { mergeSchoolSources } from '../domain/schoolCatalog';

const SEARCH_FIELDS = ['nome', 'aliases', 'descricao', 'areas', 'pais'];

const STATE_SCHEMA = Object.freeze({
  q: { type: 'text', default: '' },
  pais: { type: 'list' },
  area: { type: 'list' },
  ordem: { type: 'single', default: 'relevance' },
  exibir: { type: 'single', default: 'grid' },
});

const FILTER_DEFINITIONS = [
  { key: 'pais', label: 'País' },
  { key: 'area', label: 'Área' },
];

/** Fichas de área do cartão, sem o que vem entre parênteses. */
function areaTags(areas) {
  if (!areas) return [];
  return areas
    .split(';')
    .map((entry) => entry.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

export default function EscolasUnificadaPage() {
  const { stakeholders, escolas } = useData();
  const { state, setValue, removeValue, clear } = useCatalogState(STATE_SCHEMA);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);

  const allSchools = useMemo(
    () => mergeSchoolSources({ schools: escolas, stakeholders }),
    [escolas, stakeholders],
  );

  const countries = useMemo(() => collectFacetValues(allSchools, 'pais'), [allSchools]);
  // As opções de área saem dos dados, não de uma lista fixa escrita à mão. A
  // anterior trazia onze rótulos decididos no código, e áreas que existiam na
  // base — mas não na lista — eram infiltráveis.
  const areas = useMemo(() => collectTokenValues(allSchools, 'areas'), [allSchools]);

  const filtered = useMemo(() => {
    const matched = allSchools.filter(
      (item) =>
        matchesQuery(item, state.q, SEARCH_FIELDS) &&
        matchesFacet(item.pais, state.pais) &&
        matchesTokenizedFacet(item.areas, state.area),
    );
    return sortItems(matched, state.ordem);
  }, [allSchools, state.q, state.pais, state.area, state.ordem]);

  const activeChips = describeActiveFilters(
    { query: state.q, pais: state.pais, area: state.area },
    FILTER_DEFINITIONS,
  );

  const removeChip = (chip) => (chip.group === 'query' ? setValue('q', '') : removeValue(chip.group, chip.value));

  return (
    <>
      <CatalogShell
        eyebrow="CATÁLOGO"
        title="Instituições de Educação"
        description="Escolas, centros de formação e redes de educação profissional, no Brasil e no exterior."
        noun={{ singular: 'instituição', plural: 'instituições' }}
        total={allSchools.length}
        items={filtered}
        sort={state.ordem}
        onSortChange={(value) => setValue('ordem', value)}
        view={state.exibir}
        onViewChange={(value) => setValue('exibir', value)}
        hasActiveFilters={activeChips.length > 0}
        onClearFilters={clear}
        emptyIcon={<SchoolOutlinedIcon />}
        filterBar={
          <FilterBar
            query={state.q}
            onQueryChange={(value) => setValue('q', value)}
            placeholder="Buscar por nome, país ou área de formação"
            expanded={expanded}
            onToggleExpanded={() => setExpanded((current) => !current)}
            activeChips={activeChips}
            onRemoveChip={removeChip}
            onClearAll={clear}
            facets={[
              { key: 'pais', label: 'País', options: countries, value: state.pais, onChange: (next) => setValue('pais', next) },
              { key: 'area', label: 'Área de formação', options: areas, value: state.area, onChange: (next) => setValue('area', next) },
            ]}
          />
        }
        renderItem={(item) => (
          <EntityCard
            item={item}
            view={state.exibir}
            accent="catalog"
            eyebrow="Instituição de educação"
            title={formatInstitutionName(item.nome)}
            summary={item.descricao}
            tags={areaTags(item.areas)}
            flags={item.hasPartnership ? ['partnership'] : []}
            link={item.website ? { href: item.website, label: 'Abrir site oficial' } : undefined}
            onClick={() => setSelected(item)}
          />
        )}
      />
      <DetailModal open={Boolean(selected)} onClose={() => setSelected(null)} item={selected?._original} type="escola" />
    </>
  );
}
