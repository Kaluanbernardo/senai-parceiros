import React from 'react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RadarIcon from '@mui/icons-material/Radar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { pesquisadores, escolas, stakeholders } = useData();
  const catalogSummary = String(pesquisadores.length) + ' pesquisadores, ' + String(escolas.length) + ' escolas e ' + String(stakeholders.length) + ' organizações cadastrados.';
  return (
    <Box sx={{ maxWidth: 1220, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 4, md: 7 } }}>
      <Grid container spacing={5} alignItems="center">
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="overline" color="secondary.main" fontWeight={800}>SENAI-SP · INTELIGÊNCIA DE STAKEHOLDERS</Typography>
          <Typography variant="h2" sx={{ mt: 1, fontSize: { xs: '2.35rem', md: '4rem' }, lineHeight: 1.06 }}>Encontre o parceiro certo para o próximo desafio.</Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ mt: 2, maxWidth: 650 }}>
            Uma entrevista guiada transforma uma necessidade ainda pouco definida em uma shortlist técnica, comparável e rastreável.
          </Typography>
          <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/selecionar')} sx={{ mt: 3, px: 3 }}>Começar seleção de stakeholders</Button>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 4, overflow: 'hidden' }}>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <FactCheckOutlinedIcon sx={{ fontSize: 42, mb: 2 }} />
              <Typography variant="h5" fontWeight={800}>Decisão explicável</Typography>
              <Typography sx={{ mt: 1, color: 'rgba(255,255,255,.8)' }}>Veja o que foi perguntado, quais critérios pesaram, que evidências existem e onde ainda há lacunas.</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 3 }}>
                <Box sx={{ px: 1.5, py: .75, borderRadius: 2, bgcolor: 'rgba(255,255,255,.12)', fontSize: 13 }}>Até 5 resultados</Box>
                <Box sx={{ px: 1.5, py: .75, borderRadius: 2, bgcolor: 'rgba(255,255,255,.12)', fontSize: 13 }}>Sem histórico salvo</Box>
                <Box sx={{ px: 1.5, py: .75, borderRadius: 2, bgcolor: 'rgba(255,255,255,.12)', fontSize: 13 }}>4 formatos de exportação</Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Typography variant="h6" fontWeight={800} sx={{ mt: 8, mb: 2 }}>Outras ferramentas</Typography>
      <Grid container spacing={2}>
        {[
          { icon: <SearchIcon />, title: 'Consultar catálogo', text: catalogSummary, path: '/catalogo/pesquisadores' },
          { icon: <AutoAwesomeIcon />, title: 'Gerar prompt de pesquisa', text: 'Crie um prompt provider-independent com colunas padronizadas e rastreabilidade.', path: '/gerador-prompt' },
          { icon: <RadarIcon />, title: 'Acompanhar novidades', text: 'Pesquise atualizações acadêmicas, governamentais e internacionais sobre EPT e VET.', path: '/radar' },
        ].map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.title}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                {item.icon}
                <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>{item.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: .5 }}>{item.text}</Typography>
                <Button onClick={() => navigate(item.path)} sx={{ mt: 1, px: 0 }}>Abrir ferramenta <ArrowForwardIcon sx={{ fontSize: 17, ml: .5 }} /></Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
