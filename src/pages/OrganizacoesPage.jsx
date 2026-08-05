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
  describeActiveFilters,
  matchesFacet,
  matchesQuery,
  sortItems,
} from '../domain/catalogFilters';
import { formatInstitutionName } from '../domain/institutionName';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const SEARCH_FIELDS = ['nome', 'aliases', 'descricao', 'pais', 'categoria'];

const STATE_SCHEMA = Object.freeze({
  q: { type: 'text', default: '' },
  pais: { type: 'list' },
  tipo: { type: 'list' },
  parceria: { type: 'single', default: '' },
  ordem: { type: 'single', default: 'relevance' },
  exibir: { type: 'single', default: 'grid' },
});

const NATURE_LABELS = Object.freeze({
  Empresa: 'Empresas privadas',
  'Pública': 'Públicas',
  PPP: 'Público-privadas',
  'Terceiro setor': 'Terceiro setor',
});

/**
 * Os rótulos acima são de filtro e por isso vão no plural ("Empresas
 * privadas"). No cartão de um registro só, o plural soa errado — daí o par
 * singular.
 */
const NATURE_SINGULAR = Object.freeze({
  Empresa: 'Empresa privada',
  'Pública': 'Organização pública',
  PPP: 'Parceria público-privada',
  'Terceiro setor': 'Terceiro setor',
});

const FILTER_DEFINITIONS = [
  { key: 'pais', label: 'País' },
  { key: 'tipo', label: 'Natureza', format: (value) => NATURE_LABELS[value] || value },
  { key: 'parceria', label: 'Relação', emptyValue: '', format: () => 'com parceria SENAI' },
];

export default function OrganizacoesPage() {
  const { stakeholders } = useData();
  const { state, setValue, removeValue, clear } = useCatalogState(STATE_SCHEMA);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);

  const allOrgs = useMemo(
    () =>
      stakeholders
        .filter((item) => item.categoria !== 'Escola')
        .map((item) => ({
          id: `s-${item.id}`,
          nome: item.nome,
          descricao: item.diferencial,
          pais: item.pais,
          website: item.website,
          categoria: item.categoria || 'Pública/PPP',
          natureza:
            item.categoria === 'Pública/PPP'
              ? (item.natureza === 'PPP' ? 'PPP' : 'Pública')
              : (item.categoria || 'Pública'),
          hasPartnership: Boolean(item.relacao && item.relacao.includes('✅')),
          _type: 'stakeholder',
          _original: item,
        })),
    [stakeholders],
  );

  const countries = useMemo(() => collectFacetValues(allOrgs, 'pais'), [allOrgs]);

  const filtered = useMemo(() => {
    const matched = allOrgs.filter(
      (item) =>
        matchesQuery(item, state.q, SEARCH_FIELDS) &&
        matchesFacet(item.pais, state.pais) &&
        matchesFacet(item.natureza, state.tipo) &&
        (state.parceria !== 'sim' || item.hasPartnership),
    );
    return sortItems(matched, state.ordem);
  }, [allOrgs, state.q, state.pais, state.tipo, state.parceria, state.ordem]);

  const activeChips = describeActiveFilters(
    { query: state.q, pais: state.pais, tipo: state.tipo, parceria: state.parceria },
    FILTER_DEFINITIONS,
  );

  const removeChip = (chip) => (chip.group === 'query' ? setValue('q', '') : removeValue(chip.group, chip.value));

  return (
    <>
      <CatalogShell
        eyebrow="CATÁLOGO"
        title="Outras organizações"
        description="Empresas, órgãos públicos, associações, fundações e redes com atuação relevante para a indústria e a educação profissional."
        noun={{ singular: 'organização', plural: 'organizações' }}
        total={allOrgs.length}
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
            placeholder="Buscar por nome, país ou diferencial"
            expanded={expanded}
            onToggleExpanded={() => setExpanded((current) => !current)}
            activeChips={activeChips}
            onRemoveChip={removeChip}
            onClearAll={clear}
            facets={[
              { key: 'pais', label: 'País / região', options: countries, value: state.pais, onChange: (next) => setValue('pais', next) },
            ]}
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700 }}>Natureza</Typography>
              {Object.entries(NATURE_LABELS).map(([value, label]) => {
                const active = state.tipo.includes(value);
                return (
                  <Chip
                    key={value}
                    label={label}
                    size="small"
                    variant={active ? 'filled' : 'outlined'}
                    aria-pressed={active}
                    onClick={() =>
                      setValue('tipo', active ? state.tipo.filter((entry) => entry !== value) : [...state.tipo, value])
                    }
                    sx={active ? { bgcolor: T.tools.catalog.main, color: '#fff' } : undefined}
                  />
                );
              })}
              {/* Vira ficha como os demais filtros. Antes era um interruptor
                  isolado no meio das fichas — dois idiomas de controle para o
                  mesmo tipo de decisão, na mesma linha. */}
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
            eyebrow={NATURE_SINGULAR[item.natureza] || 'Organização'}
            title={formatInstitutionName(item.nome)}
            summary={item.descricao}
            flags={item.hasPartnership ? ['partnership'] : []}
            link={item.website ? { href: item.website, label: 'Abrir site oficial' } : undefined}
            onClick={() => setSelected(item)}
          />
        )}
      />
      <DetailModal open={Boolean(selected)} onClose={() => setSelected(null)} item={selected?._original} type={selected?._type} />
    </>
  );
}
