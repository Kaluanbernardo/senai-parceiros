import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import { BRAND_NAME } from '../design-system/brand';
import PageContainer from '../design-system/primitives/PageContainer';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

/**
 * O passo a passo antigo ("1. Defina o contexto / 2. Compare evidências /
 * 3. Leve o resultado") descrevia só a ferramenta de seleção, mas ficava numa
 * seção chamada "Como usar" logo abaixo das quatro ferramentas — quem lia
 * entendia que era o caminho do produto inteiro, e ia procurar a etapa 2 no
 * Radar. Virou o que de fato é: o que a Seleção faz, dito na entrada dela.
 */
const STEPS = [
  { number: '1', title: 'Descreva o contexto', text: 'O que você precisa realizar e que tipo de parceiro procura.' },
  { number: '2', title: 'Responda à entrevista', text: 'Cada pergunta parte da anterior e termina quando já há informação suficiente.' },
  { number: '3', title: 'Compare e leve', text: 'Shortlist com critérios, evidências e lacunas explícitas — exportável em planilha.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { pesquisadores, escolas, stakeholders } = useData();
  const catalogSize = pesquisadores.length + escolas.length + stakeholders.length;

  return (
    <>
      {/* Faixa institucional. É o único lugar do produto onde o azul escuro
          ocupa uma área grande — a marca aparece de uma vez, na entrada, em vez
          de ser espalhada em pedacinhos por todas as telas. */}
      <Box sx={{ bgcolor: T.surface.inverted, color: T.ink.onInverted }}>
        <Box sx={{ maxWidth: T.layout.wide, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 5, md: 7 } }}>
          <Typography variant="overline" sx={{ color: T.ink.onInvertedMuted }}>
            {BRAND_NAME.institution} · {BRAND_NAME.owner}
          </Typography>
          <Typography
            sx={{
              mt: 1,
              maxWidth: 920,
              fontFamily: T.fontFamily.display,
              fontSize: T.fontSize.display,
              fontWeight: 800,
              letterSpacing: '-.03em',
              lineHeight: 1.05,
            }}
          >
            Inteligência em educação profissional e parcerias
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: T.layout.prose, color: T.ink.onInvertedMuted, fontSize: '1.05rem' }}>
            Descubra parceiros, consulte referências públicas e acompanhe o que muda na educação
            profissional e na indústria paulista — com os critérios de cada recomendação à vista.
          </Typography>

          <Stack direction="row" gap={{ xs: 3, md: 5 }} flexWrap="wrap" sx={{ mt: 4 }}>
            <HeroStat value={catalogSize} label="perfis públicos no catálogo" />
            <HeroStat value={getNavTools().length} label="ferramentas disponíveis" />
          </Stack>
        </Box>
      </Box>

      <PageContainer width="wide">
        <Typography variant="h2">Escolha por onde começar</Typography>
        <Typography sx={{ mt: .75, mb: 3, color: T.ink.muted, maxWidth: T.layout.prose }}>
          As quatro ferramentas são independentes. Você pode entrar por qualquer uma e voltar quando precisar.
        </Typography>

        <Grid container spacing={2} alignItems="stretch">
          {getNavTools().map((tool) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={tool.id}>
              <ToolCard
                icon={getToolIcon(tool.iconKey)}
                label={tool.label}
                description={
                  tool.id === 'catalog'
                    ? `${tool.description} São ${catalogSize.toLocaleString('pt-BR')} perfis públicos.`
                    : tool.description
                }
                themeKey={tool.themeKey}
                onClick={() => navigate(tool.route)}
                meta={tool.status === 'ready' ? 'Disponível' : undefined}
              />
            </Grid>
          ))}
        </Grid>

        <Box
          sx={{
            mt: { xs: 5, md: 7 },
            p: { xs: 2.5, md: 4 },
            borderRadius: `${T.radius.lg}px`,
            bgcolor: T.surface.accentSoft,
            border: `1px solid ${T.border.subtle}`,
          }}
        >
          <Typography variant="h3">Como funciona a seleção guiada</Typography>
          <Typography sx={{ mt: .75, color: T.ink.muted, maxWidth: T.layout.prose }}>
            A ferramenta mais usada do produto, em três passos.
          </Typography>

          <Grid container spacing={2.5} sx={{ mt: 1.5 }}>
            {STEPS.map((step) => (
              <Grid size={{ xs: 12, md: 4 }} key={step.number}>
                <Stack direction="row" gap={1.75} alignItems="flex-start">
                  <Box
                    aria-hidden
                    sx={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      bgcolor: T.ink.accent,
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: T.fontSize.caption,
                    }}
                  >
                    {step.number}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: T.ink.strong }}>{step.title}</Typography>
                    <Typography variant="body2" sx={{ mt: .35, color: T.ink.muted }}>{step.text}</Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>
      </PageContainer>
    </>
  );
}

function HeroStat({ value, label }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: T.fontFamily.display, fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>
        {value.toLocaleString('pt-BR')}
      </Typography>
      <Typography variant="caption" sx={{ color: T.ink.onInvertedMuted }}>{label}</Typography>
    </Box>
  );
}
