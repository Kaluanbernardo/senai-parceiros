import React, { useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MergeIcon from '@mui/icons-material/Merge';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_LABELS } from '../domain/interview';
import { ORGANIZATION_SUBTYPES, PERSON_SUBTYPES } from '../domain/catalogTaxonomy';
import { useData } from '../context/DataContext';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import SectionCard from '../design-system/primitives/SectionCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const EMPTY_FORM = Object.freeze({
  category: 'person',
  subtype: '',
  context: '',
  purpose: '',
  geography: '',
  quantity: 1,
  extraCriteria: '',
  sourcePreferences: 'auto',
});

const SOURCE_OPTIONS = Object.freeze([
  ['auto', 'Melhores fontes disponíveis'],
  ['official', 'Sites oficiais e fontes governamentais'],
  ['academic', 'Bases acadêmicas e publicações'],
  ['industry', 'Entidades setoriais e imprensa especializada'],
  ['professional', 'Perfis profissionais e institucionais'],
]);

const SUBTYPES = Object.freeze({ person: PERSON_SUBTYPES, organization: ORGANIZATION_SUBTYPES });

const DECISION_LABELS = Object.freeze({
  use_imported: 'Adicionar',
  merge: 'Mesclar',
  keep_existing: 'Manter atual',
  ignore: 'Descartar',
});

function errorMessage(body) {
  if (body?.error === 'too_many_research_attempts') return 'Muitas pesquisas em sequência. Aguarde alguns minutos antes de tentar novamente.';
  if (body?.error === 'ai_budget_exceeded') return 'O limite diário de uso da IA foi atingido.';
  if (body?.reason === 'ai_not_configured') return 'A pesquisa por IA não está configurada neste ambiente.';
  if (body?.reason === 'provider_timeout') return 'A pesquisa demorou mais que o limite. Tente novamente com um pedido mais específico.';
  if (body?.reason === 'output_truncated') return 'A resposta ficou grande demais. Reduza a quantidade de sugestões e tente novamente.';
  if (body?.error === 'research_context_required') return 'Descreva o que você procura.';
  return 'Não foi possível concluir a pesquisa. Tente novamente.';
}

function statusLabel(row) {
  if (row.status === 'invalid') return 'Evidência insuficiente';
  if (row.status === 'possible_duplicate') return 'Possível duplicidade';
  if (row.status === 'already_imported') return 'Já processado';
  return 'Novo';
}

function sourceLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function ResearchCandidateCard({ row, decision, onDecision }) {
  const record = row.record || {};
  const invalid = row.status === 'invalid';
  const duplicate = row.status === 'possible_duplicate';
  const importedDuplicate = duplicate && row.match?.source === 'imported';
  const sources = Array.isArray(record.fontes) ? record.fontes : [];
  const areas = Array.isArray(record.areas) ? record.areas : [];
  const missing = Array.isArray(record.dados_nao_localizados) ? record.dados_nao_localizados : [];
  const subtitle = record.instituicao || record.tipo_instituicao || record.setor || record.cidade_estado || '';
  const selectedTone = ['use_imported', 'merge'].includes(decision) ? 'success' : decision === 'keep_existing' ? 'info' : 'default';

  return (
    <SectionCard sx={{ height: '100%', borderColor: ['use_imported', 'merge'].includes(decision) ? T.feedback.success : T.border.subtle }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: T.tools.research.dark }}>{record.subtipo || CATEGORY_LABELS[record.categoria === 'Pessoa Física' ? 'person' : 'organization']}</Typography>
            <Typography variant="h5" sx={{ mt: .25 }}>{record.nome || record.instituicao}</Typography>
            <Typography variant="body2" sx={{ mt: .35, color: T.ink.muted }}>{[subtitle, record.pais].filter(Boolean).join(' · ')}</Typography>
          </Box>
          <Stack direction="row" gap={.75} flexWrap="wrap" justifyContent="flex-end">
            <Chip size="small" label={statusLabel(row)} color={invalid ? 'error' : duplicate ? 'warning' : 'default'} />
            {record.confianca !== null && record.confianca !== undefined && <Chip size="small" variant="outlined" label={`${record.confianca}% confiança`} />}
          </Stack>
        </Stack>

        <Typography variant="body2" sx={{ mt: 1.5, color: T.ink.base }}>{record.diferencial || record.descricao}</Typography>
        {record.descricao && record.descricao !== record.diferencial && <Typography variant="body2" sx={{ mt: 1, color: T.ink.muted }}>{record.descricao}</Typography>}

        {areas.length > 0 && <Stack direction="row" gap={.75} flexWrap="wrap" sx={{ mt: 1.5 }}>{areas.slice(0, 6).map((area) => <Chip key={area} size="small" variant="outlined" label={area} />)}</Stack>}

        {duplicate && <Alert severity="warning" sx={{ mt: 2 }}>Já existe correspondência com <strong>{row.match?.name}</strong>. {importedDuplicate ? 'Você pode mesclar os dados pesquisados ou manter o cadastro atual.' : 'O cadastro existente será preservado neste MVP.'}</Alert>}
        {invalid && <Alert severity="error" sx={{ mt: 2 }}>{(row.errors || []).join(' ')}</Alert>}
        {missing.length > 0 && <Alert severity="info" sx={{ mt: 2 }}>Não localizado: {missing.join(', ')}.</Alert>}

        <Box sx={{ mt: 2, flex: 1 }}>
          <Typography variant="subtitle2">Fontes consultadas</Typography>
          {sources.length ? (
            <Stack component="ul" gap={.5} sx={{ pl: 2.5, mt: .75, mb: 0 }}>
              {sources.map((source) => (
                <Typography component="li" variant="body2" key={source}>
                  <Link href={source} target="_blank" rel="noopener noreferrer" underline="hover">{sourceLabel(source)} <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'middle' }} /></Link>
                </Typography>
              ))}
            </Stack>
          ) : <Typography variant="body2" sx={{ mt: .5, color: T.ink.muted }}>Nenhuma fonte válida.</Typography>}
        </Box>

        <Divider sx={{ my: 2 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Chip size="small" color={selectedTone} variant={selectedTone === 'default' ? 'outlined' : 'filled'} label={`Decisão: ${DECISION_LABELS[decision] || 'Pendente'}`} />
          {!invalid && !duplicate && row.status !== 'already_imported' && (
            <Stack direction="row" gap={1}>
              <Button size="small" variant={decision === 'ignore' ? 'contained' : 'outlined'} color="inherit" startIcon={<CloseIcon />} onClick={() => onDecision('ignore')}>Descartar</Button>
              <Button size="small" variant={decision === 'use_imported' ? 'contained' : 'outlined'} color="success" startIcon={<CheckCircleOutlineIcon />} onClick={() => onDecision('use_imported')}>Adicionar</Button>
            </Stack>
          )}
          {importedDuplicate && (
            <Stack direction="row" gap={1}>
              <Button size="small" variant={decision === 'keep_existing' ? 'contained' : 'outlined'} color="inherit" onClick={() => onDecision('keep_existing')}>Manter atual</Button>
              <Button size="small" variant={decision === 'merge' ? 'contained' : 'outlined'} color="success" startIcon={<MergeIcon />} onClick={() => onDecision('merge')}>Mesclar</Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </SectionCard>
  );
}

export default function CatalogResearchPage() {
  const navigate = useNavigate();
  const data = useData();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const approvedCount = useMemo(() => Object.values(decisions).filter((decision) => ['use_imported', 'merge'].includes(decision)).length, [decisions]);
  const previewSummary = useMemo(() => {
    const rows = preview?.rows || [];
    const sources = new Set(rows.flatMap((row) => Array.isArray(row.record?.fontes) ? row.record.fontes : []));
    return { cards: rows.length, sources: sources.size };
  }, [preview]);

  const change = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  async function research(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const response = await fetch('/api/admin/catalog-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body));
      setPreview(body);
      setDecisions(Object.fromEntries((body.rows || []).map((row) => [
        String(row.rowNumber),
        row.status === 'possible_duplicate' ? 'keep_existing' : 'ignore',
      ])));
    } catch (requestError) {
      setPreview(null);
      setError(requestError.message || 'Não foi possível concluir a pesquisa.');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview || approvedCount === 0) return;
    setError('');
    setCommitBusy(true);
    try {
      const response = await fetch('/api/admin/catalog-import-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ batchId: preview.batchId, decisions }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Falha ao adicionar os registros aprovados.');
      data.mergeImportedRecords(body.category, body.records || []);
      if (body.category === 'person' && body.applied?.length) {
        await fetch('/api/radar/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
      }
      const applied = body.applied?.length || 0;
      setSuccess(`${applied} ${applied === 1 ? 'registro foi adicionado' : 'registros foram adicionados'} ao catálogo. O lote pode ser desfeito no histórico administrativo.`);
      setPreview(null);
      setDecisions({});
    } catch (commitError) {
      setError(commitError.message || 'Falha ao adicionar os registros aprovados.');
    } finally {
      setCommitBusy(false);
    }
  }

  return (
    <PageContainer width="wide" tool="research">
      <PageHeader
        eyebrow="PESQUISA PARA O CATÁLOGO"
        title="Encontre novos parceiros com pesquisa assistida"
        description="A plataforma pesquisa fontes públicas e prepara sugestões. Nada entra no catálogo sem sua aprovação card por card."
        accent="research"
        dense
      />

      {error && <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate('/catalogo')}>Ver catálogo</Button>}>{success}</Alert>}

      <SectionCard component="form" onSubmit={research} sx={{ mt: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack gap={3}>
            <Box>
              <Typography variant="overline" sx={{ color: T.tools.research.dark }}>1. Quem você quer encontrar?</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={form.category}
                onChange={(_, value) => value && setForm((previous) => ({ ...previous, category: value, subtype: '' }))}
                disabled={busy}
                aria-label="Tipo de parceiro"
                sx={{ mt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <ToggleButton key={value} value={value} sx={{ py: 1.35, textTransform: 'none', fontWeight: 700 }}>{label}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Subtipo (opcional)</InputLabel>
                <Select
                  label="Subtipo (opcional)"
                  value={form.subtype}
                  onChange={(event) => change('subtype', event.target.value)}
                  disabled={busy}
                >
                  <MenuItem value="">Todos os subtipos</MenuItem>
                  {SUBTYPES[form.category].map((subtype) => <MenuItem key={subtype} value={subtype}>{subtype}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: T.tools.research.dark }}>2. O que você procura?</Typography>
              <TextField
                required
                fullWidth
                multiline
                minRows={3}
                placeholder="Ex.: especialistas em inteligência artificial aplicada à manufatura, com atuação comprovada em projetos industriais"
                value={form.context}
                onChange={(event) => change('context', event.target.value)}
                disabled={busy}
                inputProps={{ 'aria-label': 'O que você procura?' }}
                sx={{ mt: 1 }}
              />
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Fontes preferidas</InputLabel>
                  <Select label="Fontes preferidas" value={form.sourcePreferences} onChange={(event) => change('sourcePreferences', event.target.value)} disabled={busy}>
                    {SOURCE_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 7, md: 4 }}>
                <TextField fullWidth label="País ou idioma (opcional)" value={form.geography} onChange={(event) => change('geography', event.target.value)} disabled={busy} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Resultados</InputLabel>
                  <Select label="Resultados" value={form.quantity} onChange={(event) => change('quantity', Number(event.target.value))} disabled={busy}>
                    {[1, 2, 3].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Accordion disableGutters elevation={0} sx={{ border: `1px solid ${T.border.subtle}`, borderRadius: '12px !important', '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="research-refinements-content" id="research-refinements-header">
                <Stack direction="row" gap={1} alignItems="center"><TuneIcon fontSize="small" /><Typography variant="subtitle2">Refinar pesquisa (opcional)</Typography></Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="Como pretende usar o resultado?" value={form.purpose} onChange={(event) => change('purpose', event.target.value)} disabled={busy} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="Critérios de inclusão" value={form.extraCriteria} onChange={(event) => change('extraCriteria', event.target.value)} disabled={busy} />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
              <Typography variant="caption" sx={{ color: T.ink.subtle }}>A busca consulta fontes públicas, gera até três cards e pode levar cerca de 55 segundos.</Typography>
              <Button type="submit" variant="contained" size="large" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />} disabled={busy || !form.context.trim()} sx={{ minWidth: 220, bgcolor: T.tools.research.main, '&:hover': { bgcolor: T.tools.research.dark } }}>
                {busy ? 'Buscando e verificando…' : 'Buscar na web'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </SectionCard>

      <Box sx={{ mt: 3 }}>
          {!preview && !busy && !success && (
            <SectionCard sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
              <Box sx={{ p: 4, maxWidth: 560, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 46, color: T.tools.research.main }} />
                <Typography variant="h5" sx={{ mt: 1 }}>Os resultados aparecerão aqui para revisão</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: T.ink.muted }}>Cada card mostrará fontes, lacunas, confiança e possíveis duplicidades. Todos começam descartados até você aprová-los.</Typography>
              </Box>
            </SectionCard>
          )}
          {busy && <SectionCard sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" gap={2} sx={{ p: 4 }}><CircularProgress /><Typography>Pesquisando e conferindo fontes públicas…</Typography></Stack></SectionCard>}
          {preview && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h5">Revise as sugestões</Typography>
                  <Typography variant="body2" sx={{ mt: .35, color: T.ink.muted }}>
                    {previewSummary.cards} {previewSummary.cards === 1 ? 'card encontrado' : 'cards encontrados'} · {previewSummary.sources} {previewSummary.sources === 1 ? 'fonte consultada' : 'fontes consultadas'}
                  </Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={commitBusy ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />} disabled={commitBusy || approvedCount === 0} onClick={commit}>
                  Adicionar aprovados ({approvedCount})
                </Button>
              </Stack>
              <Grid container spacing={2}>
                {(preview.rows || []).map((row) => (
                  <Grid size={{ xs: 12 }} key={row.hash || row.rowNumber}>
                    <ResearchCandidateCard row={row} decision={decisions[String(row.rowNumber)] || 'ignore'} onDecision={(decision) => setDecisions((previous) => ({ ...previous, [String(row.rowNumber)]: decision }))} />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
      </Box>
    </PageContainer>
  );
}
