import React, { useMemo, useState } from 'react';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
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
import { CATEGORIAS, getCategoriasFromAreas } from '../utils/areaCategories';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const SEARCH_FIELDS = ['nome', 'aliases', 'instituicao', 'cargo', 'areas', 'perfis_atuacao', 'pais', 'pesquisa', 'miniBio', 'producoes_relevantes'];

/** Estado que vive na URL, para uma lista filtrada poder ser compartilhada. */
const STATE_SCHEMA = Object.freeze({
  q: { type: 'text', default: '' },
  pais: { type: 'list' },
  area: { type: 'list' },
  tema: { type: 'list' },
  atuacao: { type: 'list' },
  genero: { type: 'single', default: 'todos' },
  ordem: { type: 'single', default: 'relevance' },
  exibir: { type: 'single', default: 'grid' },
});

const FILTER_DEFINITIONS = [
  { key: 'pais', label: 'País' },
  { key: 'area', label: 'Área' },
  { key: 'tema', label: 'Tema' },
  { key: 'atuacao', label: 'Atuação' },
  { key: 'genero', label: 'Gênero', emptyValue: 'todos', format: (value) => (value === 'F' ? 'Feminino' : 'Masculino') },
];

const GENDER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'F', label: 'Feminino' },
  { value: 'M', label: 'Masculino' },
];

const PROFILE_LABELS = {
  scholar: 'Google Scholar',
  lattes: 'Lattes / CNPq',
  orcid: 'ORCID',
  researchgate: 'ResearchGate',
  academia: 'Academia.edu',
};

function summarize(text, maxSentences = 2) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, maxSentences).join(' ').trim();
}

function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function profileLink(item) {
  const href = item.perfil_principal_url || item.linkedin_url || item.scholar;
  if (!isHttpUrl(href)) return undefined;
  return { href, label: href === item.linkedin_url ? 'LinkedIn' : PROFILE_LABELS[item.profileType] || 'Perfil público' };
}

export default function PesquisadoresPage() {
  const { pesquisadores } = useData();
  const { state, setValue, removeValue, clear } = useCatalogState(STATE_SCHEMA);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);

  const countries = useMemo(() => collectFacetValues(pesquisadores, 'pais'), [pesquisadores]);
  const themes = useMemo(() => collectTokenValues(pesquisadores, 'areas'), [pesquisadores]);
  const profiles = useMemo(() => collectTokenValues(pesquisadores, 'perfis_atuacao'), [pesquisadores]);

  const filtered = useMemo(() => {
    const matched = pesquisadores.filter(
      (item) =>
        matchesQuery(item, state.q, SEARCH_FIELDS) &&
        matchesFacet(item.pais, state.pais) &&
        // As categorias são derivadas do campo livre `areas`; comparar contra a
        // derivação é o que mantém o filtro coerente com a ficha exibida no
        // cartão. Comparar contra o texto cru deixava as duas coisas diferentes.
        matchesFacet(getCategoriasFromAreas(item.areas), state.area) &&
        matchesTokenizedFacet(item.areas, state.tema) &&
        matchesTokenizedFacet(item.perfis_atuacao, state.atuacao) &&
        (state.genero === 'todos' || item.genero === state.genero),
    );
    return sortItems(matched, state.ordem);
  }, [pesquisadores, state.q, state.pais, state.area, state.tema, state.atuacao, state.genero, state.ordem]);

  const activeChips = describeActiveFilters(
    { query: state.q, pais: state.pais, area: state.area, tema: state.tema, atuacao: state.atuacao, genero: state.genero },
    FILTER_DEFINITIONS,
  );

  const removeChip = (chip) => (chip.group === 'query' ? setValue('q', '') : removeValue(chip.group, chip.value));

  return (
    <>
      <CatalogShell
        eyebrow="CATÁLOGO"
        title="Pessoas especialistas"
        description="Profissionais da pesquisa, indústria, educação, imprensa e gestão pública com experiência relevante para o SENAI-SP."
        noun={{ singular: 'especialista', plural: 'especialistas' }}
        total={pesquisadores.length}
        items={filtered}
        sort={state.ordem}
        onSortChange={(value) => setValue('ordem', value)}
        view={state.exibir}
        onViewChange={(value) => setValue('exibir', value)}
        hasActiveFilters={activeChips.length > 0}
        onClearFilters={clear}
        emptyIcon={<ScienceOutlinedIcon />}
        filterBar={
          <FilterBar
            query={state.q}
            onQueryChange={(value) => setValue('q', value)}
            placeholder="Buscar por nome, cargo, instituição, atuação ou tema"
            expanded={expanded}
            onToggleExpanded={() => setExpanded((current) => !current)}
            activeChips={activeChips}
            onRemoveChip={removeChip}
            onClearAll={clear}
            facets={[
              { key: 'pais', label: 'País', options: countries, value: state.pais, onChange: (next) => setValue('pais', next) },
              { key: 'area', label: 'Área de atuação', options: CATEGORIAS, value: state.area, onChange: (next) => setValue('area', next) },
              { key: 'tema', label: 'Tema', options: themes, value: state.tema, onChange: (next) => setValue('tema', next) },
              { key: 'atuacao', label: 'Atuação', options: profiles, value: state.atuacao, onChange: (next) => setValue('atuacao', next) },
            ]}
          >
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" sx={{ color: T.ink.muted, fontWeight: 700 }}>Gênero</Typography>
              {GENDER_OPTIONS.map((option) => {
                const active = state.genero === option.value;
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    size="small"
                    variant={active ? 'filled' : 'outlined'}
                    onClick={() => setValue('genero', option.value)}
                    // O estado selecionado não pode ser só a cor de fundo: quem
                    // não distingue as cores precisa do `aria-pressed`.
                    aria-pressed={active}
                    sx={active ? { bgcolor: T.tools.catalog.main, color: '#fff' } : undefined}
                  />
                );
              })}
            </Stack>
          </FilterBar>
        }
        renderItem={(item) => (
          <EntityCard
            item={item}
            view={state.exibir}
            accent="catalog"
            eyebrow={(item.perfis_atuacao || [])[0] || 'Especialista'}
            title={item.nome}
            subtitle={[item.cargo, item.instituicao].filter(Boolean).join(' · ')}
            summary={item.miniBio || summarize(item.pesquisa)}
            tags={getCategoriasFromAreas(item.areas)}
            badge={item.h_index ? `h-index ${item.h_index}` : undefined}
            link={profileLink(item)}
            onClick={() => setSelected(item)}
          />
        )}
      />
      <DetailModal open={Boolean(selected)} onClose={() => setSelected(null)} item={selected} type="person" />
    </>
  );
}
