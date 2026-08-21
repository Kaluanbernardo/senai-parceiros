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
import Collapse from '@mui/material/Collapse';
import { Link as RouterLink } from 'react-router-dom';
import { countUndatedItems, filterRadarItems, RADAR_SECTIONS } from '../domain/radar';
import { describeRadarSnapshot, radarCatalogQuery } from '../domain/radarStatus';
import { isOfficialAct } from '../domain/radarEditorial';
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
  /** Nome curto, para caber dentro de uma frase sem virar caixa baixa forçada. */
  short: {
    research: 'as pesquisas e estudos',
    government: 'as publicações do Brasil e de São Paulo',
    international: 'as publicações internacionais',
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
      // `provider_4xx` agrupa chave revogada, crédito esgotado e payload
      // recusado sob o mesmo rótulo; o status HTTP é o que os separa.
      return `${entry.name} (${reason}${entry.httpStatus ? `, HTTP ${entry.httpStatus}` : ''})`;
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
  if (item.section === 'research') return 'Resumo do estudo';
  if (isOfficialAct(item)) return 'Entenda o ato';
  return item.editorialSummary ? 'O que isso significa' : 'Por que está no Radar';
}

function originalTitleLabel(item) {
  return isOfficialAct(item) ? 'Título publicado no Diário Oficial' : 'Título original';
}

function editorialFailureMessage(error) {
  if (error === 'radar_editorial_budget_exceeded') {
    return 'O limite interno diário de IA do Radar foi atingido. A coleta foi preservada; tente novamente após a renovação do limite.';
  }
  if (error === 'radar_editorial_provider_disabled') return 'A reescrita editorial do Radar não está habilitada.';
  return 'Nenhum texto foi reescrito.';
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
  const [moreFilters, setMoreFilters] = useState(false);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const [filters, setFilters] = useState({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '' });

  const activeSection = sections.find((entry) => entry.value === section) || sections[0];

  /**
   * Uma leitura só, sem seção.
   *
   * A leitura do Radar nunca consulta fonte externa — o parâmetro `section` do
   * endpoint apenas recortava o mesmo snapshot que o cliente já sabe recortar.
   * Buscando tudo de uma vez, trocar de seção deixa de custar uma requisição e
   * uma espera, e as abas passam a poder dizer quantos itens têm antes de
   * alguém clicar nelas para descobrir que estão vazias.
   */
  const loadItems = async ({ quiet = false } = {}) => {
    // A quiet reload refreshes the cards without blanking the grid, which is
    // what lets the rewrite phase show its progress on the items themselves.
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/radar/items', { credentials: 'include', cache: 'no-store' });
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

  useEffect(() => { loadItems(); }, []);

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
        const errorCode = body.error || status?.error || status?.errors?.[0];
        // `provider_4xx` por si só agrupa causas com correções bem diferentes —
        // chave revogada, crédito esgotado, payload recusado. O status HTTP que
        // veio junto é o que separa uma da outra sem abrir os detalhes técnicos.
        const httpStatus = body.httpStatus ?? status?.httpStatus;
        const detail = errorCode && !['radar_editorial_budget_exceeded', 'radar_editorial_provider_disabled'].includes(errorCode)
          ? ` Motivo: ${errorCode}${httpStatus ? ` (HTTP ${httpStatus})` : ''}.`
          : '';
        return { severity: 'warning', message: `${editorialFailureMessage(errorCode)}${detail}`, lastRun };
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

  // As opções de filtro descrevem a seção aberta, não o acervo inteiro: uma
  // lista de fontes com as três seções juntas oferece recortes que resultam em
  // zero na seção em que a pessoa está.
  const sectionItems = useMemo(() => filterRadarItems(items, { section }), [items, section]);

  const options = useMemo(() => ({
    sources: [...new Set(sectionItems.map((item) => item.sourceName))].sort(),
    topics: [...new Set(sectionItems.flatMap((item) => item.topics))].sort(),
    contentTypes: [...new Set(sectionItems.map((item) => item.contentType))].sort(),
    geographies: [...new Set(sectionItems.map((item) => item.geography))].filter(Boolean).sort(),
  }), [sectionItems]);

  const sectionCounts = useMemo(
    () => Object.fromEntries(RADAR_SECTIONS.map((value) => [value, filterRadarItems(items, { section: value }).length])),
    [items],
  );

  const snapshot = useMemo(() => describeRadarSnapshot(meta), [meta]);
  // Para onde mandar quem caiu numa seção vazia: a primeira seção que de fato
  // tem itens, se houver alguma.
  const populatedSection = sections.find((entry) => entry.value !== section && (sectionCounts[entry.value] || 0) > 0) || null;

  const visibleItems = useMemo(() => filterRadarItems(items, { ...filters, section }), [items, filters, section]);
  // A narrow window hides undated items by design; saying so keeps the omission
  // from looking like the source simply published nothing.
  const undatedCount = useMemo(() => countUndatedItems(sectionItems), [sectionItems]);
  const undatedHidden = undatedCount > 0 && filters.period !== '1y';
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => setFilters({ query: '', period: '1y', topic: '', source: '', geography: '', contentType: '' });
  // O contador cobre só o que está recolhido: busca e período ficam visíveis e
  // não precisam ser anunciados por um número.
  const extraFilterCount = [filters.source, filters.geography, filters.topic, filters.contentType].filter(Boolean).length;

  return (
    <PageContainer width="wide" tool="radar">
      <PageHeader
        eyebrow="RADAR"
        title="Acompanhe o que está mudando"
        description={activeSection.description}
        accent="radar"
        dense
        // "Recarregar" desceu para a barra de estado da coleta, ao lado da
        // informação que ele atualiza. Aqui em cima, com o mesmo peso de
        // "Coletar agora", as duas ações pareciam alternativas equivalentes —
        // uma relê o snapshot em milissegundos, a outra consulta dez fontes
        // externas por minutos e gasta orçamento de IA.
        actions={
          isAdmin ? (
            <Tooltip describeChild title="Consulta as fontes oficiais, grava um novo snapshot e reescreve os textos em português" arrow>
              <span>
                <Button
                  variant="contained"
                  startIcon={collecting ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
                  onClick={collectNow}
                  disabled={collecting || loading || rewriting}
                >
                  {rewriting ? 'Reescrevendo…' : collecting ? 'Coletando…' : 'Coletar agora'}
                </Button>
              </span>
            </Tooltip>
          ) : null
        }
      />

      {/* Estado da coleta, permanente.
          É a primeira pergunta de quem abre um radar — "isto está atualizado?"
          — e a única que a tela não respondia. O dado já vinha em toda leitura
          e só aparecia depois de uma coleta manual, dentro de um alerta. */}
      <Alert
        severity={snapshot.severity}
        icon={<CloudSyncIcon fontSize="inherit" />}
        sx={{ mt: 2.5, alignItems: 'center' }}
        action={
          <Stack direction="row" gap={1} alignItems="center">
            {snapshot.failures.length > 0 && (
              <Button size="small" color="inherit" onClick={() => setFailuresOpen((current) => !current)} aria-expanded={failuresOpen}>
                {failuresOpen ? 'Ocultar' : 'Ver o que falhou'}
              </Button>
            )}
            <Tooltip describeChild title="Relê o snapshot atual, sem consultar as fontes externas" arrow>
              <span>
                <Button size="small" color="inherit" startIcon={<RefreshIcon />} onClick={loadItems} disabled={loading || collecting || rewriting}>
                  Recarregar
                </Button>
              </span>
            </Tooltip>
          </Stack>
        }
      >
        <Typography variant="body2">
          {snapshot.never
            ? 'Nenhuma coleta registrada neste ambiente.'
            : <>Última coleta {snapshot.collectedAtLabel}
                {snapshot.itemCount !== null ? ` · ${snapshot.itemCount} ${snapshot.itemCount === 1 ? 'item' : 'itens'}` : ''}
                {snapshot.sourcesTotal ? ` · ${snapshot.sourcesOk} de ${snapshot.sourcesTotal} fontes responderam` : ''}
                {snapshot.stale ? ' · a última tentativa falhou e este snapshot foi preservado' : ''}
                {snapshot.volatile ? ' · snapshot apenas em memória, será perdido na próxima requisição' : ''}</>}
        </Typography>
        <Collapse in={failuresOpen}>
          <Stack component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }} gap={.25}>
            {snapshot.failures.map((failure) => (
              <Typography component="li" variant="caption" key={failure.name}>
                {failure.name}: {failure.reason}{failure.httpStatus ? ` (HTTP ${failure.httpStatus})` : ''}
              </Typography>
            ))}
          </Stack>
        </Collapse>
      </Alert>

      {/* As seções viraram abas sobre uma linha, como as do catálogo. Envolvidas
          num cartão elas pareciam um controle segregado do conteúdo abaixo. */}
      <Box sx={{ mt: 2.5, borderBottom: `1px solid ${T.border.subtle}` }}>
        <Tabs value={section} onChange={(_, value) => { setSection(value); clearFilters(); }} variant="scrollable" scrollButtons="auto" aria-label="Seções do radar">
          {/* A contagem na aba evita o percurso "clicar, esperar, descobrir que
              está vazia" — que é como se descobria antes. */}
          {sections.map((entry) => (
            <Tab key={entry.value} value={entry.value} label={loading ? entry.label : `${entry.label} · ${sectionCounts[entry.value] ?? 0}`} />
          ))}
        </Tabs>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} sx={{ mt: 2 }}>
        <TextField
          size="small"
          label="Buscar"
          value={filters.query}
          onChange={setFilter('query')}
          placeholder="ex.: inteligência artificial"
          sx={{ flex: 1, minWidth: 0 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>Período</InputLabel>
          <Select value={filters.period} label="Período" onChange={setFilter('period')}>
            {periodOptions.map((entry) => <MenuItem key={entry.value} value={entry.value}>{entry.label}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Busca e período cobrem a maioria dos usos e ficam à vista; fonte,
            local, tema e tipo entram sob demanda. Seis seletores abertos sobre
            uma lista vazia era o pior arranjo possível, e o catálogo já resolve
            a mesma tarefa deste jeito — dois padrões diferentes para a mesma
            coisa é o que confunde. */}
        <Button
          startIcon={<FilterListIcon />}
          variant={extraFilterCount > 0 ? 'contained' : 'outlined'}
          onClick={() => setMoreFilters((current) => !current)}
          aria-expanded={moreFilters}
          aria-controls="mais-filtros-do-radar"
          sx={{ flexShrink: 0 }}
        >
          {extraFilterCount > 0 ? `Filtros (${extraFilterCount})` : 'Mais filtros'}
        </Button>
        <Typography variant="body2" sx={{ color: T.ink.muted, whiteSpace: 'nowrap' }}>
          {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
        </Typography>
      </Stack>

      <Collapse in={moreFilters} id="mais-filtros-do-radar">
        <Card sx={{ mt: 1.5 }}>
          <CardContent>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 4 }}><FormControl fullWidth size="small"><InputLabel>Fonte</InputLabel><Select value={filters.source} label="Fonte" onChange={setFilter('source')}><MenuItem value="">Todas</MenuItem>{options.sources.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
              <Grid size={{ xs: 12, sm: 4, md: 8 / 3 }}><FormControl fullWidth size="small"><InputLabel>Local</InputLabel><Select value={filters.geography} label="Local" onChange={setFilter('geography')}><MenuItem value="">Todos</MenuItem>{options.geographies.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
              <Grid size={{ xs: 12, sm: 4, md: 8 / 3 }}><FormControl fullWidth size="small"><InputLabel>Tema</InputLabel><Select value={filters.topic} label="Tema" onChange={setFilter('topic')}><MenuItem value="">Todos</MenuItem>{options.topics.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
              <Grid size={{ xs: 12, sm: 4, md: 8 / 3 }}><FormControl fullWidth size="small"><InputLabel>Tipo</InputLabel><Select value={filters.contentType} label="Tipo" onChange={setFilter('contentType')}><MenuItem value="">Todos</MenuItem>{options.contentTypes.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Grid>
            </Grid>
            <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mt: 1.5 }} gap={1}>
              <Button size="small" onClick={clearFilters}>Limpar filtros</Button>
            </Stack>
          </CardContent>
        </Card>
      </Collapse>

      {meta?.mode === 'curated-fallback' && <Alert severity="info" sx={{ mt: 2 }}>Algumas fontes estão temporariamente indisponíveis. Mostramos as informações públicas que já foram conferidas.</Alert>}
      {/* O recorte por período esconde os itens sem data por definição. Dizer
          isso é o que separa "a janela é estreita" de "a fonte não publicou
          nada" — a conta já era feita e nunca chegava à tela. */}
      {undatedHidden && (
        <Alert severity="info" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => setFilters((current) => ({ ...current, period: '1y' }))}>Ver os últimos 12 meses</Button>}>
          {undatedCount} {undatedCount === 1 ? 'item institucional sem data está oculto' : 'itens institucionais sem data estão ocultos'} por causa do período escolhido.
        </Alert>
      )}
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
                  {originalTitleOf(item) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>{originalTitleLabel(item)}: {originalTitleOf(item)}</Typography>}
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
                <Stack direction="row" gap={1} flexWrap="wrap" sx={{ px: 2, pb: 2 }}>
                  {item.sourceUrl ? <Button href={item.sourceUrl} target="_blank" rel="noreferrer" size="small" endIcon={<OpenInNewIcon />} startIcon={<ArticleOutlinedIcon />}>Abrir fonte original</Button> : <Typography variant="caption" color="text.secondary">Fonte original não localizada</Typography>}
                  {/* Liga as duas metades do produto: o Radar diz o que mudou,
                      o catálogo diz com quem falar sobre isso. Antes as duas
                      conviviam sem se tocar. */}
                  {radarCatalogQuery(item) && (
                    <Button
                      size="small"
                      component={RouterLink}
                      to={`/catalogo/pessoas-fisicas?q=${encodeURIComponent(radarCatalogQuery(item))}`}
                    >
                      Quem trabalha com isso
                    </Button>
                  )}
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {/* O vazio precisa dizer a causa certa. Comparar contra o acervo inteiro
          fazia uma seção sem nenhum item coletado ser anunciada como "nenhuma
          novidade para estes filtros", oferecendo limpar filtros que não
          existiam — e escondendo que a coleta é que não trouxe nada ali. */}
      {!loading && !error && visibleItems.length === 0 && (
        sectionItems.length > 0 ? (
          <EmptyState
            icon={<RadarIcon />}
            title="Nenhuma novidade para estes filtros"
            description={`A seção tem ${sectionItems.length} ${sectionItems.length === 1 ? 'item' : 'itens'}, mas nenhum atende a todos os filtros escolhidos. Amplie o período ou remova um filtro.`}
            action={clearFilters}
            actionLabel="Limpar os filtros"
          />
        ) : (
          <EmptyState
            icon={<RadarIcon />}
            title="A última coleta não trouxe itens para esta seção"
            description={
              populatedSection
                ? `As outras seções têm novidades. ${activeSection.label} depende de fontes que não responderam ou não publicaram nada no período coletado.`
                : 'Nenhuma seção tem itens no snapshot atual. Uma nova coleta pode trazer novidades.'
            }
            action={populatedSection ? () => { setSection(populatedSection.value); clearFilters(); } : undefined}
            actionLabel={populatedSection ? `Ver ${populatedSection.short}` : undefined}
          />
        )
      )}
      <Typography variant="caption" sx={{ display: 'block', mt: 4, color: T.ink.subtle }}>Os cartões resumem informações públicas em português claro. Use Abrir fonte original para conferir o documento completo.</Typography>
    </PageContainer>
  );
}
