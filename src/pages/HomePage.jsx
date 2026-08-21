import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { getNavTools, getToolById } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import PageContainer from '../design-system/primitives/PageContainer';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { BRAND_NAME } from '../design-system/brand';
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';
import { filterRadarItems } from '../domain/radar';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

/**
 * O que cada ferramenta tem dentro, quando isso é sabível sem sair da home.
 *
 * Um menu que só repete o próprio nome obriga a entrar para descobrir se vale
 * a visita — e a home era exatamente isso: cinco cartões de peso idêntico, com
 * o quinto órfão na última linha, respondendo "o que você quer fazer?" com uma
 * lista plana.
 */
function useToolMeta() {
  const { pesquisadores, stakeholders, escolas } = useData();
  const [radarCount, setRadarCount] = useState(null);

  const legalEntities = useMemo(
    () => buildLegalEntityCatalog({ schools: escolas || [], stakeholders: stakeholders || [] }),
    [escolas, stakeholders],
  );

  useEffect(() => {
    let alive = true;
    // Falhar aqui não pode custar a home: sem a contagem, o cartão do Radar
    // apenas volta a ser o que era.
    fetch('/api/radar/items', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!alive || !body) return;
        const recent = filterRadarItems(body.items || [], { period: '30d' });
        setRadarCount(recent.length);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  return {
    // Fichas curtas: o cartão tem uma coluna estreita, e uma frase inteira
    // dentro dela sai pela borda em vez de informar.
    catalog: `${(pesquisadores?.length || 0) + legalEntities.length} registros`,
    radar: radarCount === null
      ? undefined
      : radarCount === 0 ? 'nada em 30 dias' : `${radarCount} em 30 dias`,
    catalogDetail: `${pesquisadores?.length || 0} pessoas físicas e ${legalEntities.length} pessoas jurídicas.`,
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const meta = useToolMeta();
  const isAdmin = user?.role === 'admin';

  const primary = getToolById('selection');
  // Os atalhos secundários leem do mesmo registro das ferramentas; o que muda
  // é o peso que a home dá a cada um.
  const shortcuts = getNavTools(user?.role).filter((tool) => tool.id !== 'selection' && tool.id !== 'research');
  const research = getNavTools(user?.role).find((tool) => tool.id === 'research');

  return (
    <>
      {/* A faixa institucional encolheu e passou a carregar um dado. Ocupando
          350px só para repetir o nome do produto que já está na barra logo
          acima, ela empurrava a primeira decisão para fora da tela. */}
      <Box sx={{ bgcolor: T.surface.inverted, color: T.ink.onInverted }}>
        <Box sx={{ maxWidth: T.layout.wide, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
          <Typography variant="overline" sx={{ color: T.ink.onInvertedMuted }}>
            {BRAND_NAME.product}
          </Typography>
          <Typography
            component="h1"
            sx={{
              maxWidth: 920,
              fontFamily: T.fontFamily.display,
              fontSize: T.fontSize.h1,
              fontWeight: 800,
              letterSpacing: '-.03em',
              lineHeight: 1.05,
            }}
          >
            Encontre as conexões certas para cada iniciativa
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: T.layout.prose, color: T.ink.onInvertedMuted }}>
            Encontre pessoas e instituições, pesquise referências ou acompanhe novidades da educação profissional.
          </Typography>
        </Box>
      </Box>

      <PageContainer width="wide">
        <Grid container spacing={{ xs: 3, lg: 4 }} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: isAdmin ? 8 : 12 }}>
            <Typography variant="overline" sx={{ color: T.ink.muted }}>Comece por aqui</Typography>
            <Box sx={{ mt: 1 }}>
              {/* Uma ação primária, sozinha. O próprio subtítulo da página
                  antiga já recomendava este caminho para quem não sabe quem
                  procurar — e cinco cartões idênticos contradiziam o conselho. */}
              <ToolCard
                icon={getToolIcon(primary.iconKey)}
                label={primary.label}
                description={primary.description}
                themeKey={primary.themeKey}
                actionLabel={primary.actionLabel}
                onClick={() => navigate(primary.route)}
              />
            </Box>

            <Typography variant="overline" sx={{ color: T.ink.muted, display: 'block', mt: 4 }}>Ou vá direto</Typography>
            <Grid container spacing={2} alignItems="stretch" sx={{ mt: .5 }}>
              {shortcuts.map((tool) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={tool.id}>
                  <ToolCard
                    icon={getToolIcon(tool.iconKey)}
                    label={tool.label}
                    description={tool.id === 'catalog' ? meta.catalogDetail : tool.description}
                    themeKey={tool.themeKey}
                    actionLabel={tool.actionLabel}
                    meta={meta[tool.id]}
                    onClick={() => navigate(tool.route)}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* As ferramentas que escrevem no catálogo saem da mesma fileira das
              que só leem. Misturadas, os dois "pesquisar" competiam — e o
              rótulo curto da barra, "Pesquisar", é justamente o do que grava. */}
          {isAdmin && (
            <Grid size={{ xs: 12, lg: 4 }}>
              <Box sx={{ borderLeft: { lg: `1px solid ${T.border.subtle}` }, pl: { lg: 3 } }}>
                <Typography variant="overline" sx={{ color: T.ink.muted }}>Só para administradores</Typography>
                <Stack gap={2} sx={{ mt: 1 }}>
                  {research && (
                    <ToolCard
                      icon={getToolIcon(research.iconKey)}
                      label={research.label}
                      description={research.description}
                      themeKey={research.themeKey}
                      actionLabel={research.actionLabel}
                      onClick={() => navigate(research.route)}
                    />
                  )}
                  <Box sx={{ border: `1px solid ${T.border.subtle}`, borderRadius: `${T.radius.md}px`, bgcolor: T.surface.raised, p: 2.25 }}>
                    <Typography variant="h5" sx={{ color: T.ink.strong }}>Gestão de dados</Typography>
                    <Typography variant="body2" sx={{ mt: .5, color: T.ink.muted }}>
                      Editar registros, importar planilhas e desfazer lotes.
                    </Typography>
                    <Button size="small" sx={{ mt: 1, px: 0 }} onClick={() => navigate('/admin')}>
                      Abrir a administração →
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          )}
        </Grid>

        <Typography variant="body2" sx={{ mt: 5, color: T.ink.subtle, maxWidth: T.layout.prose }}>
          As informações vêm de fontes públicas. Abra um perfil para conhecer o trabalho e acessar a fonte original.
        </Typography>
      </PageContainer>
    </>
  );
}
