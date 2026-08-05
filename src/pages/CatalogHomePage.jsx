import React, { useMemo } from 'react';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { mergeSchoolSources } from '../domain/schoolCatalog';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

export default function CatalogHomePage() {
  const navigate = useNavigate();
  const { pesquisadores, escolas, stakeholders } = useData();

  // Os números vêm da mesma derivação que cada lista usa, e não de uma
  // contagem paralela — senão a home prometeria um total e a lista entregaria
  // outro. As instituições, em particular, são a fusão de duas fontes.
  const counts = useMemo(
    () => ({
      researchers: pesquisadores.length,
      schools: mergeSchoolSources({ schools: escolas, stakeholders }).length,
      organizations: stakeholders.filter((item) => item.categoria !== 'Escola').length,
    }),
    [pesquisadores, escolas, stakeholders],
  );

  const categories = [
    {
      path: '/catalogo/especialistas',
      label: 'Especialistas',
      description: 'Pessoas com produção e experiência ligadas a EPT, VET e desenvolvimento industrial.',
      icon: <ScienceOutlinedIcon />,
      count: counts.researchers,
      noun: 'perfis',
    },
    {
      path: '/catalogo/instituicoes-de-educacao',
      label: 'Instituições de Educação',
      description: 'Escolas, centros de formação e redes de educação profissional.',
      icon: <SchoolOutlinedIcon />,
      count: counts.schools,
      noun: 'instituições',
    },
    {
      path: '/catalogo/outras-organizacoes',
      label: 'Outras organizações',
      description: 'Empresas, órgãos públicos, associações, fundações e redes.',
      icon: <BusinessOutlinedIcon />,
      count: counts.organizations,
      noun: 'organizações',
    },
  ];

  return (
    <PageContainer width="page">
      <PageHeader
        eyebrow="CATÁLOGO"
        title="Consulte o catálogo"
        description="Perfis públicos verificados, organizados em três categorias. Cada lista tem busca, filtros e link direto para a fonte."
        accent="catalog"
        dense
      />

      <Grid container spacing={2} sx={{ mt: 3 }}>
        {categories.map((item) => (
          <Grid size={{ xs: 12, md: 4 }} key={item.path}>
            <ToolCard
              icon={item.icon}
              label={item.label}
              description={item.description}
              themeKey="catalog"
              // O número é a informação que decide por onde começar; antes ele
              // só aparecia depois de entrar na categoria.
              meta={`${item.count.toLocaleString('pt-BR')} ${item.noun}`}
              onClick={() => navigate(item.path)}
              actionLabel="Ver categoria"
            />
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 4, maxWidth: T.layout.prose }}>
        <InfoOutlinedIcon sx={{ fontSize: 18, color: T.ink.subtle, mt: .2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: T.ink.muted }}>
          Os perfis reúnem informações públicas e são atualizados conforme novas fontes forem verificadas.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
