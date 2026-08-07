import React from 'react';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

export default function CatalogHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const categories = [
    {
      path: '/catalogo/especialistas',
      label: 'Especialistas',
      description: 'Pessoas com experiência em educação profissional, tecnologia e desenvolvimento industrial.',
      icon: <ScienceOutlinedIcon />,
    },
    {
      path: '/catalogo/instituicoes-de-educacao',
      label: 'Instituições de Educação',
      description: 'Escolas, centros de formação e redes de educação profissional.',
      icon: <SchoolOutlinedIcon />,
    },
    {
      path: '/catalogo/outras-organizacoes',
      label: 'Outras organizações',
      description: 'Empresas, órgãos públicos, associações, fundações e redes.',
      icon: <BusinessOutlinedIcon />,
    },
  ];

  return (
    <PageContainer width="page" tool="catalog">
      <PageHeader
        eyebrow="CATÁLOGO"
        title="Encontre pessoas e instituições"
        description="Escolha uma categoria. Depois pesquise por nome, tema, país ou instituição."
        accent="catalog"
        dense
      />

      {user?.role === 'admin' && (
        <Button
          variant="outlined"
          startIcon={<FileUploadOutlinedIcon />}
          onClick={() => navigate('/admin?import=1')}
          sx={{ mt: 3 }}
        >
          Importar CSV em massa
        </Button>
      )}

      <Grid container spacing={2} sx={{ mt: 3 }}>
        {categories.map((item) => (
          <Grid size={{ xs: 12, md: 4 }} key={item.path}>
            <ToolCard
              icon={item.icon}
              label={item.label}
              description={item.description}
              themeKey="catalog"
              onClick={() => navigate(item.path)}
              actionLabel="Pesquisar"
            />
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" gap={1} alignItems="flex-start" sx={{ mt: 4, maxWidth: T.layout.prose }}>
        <InfoOutlinedIcon sx={{ fontSize: 18, color: T.ink.subtle, mt: .2, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: T.ink.muted }}>
          As informações vêm de fontes públicas. Abra um perfil para conhecer o trabalho e acessar a fonte original.
        </Typography>
      </Stack>
    </PageContainer>
  );
}
