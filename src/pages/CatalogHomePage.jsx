import React, { useState } from 'react';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import CatalogEnrichmentDialog from '../components/catalog/CatalogEnrichmentDialog';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import ToolCard from '../design-system/primitives/ToolCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

export default function CatalogHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const data = useData();
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const categories = [
    {
      path: '/catalogo/pessoas-fisicas',
      label: 'Pessoas Físicas',
      description: 'Profissionais, pesquisadores, personalidades públicas, agentes públicos e outras pessoas.',
      icon: <PersonOutlineIcon />,
    },
    {
      path: '/catalogo/pessoas-juridicas',
      label: 'Pessoas Jurídicas',
      description: 'Empresas, órgãos públicos, instituições de ensino, associações, fundações e redes.',
      icon: <BusinessOutlinedIcon />,
    },
  ];

  return (
    <PageContainer width="page" tool="catalog">
      <PageHeader
        eyebrow="CATÁLOGO"
        title="Encontre pessoas físicas e jurídicas"
        description="Escolha uma categoria. Depois filtre pelo subtipo mais adequado à sua necessidade."
        accent="catalog"
        dense
      />

      {user?.role === 'admin' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 3 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AutoFixHighOutlinedIcon />}
            onClick={() => setEnrichmentOpen(true)}
          >
            Enriquecer catálogo
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileUploadOutlinedIcon />}
            onClick={() => navigate('/admin?import=1')}
          >
            Importar CSV em massa
          </Button>
        </Stack>
      )}

      <Grid container spacing={2} sx={{ mt: 3 }}>
        {categories.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.path}>
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

      {user?.role === 'admin' && (
        <CatalogEnrichmentDialog
          open={enrichmentOpen}
          onClose={() => setEnrichmentOpen(false)}
          onCatalogChanged={data.refreshCatalog}
        />
      )}
    </PageContainer>
  );
}
