import React from 'react';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import Groups2Icon from '@mui/icons-material/Groups2';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import RadarIcon from '@mui/icons-material/Radar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { getNavTools } from '../app/toolRegistry';
import { getToolIcon } from '../app/toolIcons';
import radarSeeds from '../data/radar-seeds.json';
import PageHeader from '../design-system/primitives/PageHeader';
import SectionCard from '../design-system/primitives/SectionCard';
import ToolCard from '../design-system/primitives/ToolCard';

const STEPS = [
  { number: '1', title: 'Defina o contexto', text: 'Conte o que você precisa realizar e qual tipo de stakeholder procura.', icon: <AccountBalanceIcon /> },
  { number: '2', title: 'Compare evidências', text: 'Revise os critérios, lacunas e sinais que explicam cada recomendação.', icon: <Groups2Icon /> },
  { number: '3', title: 'Leve o resultado', text: 'Exporte a análise em uma planilha rica para compartilhar e aprofundar.', icon: <LibraryBooksIcon /> },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { pesquisadores, escolas, stakeholders } = useData();
  const catalogSummary = `${pesquisadores.length + escolas.length + stakeholders.length} perfis públicos no catálogo`;
  const radarSources = new Set(radarSeeds.map((item) => item.sourceName).filter(Boolean)).size;
  const publishedDates = radarSeeds.map((item) => item.publishedAt).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date || ''));
  const radarLastUpdate = publishedDates.length ? publishedDates.sort().at(-1) : 'base inicial';

  return (
    <Box sx={{ maxWidth: 1220, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader
        eyebrow="SENAI-SP · INTELIGÊNCIA EM EPT E PARCERIAS"
        title="Central de Inteligência em EPT e Parcerias"
        description="Um espaço para descobrir parceiros, consultar referências e acompanhar sinais importantes para o desenvolvimento da indústria paulista e da educação profissional."
        accent="catalog"
      />

      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 3 }}>
        <Chip size="small" icon={<Groups2Icon />} label={catalogSummary} />
        <Chip size="small" icon={<RadarIcon />} label={`Radar: ${radarLastUpdate}`} />
        <Chip size="small" label={`${radarSources} fontes monitoradas`} />
        <Chip size="small" variant="outlined" label="Resultados temporários" />
        <Chip size="small" variant="outlined" label="Informações públicas" />
      </Stack>

      <Typography variant="h2" sx={{ mt: 6, mb: 2, fontSize: { xs: '1.55rem', md: '2rem' } }}>Escolha por onde começar</Typography>
      <Grid container spacing={2.5} alignItems="stretch">
        {getNavTools().map((tool) => (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={tool.id}>
            <ToolCard
              icon={getToolIcon(tool.iconKey)}
              label={tool.label}
              description={tool.id === 'catalog' ? `${tool.description} ${catalogSummary}.` : tool.description}
              themeKey={tool.themeKey}
              onClick={() => navigate(tool.route)}
              meta={tool.status === 'ready' ? 'Disponível' : undefined}
            />
          </Grid>
        ))}
      </Grid>

      <SectionCard sx={{ mt: 6, p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h3" sx={{ fontSize: { xs: '1.35rem', md: '1.65rem' } }}>Como usar</Typography>
        <Typography color="text.secondary" sx={{ mt: .5 }}>Você pode começar por qualquer ferramenta e voltar quando precisar.</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {STEPS.map((step) => (
            <Grid size={{ xs: 12, md: 4 }} key={step.number}>
              <Stack direction="row" gap={1.5} alignItems="flex-start" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', height: '100%' }}>
                <Box sx={{ minWidth: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 800 }}>{step.number}</Box>
                <Box>
                  <Stack direction="row" gap={.75} alignItems="center"><Box sx={{ color: 'primary.main', display: 'flex' }}>{step.icon}</Box><Typography fontWeight={750}>{step.title}</Typography></Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{step.text}</Typography>
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </SectionCard>
    </Box>
  );
}
