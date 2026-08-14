import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import PageContainer from '../design-system/primitives/PageContainer';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import { BRAND_NAME } from '../design-system/brand';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tools = getNavTools(user?.role);

  return (
    <>
      {/* Faixa institucional. É o único lugar do produto onde o azul escuro
          ocupa uma área grande — a marca aparece de uma vez, na entrada, em vez
          de ser espalhada em pedacinhos por todas as telas. */}
      <Box sx={{ bgcolor: T.surface.inverted, color: T.ink.onInverted }}>
        <Box sx={{ maxWidth: T.layout.wide, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>
          <Typography variant="overline" sx={{ color: T.ink.onInvertedMuted }}>
            {BRAND_NAME.product}
          </Typography>
          <Typography
            sx={{
              maxWidth: 920,
              fontFamily: T.fontFamily.display,
              fontSize: T.fontSize.display,
              fontWeight: 800,
              letterSpacing: '-.03em',
              lineHeight: 1.05,
            }}
          >
            Encontre as conexões certas para cada iniciativa
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: T.layout.prose, color: T.ink.onInvertedMuted, fontSize: '1.05rem' }}>
            Encontre pessoas e instituições, pesquise referências ou acompanhe novidades da educação profissional.
          </Typography>
        </Box>
      </Box>

      <PageContainer width="wide">
        <Typography variant="h2">O que você quer fazer?</Typography>
        <Typography sx={{ mt: .75, color: T.ink.muted }}>
          Se ainda não sabe quem procurar, comece por Encontrar parceiros.
        </Typography>

        <Grid container spacing={2} alignItems="stretch" sx={{ mt: 2.5 }}>
          {tools.map((tool) => (
            <Grid size={{ xs: 12, md: 6 }} key={tool.id}>
              <ToolCard
                icon={getToolIcon(tool.iconKey)}
                label={tool.label}
                description={tool.description}
                themeKey={tool.themeKey}
                actionLabel={tool.actionLabel}
                onClick={() => navigate(tool.route)}
              />
            </Grid>
          ))}
        </Grid>
      </PageContainer>
    </>
  );
}
