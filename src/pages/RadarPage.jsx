import React, { useEffect, useMemo, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import Divider from '@mui/material/Divider';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { countUndatedItems, filterRadarItems, RADAR_SECTION_LABELS, RADAR_SECTIONS } from '../domain/radar';
import { useAuth } from '../context/AuthContext';

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
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '1y', label: 'Últimos 12 meses' },
];

/**
 * Turns the per-source status of a refresh run into a short operator-facing
 * clause naming which sources failed and why, so a partial run can be acted on
 * without opening the endpoint by hand.
 */
function describeFailures(lastRun) {
  const entries = Object.values(lastRun?.sourceStatus || {});
  const failed = entries.filter((entry) => entry.status === 'error');
  if (!failed.length) return '';
  const detail = failed
    .map((entry) => (entry.error ? `${entry.name} (${entry.error})` : entry.name))
    .join(', ');
  return `: ${detail}`;
}

function localDate(date) {
  if (!date) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
}

export default function RadarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [section, setSection] = useState('research');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const [filters, setFilters] = useState({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '', sort: 'relevance' });

  const activeSection = sections.find((entry) => entry.value === section) || sections[0];
  const sourceValues = Object.values(meta?.sourceStatus || {});
  const sourceErrors = sourceValues.filter((source) => source.status === 'error');
  const sourceSuccesses = sourceValues.filter((source) => source.status === 'ok');
  const everySourceFailed = sourceValues.length > 0 && sourceSuccesses.length === 0;

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

  /**
   * Reading the radar never touches the network, so a new snapshot only exists
   * after the protected refresh runs.  Until this button the collection could be
   * triggered solely by the daily cron or by hand against the endpoint, which
   * left no way to operate the radar from the interface.
   */
  const collectNow = async () => {
    setCollecting(true);
    setCollectResult(null);
    try {
      const response = await fetch('/api/radar/refresh', { method: 'POST', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setCollectResult({ severity: 'error', message: 'Sua sessão expirou. Entre novamente como administrador para coletar.' });
        return;
      }
      if (!response.ok || !body.refreshed) {
        // A partial failure keeps the last valid snapshot on purpose, so the
        // radar below stays populated even when this run collected nothing.
        // Naming the sources that failed is what makes the run diagnosable:
        // "one or more sources" alone gives the operator nothing to act on.
        setCollectResult({
          severity: 'warning',
          message: body.stale
            ? `A coleta falhou em uma ou mais fontes${describeFailures(body.lastRun)}. O último snapshot válido foi preservado.`
            : `A coleta não pôde ser concluída agora${describeFailures(body.lastRun)}. O conteúdo exibido continua sendo o último snapshot válido.`,
        });
        return;
      }
      const driver = body.store?.driver || 'memory';
      setCollectResult(driver === 'memory'
        ? {
          severity: 'warning',
          message: 'Coleta concluída, mas o snapshot está apenas em memória e será perdido na próxima requisição. Configure RADAR_STORE_DRIVER para um adapter durável.',
        }
        : {
          severity: 'success',
          message: `Coleta concluída em ${Math.round((body.durationMs || 0) / 1000)}s: ${body.lastRun?.itemCount ?? 0} item(ns) gravado(s) no snapshot durável.`,
        });
    } catch {
      setCollectResult({ severity: 'error', message: 'A coleta não respondeu. Ela consulta várias fontes externas e pode exceder o tempo limite da função.' });
    } finally {
      setCollecting(false);
      await loadItems();
    }
  };

  const options = useMemo(() => ({
    sources: [...new Set(items.map((item) => item.sourceName))].sort(),
    topics: [...new Set(items.flatMap((item) => item.topics))].sort(),
    contentTypes: [...new Set(items.map((item) => item.contentType))].sort(),
  }), [items]);

  const visibleItems = useMemo(() => filterRadarItems(items, filters), [items, filters]);
  // A narrow window hides undated items by design; saying so keeps the omission
  // from looking like the source simply published nothing.
  const undatedCount = useMemo(() => countUndatedItems(items), [items]);
  const undatedHidden = undatedCount > 0 && filters.period !== '1y';
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => setFilters({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '', sort: 'relevance' });

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
        <Box>
          <Typography variant="overline" color="secondary.main" fontWeight={800}>RADAR EPT · VET</Typography>
          <Typography variant="h3" sx={{ mt: 0.5, fontSize: { xs: '2rem', md: '3rem' } }}>O que mudou na área?</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{activeSection.description}</Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {/* "Recarregar" only re-reads the stored snapshot; collecting from the
              external sources is the admin-only action next to it. */}
          {/* describeChild keeps the visible label as the accessible name; without
              it the tooltip text replaces the button name for screen readers. */}
          <Tooltip describeChild title="Relê o snapshot atual, sem consultar as fontes externas" arrow>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadItems} disabled={loading || collecting}>Recarregar</Button>
          </Tooltip>
          {isAdmin && (
            <Tooltip describeChild title="Consulta as fontes oficiais agora e grava um novo snapshot" arrow>
              <Button
                variant="contained"
                startIcon={collecting ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
                onClick={collectNow}
                disabled={collecting || loading}
              >
                {collecting ? 'Coletando…' : 'Coletar agora'}
              </Button>
            </Tooltip>
          )}
        </Stack>
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
            <Typography variant="caption" color="text.secondary">
              {visibleItems.length} item(ns) visível(is)
              {undatedHidden && ` · ${undatedCount} sem data publicada, oculto(s) por este período`}
            </Typography>
            <Button size="small" onClick={clearFilters}>Limpar filtros</Button>
          </Stack>
        </CardContent>
      </Card>

      <Alert icon={<InfoOutlinedIcon />} severity="info" sx={{ mt: 2 }}>
        <strong>Como a relevância é calculada:</strong> aderência temática (até 50 pontos) + recência (até 30) + qualidade da fonte (até 20). Só entram publicações identificadas com data dos últimos 12 meses.
      </Alert>
      {meta?.mode === 'curated-fallback' && <Alert severity="info" sx={{ mt: 2 }}>Exibindo novidades públicas verificadas da base curada enquanto as fontes automáticas se recuperam.</Alert>}
      {meta?.stale && <Alert severity="warning" sx={{ mt: 2 }}>Uma ou mais fontes falharam. Exibindo o último snapshot válido, atualizado em {meta.fetchedAt ? localDate(meta.fetchedAt.slice(0, 10)) : 'data não informada'}.</Alert>}
      {everySourceFailed && <Alert severity="warning" sx={{ mt: 2 }}>As fontes automáticas desta seção não responderam nesta atualização. As novidades públicas verificadas continuam disponíveis.</Alert>}
      {!everySourceFailed && sourceErrors.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Atualizado com {sourceSuccesses.length} de {sourceValues.length} fontes automáticas; {sourceErrors.length} não respondeu nesta consulta.</Typography>}
      {collectResult && <Alert severity={collectResult.severity} sx={{ mt: 2 }} onClose={() => setCollectResult(null)}>{collectResult.message}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box> : (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {visibleItems.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ height: 4, bgcolor: item.official ? 'secondary.main' : 'primary.main' }} />
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
                    <Box>
                      <Typography variant="overline" color={item.official ? 'secondary.main' : 'primary.main'} fontWeight={900}>{item.sourceName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{item.contentType}</Typography>
                    </Box>
                    <Chip size="small" color={item.noveltyStatus === 'new' ? 'success' : 'info'} variant="outlined" label={item.noveltyLabel} />
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 1.25, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{item.title}</Typography>
                  {item.originalTitle && item.originalTitle !== item.title && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Título original: {item.originalTitle}</Typography>}
                  <Divider sx={{ my: 1.5 }} />
                  {item.summaryStatus !== 'unavailable' ? (
                    <>
                      <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ display: 'block', mb: 0.35 }}>Em poucas palavras</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{item.summaryPt}</Typography>
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">A fonte não disponibilizou um resumo deste item.</Typography>
                  )}
                  <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mt: 1.5 }}>{item.topics.map((topic) => <Chip key={topic} size="small" label={topic} variant="outlined" />)}</Stack>
                  <Tooltip title={item.relevanceExplanation || ''} arrow>
                    <Chip size="small" color="secondary" label={`Relevância ${item.relevanceScore}/100`} sx={{ mt: 1.25 }} />
                  </Tooltip>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{item.relevanceExplanation}</Typography>
                  {item.authors?.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Autores: {item.authors.join(', ')}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}><AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.35 }} />{localDate(item.publishedAt)}{item.geography ? ` · ${item.geography}` : ''}</Typography>
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
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4 }}>Rastreabilidade: cada item mantém título original, fonte, data, provedor de coleta, pontuação de relevância e link público. Modo atual: {meta?.mode || 'não informado'} · atualização: {meta?.fetchedAt ? localDate(meta.fetchedAt.slice(0, 10)) : 'não informada'} · snapshot: {meta?.store?.driver || 'memória'}. A ferramenta não salva suas buscas nem seu filtro.</Typography>
    </Box>
  );
}
