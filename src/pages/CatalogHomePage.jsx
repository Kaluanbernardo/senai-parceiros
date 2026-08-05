import React from 'react';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessIcon from '@mui/icons-material/Business';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../design-system/primitives/PageHeader';
import ToolCard from '../design-system/primitives/ToolCard';

const CATEGORIES = [
  { path: '/catalogo/especialistas', label: 'Especialistas', description: 'Pessoas com produção e experiência ligadas a EPT, VET e desenvolvimento industrial.', icon: <ScienceIcon />, themeKey: 'catalog' },
  { path: '/catalogo/instituicoes-de-educacao', label: 'Instituições de Educação', description: 'Instituições de educação profissional e redes de formação.', icon: <SchoolIcon />, themeKey: 'catalog' },
  { path: '/catalogo/outras-organizacoes', label: 'Outras organizações', description: 'Empresas, órgãos públicos e outras instituições relevantes.', icon: <BusinessIcon />, themeKey: 'catalog' },
];

export default function CatalogHomePage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 6 } }}>
      <PageHeader eyebrow="CATÁLOGO DE STAKEHOLDERS" title="Consulte o catálogo" description="Escolha uma categoria para explorar os perfis públicos disponíveis no MVP." accent="catalog" />
      <Grid container spacing={2.5} sx={{ mt: 4 }}>
        {CATEGORIES.map((item) => <Grid size={{ xs: 12, md: 4 }} key={item.path}><ToolCard icon={item.icon} label={item.label} description={item.description} themeKey={item.themeKey} onClick={() => navigate(item.path)} /></Grid>)}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: .75 }}><AccountBalanceIcon fontSize="small" /> Os perfis são informações públicas e podem ser atualizados conforme novas fontes forem verificadas.</Typography>
    </Box>
  );
}
