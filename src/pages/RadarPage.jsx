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
import RadarIcon from '@mui/icons-material/Radar';
import { countUndatedItems, filterRadarItems, RADAR_SECTIONS } from '../domain/radar';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../design-system/primitives/EmptyState';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const sections = RADAR_SECTIONS.map((value) => ({
  value,
  label: {
    research: 'Pesquisas e estudos',
    government: 'Publicações oficiais de São Paulo e Brasil',
    international: 'Publicações oficiais internacionais',
  }[value],
  description: {
    research: 'Estudos recentes sobre educação profissional, tecnologia e indústria.',
    government: 'Decisões e iniciativas públicas do Brasil e do Estado de São Paulo.',
    international: 'Práticas e novidades de outros países e organismos internacionais.',
  }[value],
}));

const periodOptions = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '1y', label: 'Últimos 12 meses' },
];

/**
 * Reports every source that did not return usable items, whatever status it
 * used to say so.  Matching only `status === 'error'` left the collectors that
 * report their own vocabulary — the DOU forwards the provider's status — with
 * no way to appear, so a run could fail with nothing to point at.
 */
function describeFailures(lastRun) {
  const entries = Object.values(lastRun?.sourceStatus || {});
  const unproductive = entries.filter((entry) => entry.status !== 'ok' || !(entry.count > 0));
  if (!unproductive.length) {
    // A run that aborted before reaching any collector reports no source at all.
    return lastRun?.error ? `: ${lastRun.error}` : '';
  }
  const detail = unproductive
    .map((entry) => {
      const reason = entry.error || (Array.isArray(entry.errors) && entry.errors[0]) || entry.status;
      return `${entry.name} (${reason})`;
    })
    .join(', ');
  return `: ${detail}`;
}

/**
 * The wording the source itself published, shown only when the card leads with
 * something else — an editorial headline or a translation.  Traceability is the
 * point: a reader must always be able to match the card back to the act or the
 * paper it came from.
 */
function originalTitleOf(item) {
  const original = item.originalTitle || item.title;
  return original && original !== item.displayTitle ? original : '';
}

function summaryLabel(item) {
  if (item.section === 'research') return 'Em poucas palavras';
  return item.editorialSummary ? 'O que isso significa' : 'Por que está no Radar';
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
  const [rewriting, setRewriting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const [filters, setFilters] = useState({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '' });

  const activeSection = sections.find((entry) => entry.value === section) || sections[0];

  const loadItems = async ({ quiet = false } = {}) => {
    // A quiet reload refreshes the cards without blanking the grid, which is
    // what lets the rewrite phase show its progress on the items themselves.
    if (!quiet) setLoading(true);
    setError('');
    try {
      const serverQuery = section === 'research' && filters.query.trim().length >= 3 ? `&query=${encodeURIComponent(filters.query.trim().slice(0, 120))}` : '';
      const response = await fetch(`/api/radar/items?section=${encodeURIComponent(section)}${serverQuery}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'radar_unavailable');
      setItems(body.items || []);
      setMeta(body);
    } catch {
      setItems([]);
      setError('Não foi possível carregar este radar agora. Tente atualizar em instantes.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [section]);

  /**
   * Second phase of a collection, run as its own request.
   *
   * Collecting ten external sources consumes almost the whole function budget,
   * which left the editorial pass no time when both shared one invocation: in
   * production it never rewrote a single item. Each request gets its own budget,
   * so the rewrite is issued separately and repeated until the backlog is empty
   * — the operator still presses one button.
   */
  const rewriteCollected = async (prefix = '', maxPasses = 5) => {
    let rewritten = 0;
    let lastRun = null;
    for (let pass = 0; pass < maxPasses; pass += 1) {
      setRewriting(true);
      const response = await fetch('/api/radar/refresh?mode=editorial', { method: 'POST', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      lastRun = body.lastRun || lastRun;
      const status = body.lastRun?.sourceStatus?.['Títulos e resumos editoriais'];
      if (!response.ok || !body.stats) {
        const reason = status?.errors?.length ? `: ${status.errors.join(', ')}` : '';
        return { severity: 'warning', message: `Nenhum texto foi reescrito${reason}.`, lastRun };
      }
      rewritten += body.stats.rewritten || 0;
      // A pass takes about half a minute and there can be five of them. Without
      // a sign of life between them the button is indistinguishable from broken,
      // so each pass reports where it got to and refreshes the cards — the items
      // changing on screen is the progress bar.
      setCollectResult({
        severity: 'info',
        message: `${prefix}Reescrevendo os textos em português: ${rewritten} pronto(s), ${body.remaining} na fila…`,
        lastRun,
      });
      await loadItems({ quiet: true });
      // A pass that rewrote nothing will not do better on the next one: either
      // the queue is empty or every attempt is being refused.
      if (!body.stats.rewritten || !body.remaining) {
        if (rewritten > 0) return { severity: 'success', message: `${rewritten} texto(s) reescrito(s) em português.`, lastRun };
        const reason = status?.errors?.length ? `: ${status.errors.join(', ')}` : status?.candidates ? '.' : ': não havia texto pendente.';
        return { severity: status?.candidates ? 'warning' : 'success', message: `Nenhum texto foi reescrito${reason}`, lastRun };
      }
    }
    return { severity: 'success', message: `${rewritten} texto(s) reescrito(s) em português; ainda há fila, clique de novo para continuar.`, lastRun };
  };

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
      const response = await fetch('/api/radar/refresh?mode=collection', { method: 'POST', credentials: 'include' });
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
          lastRun: body.lastRun,
        });
        return;
      }
      const driver = body.store?.driver || 'memory';
      const collected = `Coleta concluída em ${Math.round((body.durationMs || 0) / 1000)}s: ${body.lastRun?.itemCount ?? 0} item(ns) gravado(s)`;
      if (driver === 'memory') {
        setCollectResult({
          severity: 'warning',
          message: `${collected}, mas o snapshot está apenas em memória e será perdido na próxima requisição. Configure RADAR_STORE_DRIVER para um adapter durável.`,
          lastRun: body.lastRun,
        });
        return;
      }
      const collectedMessage = `${collected} no snapshot durável. `;
      // Shown now rather than at the end: the rewrite phase that follows can run
      // for minutes, and the collection has already succeeded.
      setCollectResult({ severity: 'info', message: `${collectedMessage}Reescrevendo os textos em português…`, lastRun: body.lastRun });
      const editorial = await rewriteCollected(collectedMessage);
      setCollectResult({
        severity: editorial.severity,
        message: `${collectedMessage}${editorial.message}`,
        lastRun: editorial.lastRun || body.lastRun,
      });
    } catch {
      setCollectResult({ severity: 'error', message: 'A coleta não respondeu. Ela consulta várias fontes externas e pode exceder o tempo limite da função.' });
    } finally {
      setCollecting(false);
      setRewriting(false);
      await loadItems();
    }
  };

  const collectDiagnostics = collectResult?.lastRun
    ? JSON.stringify(collectResult.lastRun, null, 2)
    : '';

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
  const clearFilters = () => setFilters({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '' });

  return (
    <PageContainer width="wide" tool="radar">
      <PageHeader
        eyebrow="RADAR"
        title="Acompanhe o que está mudando"
        description={activeSection.description}
        accent="radar"
        dense
        actions={
          <>
            <Tooltip describeChild title="Relê o snapshot atual, sem consultar as fontes externas" arrow>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadItems} disabled={loading || collecting || rewriting}>Recarregar</Button>
            </Tooltip>
            {isAdmin && (
              <Tooltip describeChild title="Consulta as fontes oficiais, grava um novo snapshot e reescreve os textos em português" arrow>
                <Button
                  variant="contained"
                  startIcon={collecting ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
                  onClick={collectNow}
                  disabled={collecting || loading || rewriting}
                >
                  {rewriting ? 'Reescrevendo…' : collecting ? 'Coletando…' : 'Coletar agora'}
                </Button>
              </Tooltip>
            )}
          </>
        }
      />

      {/* As seções viraram abas sobre uma linha, como as do catálogo. Envolvidas
          num cartão elas pareciam um controle segregado do conteúdo abaixo. */}
      <Box sx={{ mt: 2.5, borderBottom: `1px solid ${T.border.subtle}` }}>
        <Tabs value={section} onChange={(_, value) => { setSection(value); clearFilters(); }} variant="scrollable" scrollButtons="auto" aria-label="Seções do radar">
          {sections.map((entry) => <Tab key={entry.value} value={entry.value} label={entry.label} />)}
        </Tabs>
      </Box>
      <Typography variant="body2" sx={{ mt: 1.5, color: T.ink.muted }}>
        Escolha uma seção. Use a busca e os filtros apenas se quiser refinar o que aparece.
      </Typography>

      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap">
            <FilterListIcon sx={{ color: T.ink.muted, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ color: T.ink.strong }}>Filtros</Typography>
            <Typography variant="caption" sx={{ color: T.ink.subtle }}>A busca considera título, resumo, fonte, localidade e temas.</Typography>
          </Stack>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth size="small" label="Buscar" value={filters.query} onChange={setFilter('query')} placeholder="ex.: inteligência artificial" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}><FormControl fullWidth size="small"><InputLabel>Período</InputLabel><Select value={filters.period} label="Período" onChange={setFilter('period')}>{periodOptions.map((entry) => <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 12, md: 3 }}><FormControl fullWidth size="small"><InputLabel>Fonte</InputLabel><Select value={filters.source} label="Fonte" onChange={setFilter('source')}><MenuItem value="">Todas</MenuItem>{options.sources.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Local</InputLabel><Select value={filters.geography} label="Local" onChange={setFilter('geography')}><MenuItem value="">Todos</MenuItem>{[...new Set(items.map((item) => item.geography))].sort().map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Tema</InputLabel><Select value={filters.topic} label="Tema" onChange={setFilter('topic')}><MenuItem value="">Todos</MenuItem>{options.topics.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            <Grid size={{ xs: 6, md: 1 }}><FormControl fullWidth size="small"><InputLabel>Tipo</InputLabel><Select value={filters.contentType} label="Tipo" onChange={setFilter('contentType')}><MenuItem value="">Todos</MenuItem>{options.contentTypes.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mt: 1.5 }} gap={1}>
            <Button size="small" onClick={clearFilters}>Limpar filtros</Button>
          </Stack>
        </CardContent>
      </Card>

      {meta?.mode === 'curated-fallback' && <Alert severity="info" sx={{ mt: 2 }}>Algumas fontes estão temporariamente indisponíveis. Mostramos as informações públicas que já foram conferidas.</Alert>}
      {collectResult && (
        <Alert severity={collectResult.severity} sx={{ mt: 2 }} onClose={() => setCollectResult(null)}>
          {collectResult.message}
          {collectDiagnostics && (
            <Box component="details" sx={{ mt: 1 }}>
              <Box component="summary" sx={{ cursor: 'pointer', fontSize: '.82rem' }}>Detalhes técnicos da coleta</Box>
              <Box component="pre" sx={{ mt: 1, p: 1, maxHeight: 320, overflow: 'auto', bgcolor: 'rgba(0,0,0,.06)', borderRadius: 1, fontSize: '.72rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{collectDiagnostics}</Box>
            </Box>
          )}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }} role="status" aria-label="Carregando os itens do radar"><CircularProgress /></Box> : (
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {visibleItems.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: `border-color ${T.motion.fast}, box-shadow ${T.motion.fast}`, '&:hover': { borderColor: T.border.base, boxShadow: T.shadow.soft } }}>
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
                    <Box>
                      {/* Fonte oficial e fonte acadêmica se distinguem pelo tom
                          do rótulo. A faixa colorida de 4px que ficava no topo
                          de cada cartão saiu pelo mesmo motivo que a do
                          catálogo: com tudo marcado, nada fica marcado. */}
                      <Typography variant="overline" sx={{ color: item.official ? T.tools.radar.dark : T.tools.radar.main }}>{item.sourceName}</Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: T.ink.subtle }}>{item.contentType}</Typography>
                    </Box>
                    <Chip size="small" color={item.noveltyStatus === 'new' ? 'success' : 'info'} variant="outlined" label={item.noveltyLabel} />
                  </Stack>
                  {/* The editorial headline is what the card leads with; the
                      wording the source published stays one line below, so the
                      rewrite never costs the reader the original reference. */}
                  <Typography variant="h6" sx={{ mt: 1.25, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{item.displayTitle}</Typography>
                  {originalTitleOf(item) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>Título original: {originalTitleOf(item)}</Typography>}
                  <Divider sx={{ my: 1.5 }} />
                  {item.displaySummary ? (
                    <>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.35, color: T.tools.radar.dark, fontWeight: 800 }}>{summaryLabel(item)}</Typography>
                      <Typography color="text.secondary" sx={{ fontSize: '0.9rem', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{item.displaySummary}</Typography>
                      {item.rawSourceText && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic' }}>Texto reproduzido da fonte; a versão editorial em português ainda não foi gerada para este item.</Typography>}
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">A fonte não disponibilizou um resumo deste item.</Typography>
                  )}
                  <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ mt: 1.5 }}>{item.topics.map((topic) => <Chip key={topic} size="small" label={topic} variant="outlined" />)}</Stack>
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
      {!loading && !error && visibleItems.length === 0 && (
        <EmptyState
          icon={<RadarIcon />}
          title={items.length > 0 ? 'Nenhuma novidade para estes filtros' : 'Ainda não há novidades nesta seção'}
          description={
            items.length > 0
              ? 'Nenhuma novidade atende a todos os filtros escolhidos. Amplie o período ou remova um filtro.'
              : 'Tente novamente mais tarde.'
          }
          action={items.length > 0 ? clearFilters : undefined}
          actionLabel="Limpar os filtros"
        />
      )}
      <Typography variant="caption" sx={{ display: 'block', mt: 4, color: T.ink.subtle }}>Os cartões resumem informações públicas em português claro. Use Abrir fonte original para conferir o documento completo.</Typography>
    </PageContainer>
  );
}
