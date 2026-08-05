import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { getSiblingLinks } from '../../app/navigation';
import EmptyState from '../../design-system/primitives/EmptyState';
import PageContainer from '../../design-system/primitives/PageContainer';
import PageHeader from '../../design-system/primitives/PageHeader';
import { DESIGN_TOKENS as T } from '../../design-system/tokens';
import ResultsToolbar from './ResultsToolbar';

/** Quantos cartões entram de cada vez. */
const PAGE_SIZE = 36;

/**
 * Estrutura comum às três listas do catálogo.
 *
 * O que ela resolve, além de acabar com três telas parecidas mas não iguais:
 *
 * - **Trocar de categoria virou um clique.** As abas no topo levam direto de
 *   Especialistas para Instituições. O caminho antigo era voltar ao catálogo,
 *   achar o cartão certo e entrar de novo — três telas para trocar de aba.
 * - **A lista deixou de renderizar tudo de uma vez.** Especialistas monta 322
 *   cartões no primeiro render, cada um com fichas e bandeira; o custo aparece
 *   como travada ao digitar, porque cada tecla remonta a lista inteira. Agora
 *   entram 36 por vez, com um botão que diz quantos faltam.
 * - **O vazio explica a causa.** Quando o filtro é que esvaziou a lista, a
 *   saída oferecida é limpar o filtro, não "tente ajustar os filtros".
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
  filterBar,
  renderItem,
  hasActiveFilters,
  onClearFilters,
  emptyIcon,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const siblings = getSiblingLinks(location.pathname);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Filtrar precisa voltar ao topo da lista. Sem isto, quem já tinha carregado
  // 200 cartões e digita uma busca continua vendo 200 slots de uma lista que
  // agora tem 4 resultados.
  useEffect(() => { setLimit(PAGE_SIZE); }, [items]);

  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;

  return (
    <PageContainer width="wide" tool="catalog">
      <PageHeader eyebrow={eyebrow} title={title} description={description} accent="catalog" dense />

      {siblings.length > 0 && (
        <Box sx={{ mt: 2.5, borderBottom: `1px solid ${T.border.subtle}` }}>
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

      <Box sx={{ mt: 2.5 }}>{filterBar}</Box>

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
                // Na lista compacta cada item ocupa a largura inteira; na grade
                // são três colunas em telas largas.
                size={view === 'list' ? 12 : { xs: 12, sm: 6, lg: 4 }}
              >
                {renderItem(item)}
              </Grid>
            ))}
          </Grid>

          {remaining > 0 && (
            <Stack alignItems="center" sx={{ mt: 3.5 }} gap={1}>
              <Button variant="outlined" size="large" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                Mostrar mais
              </Button>
            </Stack>
          )}
        </>
      )}
    </PageContainer>
  );
}
