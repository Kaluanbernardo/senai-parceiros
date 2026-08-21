import React from 'react';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import Grid from '@mui/material/Grid';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import ToolCard from '../design-system/primitives/ToolCard';

const RESEARCH_OPTIONS = Object.freeze([
  Object.freeze({
    route: '/pesquisar-parceiros/externa',
    label: 'Pesquisar externamente',
    description: 'Monte um pedido claro para copiar e usar na ferramenta de IA de sua preferência.',
    actionLabel: 'Montar pedido',
    icon: <AutoAwesomeOutlinedIcon />,
    themeKey: 'prompt',
  }),
  Object.freeze({
    route: '/pesquisar-parceiros/interna',
    label: 'Pesquisar internamente',
    description: 'Pesquise fontes públicas no Farol, revise as sugestões e adicione as aprovadas ao catálogo.',
    actionLabel: 'Pesquisar no Farol',
    icon: <ManageSearchOutlinedIcon />,
    themeKey: 'research',
  }),
]);

export default function PartnerResearchHomePage() {
  const navigate = useNavigate();

  return (
    <PageContainer width="page" tool="research">
      <PageHeader
        eyebrow="PESQUISAR NOVOS PARCEIROS"
        title="Onde você quer fazer a pesquisa?"
        description="Escolha se deseja preparar um pedido para outra ferramenta ou pesquisar diretamente no Farol."
        accent="research"
        dense
      />

      <Grid container spacing={2} alignItems="stretch" sx={{ mt: 3 }}>
        {RESEARCH_OPTIONS.map((option) => (
          <Grid size={{ xs: 12, md: 6 }} key={option.route}>
            <ToolCard
              icon={option.icon}
              label={option.label}
              description={option.description}
              themeKey={option.themeKey}
              actionLabel={option.actionLabel}
              onClick={() => navigate(option.route)}
            />
          </Grid>
        ))}
      </Grid>
    </PageContainer>
  );
}
