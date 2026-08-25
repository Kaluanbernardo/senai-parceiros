import React, { useMemo } from 'react';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CatalogShell from '../components/catalog/CatalogShell';
import DetailPanel from '../components/catalog/DetailPanel';
import EntityCard from '../components/catalog/EntityCard';
import { useCatalogState } from '../app/useCatalogState';
import { useData } from '../context/DataContext';
import { resolveCatalogSelection } from '../domain/catalogSelection';
import {
  collectFacetValues,
  describeActiveFilters,
  matchesFacet,
  matchesQuery,
  sortItems,
} from '../domain/catalogFilters';
import { CATEGORIAS, getMacroThemesFromAreas } from '../utils/areaCategories';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { PERSON_SUBTYPES } from '../domain/catalogTaxonomy';

const SEARCH_FIELDS = ['nome', 'aliases', 'subtipo', 'instituicao', 'cargo', 'areas', 'pais', 'pesquisa', 'miniBio', 'producoes_relevantes'];

/** Estado que vive na URL, para uma lista filtrada poder ser compartilhada. */
const STATE_SCHEMA = Object.freeze({
  q: { type: 'text', default: '' },
  pais: { type: 'list' },
  tema: { type: 'list' },
  subtipo: { type: 'list' },
  genero: { type: 'single', default: 'todos' },
  ordem: { type: 'single', default: 'relevance' },
  exibir: { type: 'single', default: 'grid' },
  // O registro aberto entra na URL junto dos filtros. Sem isto dava para
  // compartilhar uma lista filtrada e não dava para compartilhar uma pessoa,
  // e o "voltar" do navegador saía da lista em vez de fechar a ficha.
  perfil: { type: 'text', default: '' },
});

const FILTER_DEFINITIONS = [
  { key: 'pais', label: 'País' },
  { key: 'tema', label: 'Temas de especialidade' },
  { key: 'subtipo', label: 'Perfil profissional' },
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

  const countries = useMemo(() => collectFacetValues(pesquisadores, 'pais'), [pesquisadores]);
  const themes = useMemo(() => [...new Set(pesquisadores.flatMap((item) => getMacroThemesFromAreas(item.areas)))].sort((a, b) => {
    const order = (theme) => {
      const index = CATEGORIAS.indexOf(theme);
      return index === -1 ? CATEGORIAS.length : index;
    };
    return order(a) - order(b) || a.localeCompare(b, 'pt-BR');
  }), [pesquisadores]);

  const filtered = useMemo(() => {
    const matched = pesquisadores.filter(
      (item) =>
        matchesQuery(item, state.q, SEARCH_FIELDS) &&
        matchesFacet(item.pais, state.pais) &&
        matchesFacet(getMacroThemesFromAreas(item.areas), state.tema) &&
        matchesFacet(item.subtipo, state.subtipo) &&
        (state.genero === 'todos' || item.genero === state.genero),
    );
    return sortItems(matched, state.ordem);
  }, [pesquisadores, state.q, state.pais, state.tema, state.subtipo, state.genero, state.ordem]);

  const activeChips = describeActiveFilters(
    { query: state.q, pais: state.pais, tema: state.tema, subtipo: state.subtipo, genero: state.genero },
    FILTER_DEFINITIONS,
  );

  const removeChip = (chip) => (chip.group === 'query' ? setValue('q', '') : removeValue(chip.group, chip.value));

  const selection = resolveCatalogSelection(filtered, pesquisadores, state.perfil);

  return (
    <>
      <CatalogShell
        eyebrow="CATÁLOGO"
        title="Pessoas Físicas"
        description="Profissionais, pesquisadores, personalidades públicas, agentes públicos e outras pessoas relevantes para o SENAI-SP."
        noun={{ singular: 'pessoa', plural: 'pessoas' }}
        total={pesquisadores.length}
        items={filtered}
        sort={state.ordem}
        onSortChange={(value) => setValue('ordem', value)}
        view={state.exibir}
        onViewChange={(value) => setValue('exibir', value)}
        onClearFilters={clear}
        emptyIcon={<ScienceOutlinedIcon />}
        query={state.q}
        onQueryChange={(value) => setValue('q', value)}
        searchPlaceholder="Buscar por nome, perfil, cargo, instituição ou tema"
        activeChips={activeChips}
        onRemoveChip={removeChip}
        facets={[
          { key: 'subtipo', label: 'Perfil profissional', options: PERSON_SUBTYPES, value: state.subtipo, onChange: (next) => setValue('subtipo', next) },
          { key: 'pais', label: 'País', options: countries, value: state.pais, onChange: (next) => setValue('pais', next) },
          {
            key: 'tema',
            label: 'Temas de especialidade',
            options: themes,
            value: state.tema,
            onChange: (next) => setValue('tema', next),
          },
        ]}
        filterExtras={
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
        }
        renderItem={(item) => (
          <EntityCard
            item={item}
            view={state.exibir}
            accent="catalog"
            eyebrow={item.subtipo || 'Pessoa Física'}
            title={item.nome}
            subtitle={[item.cargo, item.instituicao].filter(Boolean).join(' · ')}
            summary={item.miniBio || summarize(item.pesquisa)}
            tags={getMacroThemesFromAreas(item.areas)}
            badge={item.h_index ? `h-index ${item.h_index}` : undefined}
            link={profileLink(item)}
            onClick={() => setValue('perfil', String(item.id))}
          />
        )}
      />
      <DetailPanel
        item={selection.item}
        type="person"
        onClose={() => setValue('perfil', '')}
        position={{ index: selection.index, total: selection.total }}
        onPrevious={() => selection.previousId && setValue('perfil', selection.previousId)}
        onNext={() => selection.nextId && setValue('perfil', selection.nextId)}
      />
    </>
  );
}
