import React, { useMemo, useState } from 'react';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
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
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';
import { ORGANIZATION_SUBTYPES } from '../domain/catalogTaxonomy';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const SEARCH_FIELDS = ['nome', 'aliases', 'descricao', 'pais', 'subtipo', 'natureza', 'setor', 'atuacao', 'areas'];

const STATE_SCHEMA = Object.freeze({
  q: { type: 'text', default: '' },
  pais: { type: 'list' },
  subtipo: { type: 'list' },
  area: { type: 'list' },
  parceria: { type: 'single', default: '' },
  ordem: { type: 'single', default: 'relevance' },
  exibir: { type: 'single', default: 'grid' },
});

const FILTER_DEFINITIONS = [
  { key: 'pais', label: 'País' },
  { key: 'subtipo', label: 'Subtipo' },
  { key: 'area', label: 'Área' },
  { key: 'parceria', label: 'Relação', emptyValue: '', format: () => 'com parceria SENAI' },
];

function tags(value) {
  return (Array.isArray(value) ? value : String(value || '').split(';'))
    .map((entry) => String(entry).replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

export default function OrganizacoesPage() {
  const { stakeholders, escolas } = useData();
  const { state, setValue, removeValue, clear } = useCatalogState(STATE_SCHEMA);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);

  const legalEntities = useMemo(
    () => buildLegalEntityCatalog({ schools: escolas, stakeholders }),
    [escolas, stakeholders],
  );
  const countries = useMemo(() => collectFacetValues(legalEntities, 'pais'), [legalEntities]);
  const areas = useMemo(() => collectTokenValues(legalEntities, 'areas'), [legalEntities]);
  const subtypes = useMemo(() => {
    const available = collectFacetValues(legalEntities, 'subtipo');
    const ordered = ORGANIZATION_SUBTYPES.filter((subtype) => available.includes(subtype));
    return [...ordered, ...available.filter((subtype) => !ordered.includes(subtype))];
  }, [legalEntities]);

  const filtered = useMemo(() => {
    const matched = legalEntities.filter(
      (item) =>
        matchesQuery(item, state.q, SEARCH_FIELDS) &&
        matchesFacet(item.pais, state.pais) &&
        matchesFacet(item.subtipo, state.subtipo) &&
        matchesTokenizedFacet(item.areas, state.area) &&
        (state.parceria !== 'sim' || item.hasPartnership),
    );
    return sortItems(matched, state.ordem);
  }, [legalEntities, state.q, state.pais, state.subtipo, state.area, state.parceria, state.ordem]);

  const activeChips = describeActiveFilters(
    { query: state.q, pais: state.pais, subtipo: state.subtipo, area: state.area, parceria: state.parceria },
    FILTER_DEFINITIONS,
  );

  const removeChip = (chip) => (chip.group === 'query' ? setValue('q', '') : removeValue(chip.group, chip.value));

  return (
    <>
      <CatalogShell
        eyebrow="CATÁLOGO"
        title="Pessoas Jurídicas"
        description="Empresas, órgãos públicos, instituições de ensino, entidades setoriais, fundações e outras organizações relevantes para o SENAI-SP."
        noun={{ singular: 'pessoa jurídica', plural: 'pessoas jurídicas' }}
        total={legalEntities.length}
        items={filtered}
        sort={state.ordem}
        onSortChange={(value) => setValue('ordem', value)}
        view={state.exibir}
        onViewChange={(value) => setValue('exibir', value)}
        hasActiveFilters={activeChips.length > 0}
        onClearFilters={clear}
        emptyIcon={<BusinessOutlinedIcon />}
        filterBar={
          <FilterBar
            query={state.q}
            onQueryChange={(value) => setValue('q', value)}
            placeholder="Buscar por nome, subtipo, país, área ou atuação"
            expanded={expanded}
            onToggleExpanded={() => setExpanded((current) => !current)}
            activeChips={activeChips}
            onRemoveChip={removeChip}
            onClearAll={clear}
            facets={[
              { key: 'subtipo', label: 'Subtipo', options: subtypes, value: state.subtipo, onChange: (next) => setValue('subtipo', next) },
              { key: 'pais', label: 'País / região', options: countries, value: state.pais, onChange: (next) => setValue('pais', next) },
              { key: 'area', label: 'Área', options: areas, value: state.area, onChange: (next) => setValue('area', next) },
            ]}
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700 }}>Relação</Typography>
              <Chip
                label="Com parceria SENAI"
                size="small"
                variant={state.parceria === 'sim' ? 'filled' : 'outlined'}
                aria-pressed={state.parceria === 'sim'}
                onClick={() => setValue('parceria', state.parceria === 'sim' ? '' : 'sim')}
                sx={state.parceria === 'sim' ? { bgcolor: T.feedback.success, color: '#fff' } : undefined}
              />
            </Stack>
          </FilterBar>
        }
        renderItem={(item) => (
          <EntityCard
            item={item}
            view={state.exibir}
            accent="catalog"
            eyebrow={item.subtipo || 'Pessoa Jurídica'}
            title={formatInstitutionName(item.nome)}
            summary={item.descricao}
            tags={tags(item.areas).slice(0, 5)}
            flags={item.hasPartnership ? ['partnership'] : []}
            link={item.website ? { href: item.website, label: 'Abrir site oficial' } : undefined}
            onClick={() => setSelected(item)}
          />
        )}
      />
      <DetailModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        item={selected?._original || selected}
        type={selected?.subtipo === ORGANIZATION_SUBTYPES[0] ? 'escola' : (selected?._type || 'stakeholder')}
      />
    </>
  );
}
