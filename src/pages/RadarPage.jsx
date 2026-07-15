import React, { useEffect, useMemo, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { filterRadarItems, RADAR_SECTION_LABELS, RADAR_SECTIONS } from '../domain/radar';

const sections = RADAR_SECTIONS.map((value) => ({
  value,
  label: RADAR_SECTION_LABELS[value],
  description: {
    research: 'Produção acadêmica recente em EPT, VET e temas associados à indústria.',
    government: 'Atualizações oficiais federais e do Estado de São Paulo com relação forte com EPT.',
    international: 'OCDE, OIT, UNESCO-UNEVOC e outros organismos relevantes para VET.',
  }[value],
}));

const periodOptions = [
  { value: 'all', label: 'Todo o período' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '1y', label: 'Último ano' },
];

function localDate(date) {
  if (!date) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
}

export default function RadarPage() {
  const [section, setSection] = useState('research');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ query: '', period: 'all', topic: '', source: '', geography: '', contentType: '', sort: 'relevance' });

  const activeSection = sections.find((entry) => entry.value === section) || sections[0];

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const serverQuery = section === 'research' && filters.query.trim().length >= 3 ? `&query=${encodeURIComponent(filters.query.trim().slice(0, 120))}` : '';
      const response = await fetch(`/api/radar/items?section=${encodeURIComponent(section)}${serverQuery}`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'radar_unavailable');
      setItems(body.items || []);
      setMeta(body);
    } catch {
      setItems([]);
      setError('Não foi possível carregar este radar agora. Tente atualizar em instantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [section]);

  const options = useMemo(() => ({
    sources: [...new Set(items.map((item) => item.sourceName))].sort(),
    topics: [...new Set(items.flatMap((item) => item.topics))].sort(),
    contentTypes: [...new Set(items.map((item) => item.contentType))].sort(),
  }), [items]);

  const visibleItems = useMemo(() => filterRadarItems(items, filters), [items, filters]);
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => setFilters({ query: '', period: 'all', topic: '', source: '', geography: '', contentType: '', sort: 'relevance' });

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
        <Box>
          <Typography variant="overline" color="secondary.main" fontWeight={800}>RADAR EPT · VET</Typography>
          <Typography variant="h3" sx={{ mt: 0.5, fontSize: { xs: '2rem', md: '3rem' } }}>O que mudou na área?</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{activeSection.description}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadItems} disabled={loading}>Atualizar</Button>
      </Stack>

      <Card variant="outlined" sx={{ mt: 3, overflow: 'visible' }}>
        <Tabs value={section} onChange={(_, value) => { setSection(value); clearFilters(); }} variant="scrollable" scrollButtons="auto" aria-label="Seções do radar">
          {sections.map((entry) => <Tab key={entry.value} value={entry.value} label={entry.label} />)}
        </Tabs>
      </Card>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <FilterListIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={800}>Filtros</Typography>
            <Typography variant="caption" color="text.secondary">A busca considera título, resumo, fonte, localidade e temas.</Typography>
          </Stack>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth size="small" label="Buscar" value={filters.query} onChange={setFilter('query')} placeholder="ex.: inteligência artificial" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}><FormControl fullWidth size="small"><InputLabel>Período</InputLabel><Select value={filters.period} label="Período" onChange={setFilter('period')}>{periodOptions.map((entry) => <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 2 }}><FormControl fullWidth size="small"><InputLabel>Ordenar</InputLabel><Select value={filters.sort} label="Ordenar" onChange={setFilter('sort')}><MenuItem value="relevance">Relevância + recência</MenuItem><MenuItem value="date">Mais recentes</MenuItem></Select></FormControl></Grid>
            <Grid size={{ xs: 12, md: 2 }}><FormControl fullWidth size="small"><InputLabel>Fonte</InputLabel><Select value={filters.source} label="Fonte" onChange={setFilter('source')}><MenuItem value="">Todas</MenuItem>{options.sources.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Local</InputLabel><Select value={filters.geography} label="Local" onChange={setFilter('geography')}><MenuItem value="">Todos</MenuItem>{[...new Set(items.map((item) => item.geography))].sort().map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Tema</InputLabel><Select value={filters.topic} label="Tema" onChange={setFilter('topic')}><MenuItem value="">Todos</MenuItem>{options.topics.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Tipo</InputLabel><Select value={filters.contentType} label="Tipo" onChange={setFilter('contentType')}><MenuItem value="">Todos</MenuItem>{options.contentTypes.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
          </Grid>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">{visibleItems.length} item(ns) visível(is)</Typography>
            <Button size="small" onClick={clearFilters}>Limpar filtros</Button>
          </Stack>
        </CardContent>
      </Card>

      {meta?.mode === 'curated-fallback' && <Alert severity="info" sx={{ mt: 2 }}>Modo curado de demonstração: os itens sem data são fontes oficiais de monitoramento, não uma notícia nova. Ao habilitar as fontes live no ambiente, pesquisas acadêmicas serão atualizadas automaticamente por OpenAlex e Crossref; os conectores governamentais e internacionais entram na próxima rotina de ingestão.</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box> : (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {visibleItems.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                    <Stack direction="row" gap={0.75} flexWrap="wrap">
                      <Chip size="small" color={item.official ? 'primary' : 'default'} label={item.sourceName} />
                      <Chip size="small" variant="outlined" label={item.contentType} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}><AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.25 }} />{localDate(item.publishedAt)}</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 1.5, lineHeight: 1.25 }}>{item.title}</Typography>
                  {item.originalTitle && item.originalTitle !== item.title && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Título original: {item.originalTitle}</Typography>}
                  <Typography color="text.secondary" sx={{ mt: 1 }}>{item.summaryPt}</Typography>
                  <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mt: 1.5 }}>{item.topics.map((topic) => <Chip key={topic} size="small" label={topic} variant="outlined" />)}<Chip size="small" color="secondary" variant="outlined" label={`Relevância ${item.relevanceScore}/100`} /></Stack>
                  {item.authors?.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Autores: {item.authors.join(', ')}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Provedor: {item.provider}{item.geography ? ` · Local: ${item.geography}` : ''}</Typography>
                </CardContent>
                <Box sx={{ px: 2, pb: 2 }}>
                  {item.sourceUrl ? <Button href={item.sourceUrl} target="_blank" rel="noreferrer" size="small" endIcon={<OpenInNewIcon />} startIcon={<ArticleOutlinedIcon />}>Abrir fonte original</Button> : <Typography variant="caption" color="text.secondary">Fonte original não localizada</Typography>}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {!loading && !error && visibleItems.length === 0 && <Box sx={{ textAlign: 'center', py: 8 }}><Typography variant="h6" color="text.secondary">Nenhum item encontrado</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Tente remover um filtro ou ampliar o período.</Typography></Box>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4 }}>Rastreabilidade: cada item mantém título original, fonte, data, provedor de coleta, pontuação de relevância e link público. Modo atual: {meta?.mode || 'não informado'} · consulta: {meta?.fetchedAt ? localDate(meta.fetchedAt.slice(0, 10)) : 'não informada'}. A ferramenta não salva suas buscas nem seu filtro.</Typography>
    </Box>
  );
}
