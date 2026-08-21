import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { getSiblingLinks } from '../../app/navigation';
import EmptyState from '../../design-system/primitives/EmptyState';
import PageContainer from '../../design-system/primitives/PageContainer';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';
import ResultsToolbar from './ResultsToolbar';
import { ActiveFilterChips, FilterPanel, FilterToggleButton, SearchField } from './CatalogFilters';

/** Quantos cartões entram de cada vez. */
const PAGE_SIZE = 36;

/**
 * Estrutura comum às duas naturezas do catálogo.
 *
 * O que ela resolve, além de acabar com telas parecidas mas não iguais:
 *
 * - **Os filtros ficam à vista.** No desktop as facetas ocupam uma coluna
 *   permanente. Escondidas atrás de um botão, as cinco dimensões do catálogo
 *   simplesmente não existiam para quem chegava pela primeira vez.
 * - **A contagem responde à busca.** "24 de 88 pessoas" fica ao lado da lista,
 *   junto das fichas do que está recortando — as duas perguntas que se faz
 *   depois de digitar são "achei?" e "por que não são todos?".
 * - **Trocar de natureza é um clique.** As abas no topo levam direto de Pessoas
 *   Físicas para Pessoas Jurídicas.
 * - **A lista não renderiza tudo de uma vez.** Entram 36 por vez, com um botão
 *   que diz quantos faltam.
 * - **No celular o conteúdo começa antes.** A descrição da categoria sai da
 *   primeira dobra e a busca acompanha a rolagem: com o cabeçalho inteiro
 *   empilhado, o primeiro resultado ficava abaixo dos 844px de tela.
 */
export default function CatalogShell({
  eyebrow,
  title,
  description,
  noun,
  total,
  items,
  sort,
  onSortChange,
  view,
  onViewChange,
  renderItem,
  onClearFilters,
  emptyIcon,
  query,
  onQueryChange,
  searchPlaceholder,
  facets = [],
  activeChips = [],
  onRemoveChip,
  filterExtras,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const siblings = getSiblingLinks(location.pathname);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filtrar precisa voltar ao topo da lista. Sem isto, quem já tinha carregado
  // 200 cartões e digita uma busca continua vendo 200 slots de uma lista que
  // agora tem 4 resultados.
  useEffect(() => { setLimit(PAGE_SIZE); }, [items]);

  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;
  const facetChipCount = activeChips.filter((chip) => chip.group !== 'query').length;
  const hasActiveFilters = activeChips.length > 0;

  const renderPanel = (showHeading) => (
    <FilterPanel
      facets={facets}
      onClearAll={onClearFilters}
      activeCount={facetChipCount}
      showHeading={showHeading}
    >
      {filterExtras}
    </FilterPanel>
  );

  return (
    <PageContainer width="wide" tool="catalog">
      <Box>
        <Typography variant="overline" sx={{ display: 'block', color: T.tools.catalog.dark }}>{eyebrow}</Typography>
        <Typography variant="h2" sx={{ color: T.ink.strong }}>{title}</Typography>
        {/* A descrição explica a categoria uma vez; no celular ela custava
            quatro linhas antes de qualquer resultado, e o título já diz o
            mesmo em duas palavras. */}
        {description && (
          <Typography sx={{ mt: 1, maxWidth: T.layout.prose, color: T.ink.muted, display: { xs: 'none', md: 'block' } }}>
            {description}
          </Typography>
        )}
      </Box>

      {siblings.length > 0 && (
        <Box sx={{ mt: { xs: 1.5, md: 2.5 }, borderBottom: `1px solid ${T.border.subtle}` }}>
          <Tabs
            value={location.pathname}
            onChange={(_event, route) => navigate(route)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Categorias do catálogo"
          >
            {siblings.map((sibling) => (
              <Tab key={sibling.route} value={sibling.route} label={sibling.label} />
            ))}
          </Tabs>
        </Box>
      )}

      <Grid container spacing={{ xs: 0, md: 3 }} sx={{ mt: { xs: 0, md: 1 } }} alignItems="flex-start">
        {/* Coluna de facetas. `position: sticky` mantém os filtros acessíveis
            depois de rolar cem cartões, que é quando refinar volta a ser a
            próxima coisa que se quer fazer. */}
        <Grid
          size={{ xs: 12, md: 3 }}
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'sticky',
            top: T.layout.headerHeight + 16,
            maxHeight: `calc(100vh - ${T.layout.headerHeight + 32}px)`,
            overflowY: 'auto',
            pb: 2,
          }}
        >
          {renderPanel(true)}
        </Grid>

        <Grid size={{ xs: 12, md: 9 }} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            sx={{
              // No celular a busca acompanha a rolagem: numa lista longa,
              // voltar ao topo para trocar um termo é o gesto mais repetido.
              position: { xs: 'sticky', md: 'static' },
              top: T.layout.headerHeight,
              zIndex: 2,
              bgcolor: T.surface.canvas,
              py: 1.5,
            }}
          >
            <SearchField query={query} onQueryChange={onQueryChange} placeholder={searchPlaceholder} />
            <Box sx={{ display: { md: 'none' } }}>
              <FilterToggleButton count={facetChipCount} expanded={drawerOpen} onClick={() => setDrawerOpen(true)} />
            </Box>
          </Stack>

          {hasActiveFilters && (
            <Box sx={{ pb: .5 }}>
              <ActiveFilterChips chips={activeChips} onRemoveChip={onRemoveChip} onClearAll={onClearFilters} />
            </Box>
          )}

          <ResultsToolbar
            shown={items.length}
            total={total}
            noun={noun}
            sort={sort}
            onSortChange={onSortChange}
            view={view}
            onViewChange={onViewChange}
          />

          {items.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={hasActiveFilters ? 'Nenhum resultado para esta combinação de filtros' : `Nenhum ${noun.singular} encontrado`}
              description={
                hasActiveFilters
                  ? 'Nenhum perfil atende a todos os filtros escolhidos. Remova um filtro ou tente uma busca mais ampla.'
                  : 'Ainda não há informações nesta categoria.'
              }
              action={hasActiveFilters ? onClearFilters : undefined}
              actionLabel="Limpar os filtros"
            />
          ) : (
            <>
              <Grid container spacing={view === 'list' ? 1 : 2}>
                {visible.map((item) => (
                  <Grid
                    key={item.id}
                    // Na lista compacta cada item ocupa a largura inteira; na
                    // grade são duas colunas — a coluna de filtros levou um
                    // terço da largura, e três cartões nela ficariam estreitos
                    // demais para o nome de uma instituição caber.
                    size={view === 'list' ? 12 : { xs: 12, sm: 6, xl: 4 }}
                  >
                    {renderItem(item)}
                  </Grid>
                ))}
              </Grid>

              {remaining > 0 && (
                <Stack alignItems="center" sx={{ mt: 3.5 }} gap={1}>
                  {/* O número no rótulo é o que faltava: sem ele não dá para
                      saber se falta um clique ou oito. */}
                  <Button variant="outlined" size="large" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                    Mostrar mais {Math.min(PAGE_SIZE, remaining)}
                  </Button>
                  <Typography variant="caption" sx={{ color: T.ink.subtle }}>
                    {visible.length} de {items.length} exibidos
                  </Typography>
                </Stack>
              )}
            </>
          )}
        </Grid>
      </Grid>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '85vw', sm: 380 }, p: 2 } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h5">Filtrar</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="Fechar os filtros"><CloseIcon /></IconButton>
        </Stack>
        {renderPanel(false)}
        <Button variant="contained" fullWidth sx={{ mt: 3 }} onClick={() => setDrawerOpen(false)}>
          Ver {items.length} {items.length === 1 ? noun.singular : noun.plural}
        </Button>
      </Drawer>
    </PageContainer>
  );
}
