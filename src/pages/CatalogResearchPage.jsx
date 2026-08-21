import React, { useMemo, useState } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import { ImportReviewGrid, ImportReviewToolbar } from '../components/catalog/ImportReview';
import { CATEGORY_LABELS } from '../domain/interview';
import { ORGANIZATION_SUBTYPES, PERSON_SUBTYPES } from '../domain/catalogTaxonomy';
import { useData } from '../context/DataContext';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import SectionCard from '../design-system/primitives/SectionCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import {
  CATALOG_RESEARCH_GEOGRAPHIES,
  CATALOG_RESEARCH_QUANTITIES,
  flattenResearchPreviews,
  groupApprovedResearchDecisions,
  researchDecisionKey,
  runCatalogResearchBatches,
} from '../domain/catalogResearchFlow';
import { countApprovedDecisions } from '../domain/catalogResearchReview';
import { buildLegalEntityCatalog } from '../domain/legalEntityCatalog';

const EMPTY_FORM = Object.freeze({
  category: 'person',
  subtype: '',
  context: '',
  purpose: '',
  geography: 'brasil',
  quantity: 5,
  prioritizationFactors: '',
  exclusionFactors: '',
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

function errorMessage(body) {
  if (body?.error === 'too_many_research_attempts') return 'Muitas pesquisas em sequência. Aguarde alguns minutos antes de tentar novamente.';
  if (body?.error === 'ai_budget_exceeded') return 'O limite diário de uso da IA foi atingido.';
  if (body?.reason === 'ai_not_configured') return 'A pesquisa por IA não está configurada neste ambiente.';
  if (body?.reason === 'provider_timeout') return 'Um lote demorou mais que o limite. Os cards já concluídos foram preservados; tente continuar a pesquisa.';
  if (body?.reason === 'output_truncated') return 'Um lote ficou grande demais. Os cards já concluídos foram preservados; tente continuar a pesquisa.';
  if (body?.error === 'research_subtype_required') return 'Selecione como deseja refinar a pesquisa.';
  if (body?.error === 'research_context_required') return 'Descreva o que você procura.';
  return 'Não foi possível concluir a pesquisa. Tente novamente.';
}

export default function CatalogResearchPage() {
  const navigate = useNavigate();
  const data = useData();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [previews, setPreviews] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const rows = useMemo(() => flattenResearchPreviews(previews), [previews]);
  const approvedCount = countApprovedDecisions(decisions);
  const previewSummary = { cards: rows.length };
  const missingRequirement = !form.subtype
    ? 'Escolha um tipo de parceiro no passo 1 para começar.'
    : !form.context.trim()
      ? 'Descreva o que você procura no passo 2 para começar.'
      : '';

  /**
   * O registro que já está no catálogo, para a duplicata poder ser comparada.
   * O servidor devolve só o nome e o id do que casou; a ficha inteira já está
   * carregada aqui, e é ela que permite decidir entre manter e mesclar.
   */
  const existingById = useMemo(() => {
    const records = form.category === 'person'
      ? data.pesquisadores || []
      : buildLegalEntityCatalog({ schools: data.escolas || [], stakeholders: data.stakeholders || [] });
    return new Map(records.map((record) => [String(record.id), record._original || record]));
  }, [form.category, data.pesquisadores, data.escolas, data.stakeholders]);

  const change = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setPreviews([]);
    setDecisions({});
    setError('');
  };

  const changeCategory = (category) => {
    setForm((previous) => ({ ...previous, category, subtype: '' }));
    setPreviews([]);
    setDecisions({});
    setError('');
  };

  async function research(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    let workingPreviews = [...previews];
    try {
      const result = await runCatalogResearchBatches({
        initialPreviews: workingPreviews,
        requestedQuantity: form.quantity,
        requestBatch: async (batch) => {
          const response = await fetch('/api/admin/catalog-research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ...form, ...batch }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(errorMessage(body));
          return body;
        },
        onBatch: (nextPreviews, body) => {
          workingPreviews = nextPreviews;
          setPreviews(nextPreviews);
          setDecisions((previous) => ({
            ...previous,
            ...Object.fromEntries((body.rows || []).map((row) => [
              researchDecisionKey(body.batchId, row.rowNumber),
              row.status === 'possible_duplicate' ? 'keep_existing' : 'ignore',
            ])),
          }));
        },
      });
      if (!result.complete) setError(`A pesquisa encontrou ${result.cards} de ${form.quantity} cards com evidência suficiente. Você pode continuar para buscar os restantes.`);
    } catch (requestError) {
      const preserved = flattenResearchPreviews(workingPreviews).length;
      setError(`${requestError.message || 'Não foi possível concluir a pesquisa.'}${preserved ? ` ${preserved} cards já concluídos foram preservados.` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    const approvedBatches = groupApprovedResearchDecisions(previews, decisions);
    if (!approvedBatches.length || approvedCount === 0) return;
    setError('');
    setCommitBusy(true);
    let applied = 0;
    let refreshRadar = false;
    try {
      for (const batch of approvedBatches) {
        const response = await fetch('/api/admin/catalog-import-commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(batch),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Falha ao adicionar os registros aprovados.');
        data.mergeImportedRecords(body.category, body.records || []);
        applied += body.applied?.length || 0;
        refreshRadar ||= body.category === 'person' && Boolean(body.applied?.length);
        setPreviews((previous) => previous.filter((preview) => preview.batchId !== batch.batchId));
        setDecisions((previous) => {
          const remaining = { ...previous };
          Object.keys(batch.decisions).forEach((rowNumber) => {
            delete remaining[researchDecisionKey(batch.batchId, rowNumber)];
          });
          return remaining;
        });
      }
      if (refreshRadar) await fetch('/api/radar/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
      setSuccess(`${applied} ${applied === 1 ? 'registro foi adicionado' : 'registros foram adicionados'} ao catálogo. Cada lote pode ser desfeito no histórico administrativo.`);
      setDecisions({});
    } catch (commitError) {
      setError(`${commitError.message || 'Falha ao adicionar os registros aprovados.'}${applied ? ` ${applied} registros anteriores já foram adicionados.` : ''}`);
    } finally {
      setCommitBusy(false);
    }
  }

  return (
    <PageContainer width="wide" tool="research">
      <PageHeader
        eyebrow="PESQUISA PARA O CATÁLOGO"
        title="Encontre novos parceiros com pesquisa profunda"
        description="A plataforma cruza fontes públicas, prepara cards completos e preserva cada lote concluído. Nada entra no catálogo sem sua aprovação card por card."
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
                onChange={(_, value) => value && changeCategory(value)}
                disabled={busy}
                aria-label="Tipo de parceiro"
                sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <ToggleButton key={value} value={value} sx={{ py: 1.35, textTransform: 'none', fontWeight: 700 }}>{label}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <FormControl required fullWidth sx={{ mt: 2 }}>
                <InputLabel>Que tipo de parceiro?</InputLabel>
                <Select
                  required
                  label="Que tipo de parceiro?"
                  value={form.subtype}
                  onChange={(event) => change('subtype', event.target.value)}
                  disabled={busy}
                >
                  <MenuItem value="" disabled>Selecione o perfil desejado</MenuItem>
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
              <Grid size={{ xs: 12, md: 5 }}>
                <FormControl fullWidth>
                  <InputLabel>Fontes preferidas</InputLabel>
                  <Select label="Fontes preferidas" value={form.sourcePreferences} onChange={(event) => change('sourcePreferences', event.target.value)} disabled={busy}>
                    {SOURCE_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 7, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Escopo geográfico</InputLabel>
                  <Select label="Escopo geográfico" value={form.geography} onChange={(event) => change('geography', event.target.value)} disabled={busy}>
                    {CATALOG_RESEARCH_GEOGRAPHIES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 5, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Resultados</InputLabel>
                  <Select label="Resultados" value={form.quantity} onChange={(event) => change('quantity', Number(event.target.value))} disabled={busy}>
                    {CATALOG_RESEARCH_QUANTITIES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box>
              <Typography variant="overline" sx={{ color: T.tools.research.dark }}>3. Detalhes da pesquisa</Typography>
              <Grid container spacing={2} alignItems="stretch" sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                  <TextField fullWidth multiline minRows={3} label="Como pretende usar o resultado?" helperText="Ex.: selecionar convidados ou mapear parceiros." value={form.purpose} onChange={(event) => change('purpose', event.target.value)} disabled={busy} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                  <TextField fullWidth multiline minRows={3} label="Fatores de priorização" helperText="O que faz um resultado aparecer antes dos demais." value={form.prioritizationFactors} onChange={(event) => change('prioritizationFactors', event.target.value)} disabled={busy} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex' }}>
                  <TextField fullWidth multiline minRows={3} label="Fatores de exclusão" helperText="Condições que eliminam um resultado da pesquisa." value={form.exclusionFactors} onChange={(event) => change('exclusionFactors', event.target.value)} disabled={busy} />
                </Grid>
              </Grid>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
              <Typography variant="caption" sx={{ color: T.ink.subtle }}>A pesquisa aprofunda e verifica lotes de até cinco cards. Pedidos maiores podem levar vários minutos; cada lote concluído é preservado.</Typography>
              {/* Um botão cinza e mudo não diz onde clicar. Enquanto falta algo,
                  o texto ao lado nomeia exatamente o quê. */}
              <Stack alignItems={{ sm: 'flex-end' }} gap={.5}>
                <Button type="submit" variant="contained" size="large" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />} disabled={busy || Boolean(missingRequirement) || previewSummary.cards >= form.quantity} sx={{ minWidth: 220, bgcolor: T.tools.research.main, '&:hover': { bgcolor: T.tools.research.dark }, '&:active': { transform: 'translateY(1px)' } }}>
                  {busy ? `Pesquisando ${Math.min(previewSummary.cards + 5, form.quantity)} de ${form.quantity}…` : previewSummary.cards ? 'Continuar pesquisa' : 'Iniciar pesquisa profunda'}
                </Button>
                {!busy && missingRequirement && (
                  <Typography variant="caption" sx={{ color: T.ink.subtle }}>{missingRequirement}</Typography>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </SectionCard>

      <Box sx={{ mt: 3 }}>
          {!previews.length && !busy && !success && (
            <SectionCard sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
              <Box sx={{ p: 4, maxWidth: 560, textAlign: 'center' }}>
                <SearchIcon sx={{ fontSize: 46, color: T.tools.research.main }} />
                <Typography variant="h5" sx={{ mt: 1 }}>Os resultados aparecerão aqui para revisão</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: T.ink.muted }}>Cada sugestão será exibida como um card para sua aprovação.</Typography>
              </Box>
            </SectionCard>
          )}
          {busy && !previews.length && <SectionCard sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" gap={2} sx={{ p: 4 }}><CircularProgress /><Typography>Pesquisando e conferindo fontes públicas…</Typography><Typography variant="body2" sx={{ color: T.ink.muted }}>O primeiro lote pode levar alguns minutos.</Typography></Stack></SectionCard>}
          {previews.length > 0 && (
            <>
              {/* Barra do lote.
                  Depois de uma espera que passa do minuto, o primeiro efeito
                  visível não pode custar um clique por card: a decisão padrão
                  de todo resultado é descartar, então o contador abria em
                  "(0)" com o botão desligado. Aprovar em massa tira o trabalho
                  repetitivo e deixa a atenção onde ela importa — nas
                  duplicatas. */}
              <SectionCard sx={{ mb: 2, position: 'sticky', top: T.layout.headerHeight, zIndex: 2 }}>
                <CardContent sx={{ py: 1.75 }}>
                  <ImportReviewToolbar
                    rows={rows}
                    decisions={decisions}
                    onDecisionsChange={setDecisions}
                    stateFilter={stateFilter}
                    onStateFilterChange={setStateFilter}
                    busy={busy || commitBusy}
                  >
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={commitBusy ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />}
                      disabled={busy || commitBusy || approvedCount === 0}
                      onClick={commit}
                    >
                      Adicionar {approvedCount} ao catálogo
                    </Button>
                  </ImportReviewToolbar>
                </CardContent>
              </SectionCard>

              <ImportReviewGrid
                rows={rows}
                stateFilter={stateFilter}
                decisions={decisions}
                existingById={existingById}
                onDecision={(key, decision) => setDecisions((previous) => ({ ...previous, [key]: decision }))}
              />
            </>
          )}
      </Box>
    </PageContainer>
  );
}
