import React, { useEffect, useMemo, useState } from 'react';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
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
import NumberedStep from '../design-system/primitives/NumberedStep';
import PageHeader from '../design-system/primitives/PageHeader';
import SectionCard from '../design-system/primitives/SectionCard';
import { DESIGN_TOKENS as T } from '../design-system/tokens';
import {
  CATALOG_RESEARCH_GEOGRAPHIES,
  CATALOG_RESEARCH_QUANTITIES,
  countResearchCandidates,
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

function newResearchRunId() {
  return globalThis.crypto?.randomUUID?.() || `research-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const [researchRunId, setResearchRunId] = useState(newResearchRunId);
  const [previews, setPreviews] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState(false);
  const [commitBusy, setCommitBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [optionalOpen, setOptionalOpen] = useState(false);
  // Com resultados na tela o formulário recolhe sozinho: ele já cumpriu o
  // papel, e a revisão é que passa a precisar da tela inteira.
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => flattenResearchPreviews(previews), [previews]);
  const approvedCount = countApprovedDecisions(decisions);
  const previewSummary = { cards: countResearchCandidates(previews) };
  const missingRequirement = !form.subtype
    ? 'Escolha um tipo de parceiro no passo 1 para começar.'
    : !form.context.trim()
      ? 'Descreva o que você procura no passo 2 para começar.'
      : '';

  useEffect(() => {
    let active = true;
    fetch('/api/admin/catalog-research', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (!active || !Array.isArray(body?.pending) || previews.length) return;
        const groups = new Map();
        body.pending.forEach((preview) => {
          const request = preview.researchRequest;
          if (!request?.researchRunId) return;
          const group = groups.get(request.researchRunId) || [];
          group.push(preview);
          groups.set(request.researchRunId, group);
        });
        const latest = [...groups.values()]
          .sort((left, right) => Math.max(...right.map((item) => Number(item.researchRequest?.batchIndex || 0))) - Math.max(...left.map((item) => Number(item.researchRequest?.batchIndex || 0))))[0];
        const request = latest?.[0]?.researchRequest;
        if (!request) return;
        const restored = [...latest].sort((left, right) => Number(left.researchRequest?.batchIndex || 0) - Number(right.researchRequest?.batchIndex || 0));
        setForm({ ...EMPTY_FORM, ...request });
        setResearchRunId(request.researchRunId);
        setPreviews(restored);
        setDecisions(Object.fromEntries(restored.flatMap((preview) => (preview.rows || []).map((row) => [
          researchDecisionKey(preview.batchId, row.rowNumber),
          row.status === 'possible_duplicate' ? 'keep_existing' : 'ignore',
        ]))));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

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
    setResearchRunId(newResearchRunId());
    setPreviews([]);
    setDecisions({});
    setError('');
  };

  const changeCategory = (category) => {
    setForm((previous) => ({ ...previous, category, subtype: '' }));
    setResearchRunId(newResearchRunId());
    setPreviews([]);
    setDecisions({});
    setError('');
  };

  async function runResearch() {
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
            body: JSON.stringify({ ...form, researchRunId, ...batch }),
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
      const preserved = countResearchCandidates(workingPreviews);
      setError(`${requestError.message || 'Não foi possível concluir a pesquisa.'}${preserved ? ` ${preserved} cards já concluídos foram preservados.` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  const submitResearch = (event) => {
    event.preventDefault();
    runResearch();
  };

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

  const hasResults = previews.length > 0;
  const optionalFilled = [form.purpose, form.prioritizationFactors, form.exclusionFactors].filter((value) => value.trim()).length;

  const formCard = (
    <SectionCard component="form" onSubmit={submitResearch}>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <NumberedStep number={1} title="Quem você quer encontrar?" accent="research" done={Boolean(form.subtype)}>
          <Stack gap={2}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={form.category}
              onChange={(_, value) => value && changeCategory(value)}
              disabled={busy}
              aria-label="Tipo de parceiro"
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <ToggleButton key={value} value={value} sx={{ py: 1.35, textTransform: 'none', fontWeight: 700 }}>{label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <FormControl required fullWidth>
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
          </Stack>
        </NumberedStep>

        <NumberedStep number={2} title="O que você procura?" accent="research" done={Boolean(form.context.trim())}>
          <Stack gap={2}>
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
            />
            <FormControl fullWidth>
              <InputLabel>Fontes preferidas</InputLabel>
              <Select label="Fontes preferidas" value={form.sourcePreferences} onChange={(event) => change('sourcePreferences', event.target.value)} disabled={busy}>
                {SOURCE_OPTIONS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <FormControl fullWidth>
                <InputLabel>Escopo geográfico</InputLabel>
                <Select label="Escopo geográfico" value={form.geography} onChange={(event) => change('geography', event.target.value)} disabled={busy}>
                  {CATALOG_RESEARCH_GEOGRAPHIES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Resultados</InputLabel>
                <Select label="Resultados" value={form.quantity} onChange={(event) => change('quantity', Number(event.target.value))} disabled={busy}>
                  {CATALOG_RESEARCH_QUANTITIES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </NumberedStep>

        {/* Três campos de texto vazios lado a lado eram o maior bloco em branco
            da tela, e os três são opcionais. Recolhidos, o formulário abre pela
            metade da altura sem esconder nada — o contador diz o que há ali. */}
        <NumberedStep number={3} title="Ajustes opcionais" accent="research" done={optionalFilled > 0} last>
          <Button
            fullWidth
            onClick={() => setOptionalOpen((current) => !current)}
            endIcon={<ExpandMoreIcon sx={{ transform: optionalOpen ? 'rotate(180deg)' : 'none', transition: `transform ${T.motion.fast}` }} />}
            sx={{ justifyContent: 'space-between', color: T.ink.muted, border: `1px solid ${T.border.subtle}` }}
            aria-expanded={optionalOpen}
          >
            {optionalFilled > 0 ? `${optionalFilled} de 3 preenchidos` : 'Refinar como a pesquisa ordena e descarta'}
          </Button>
          <Collapse in={optionalOpen}>
            <Stack gap={2} sx={{ mt: 2 }}>
              <TextField fullWidth multiline minRows={2} label="Como pretende usar o resultado?" helperText="Ex.: selecionar convidados ou mapear parceiros." value={form.purpose} onChange={(event) => change('purpose', event.target.value)} disabled={busy} />
              <TextField fullWidth multiline minRows={2} label="Fatores de priorização" helperText="O que faz um resultado aparecer antes dos demais." value={form.prioritizationFactors} onChange={(event) => change('prioritizationFactors', event.target.value)} disabled={busy} />
              <TextField fullWidth multiline minRows={2} label="Fatores de exclusão" helperText="Condições que eliminam um resultado da pesquisa." value={form.exclusionFactors} onChange={(event) => change('exclusionFactors', event.target.value)} disabled={busy} />
            </Stack>
          </Collapse>
        </NumberedStep>

        <Stack gap={.75} sx={{ mt: 3, pt: 3, borderTop: `1px solid ${T.border.subtle}` }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
            disabled={busy || Boolean(missingRequirement) || previewSummary.cards >= form.quantity}
            sx={{ bgcolor: T.tools.research.main, '&:hover': { bgcolor: T.tools.research.dark }, '&:active': { transform: 'translateY(1px)' } }}
          >
            {busy ? `Pesquisando ${Math.min(previewSummary.cards + 5, form.quantity)} de ${form.quantity}…` : previewSummary.cards ? 'Continuar pesquisa' : 'Iniciar pesquisa profunda'}
          </Button>
          {/* Um botão cinza e mudo não diz onde clicar. Enquanto falta algo, o
              texto abaixo nomeia exatamente o quê. */}
          {!busy && missingRequirement && (
            <Typography variant="caption" sx={{ color: T.ink.subtle, textAlign: 'center' }}>{missingRequirement}</Typography>
          )}
        </Stack>
      </CardContent>
    </SectionCard>
  );

  return (
    <PageContainer width="wide" tool="research">
      <PageHeader
        eyebrow="PESQUISA INTERNA"
        title="Encontre novos parceiros com pesquisa profunda"
        description="A plataforma cruza fontes públicas, prepara cards completos e preserva cada lote concluído. Nada entra no catálogo sem sua aprovação card por card."
        accent="research"
        dense
      />

      {error && <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mt: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate('/catalogo')}>Ver catálogo</Button>}>{success}</Alert>}

      {!hasResults ? (
        /* Antes da pesquisa: o formulário numa coluna de leitura e, ao lado, o
           que vai acontecer. Esticado na largura inteira, um campo de uma
           frase virava uma faixa de 1300px, e o lugar dos resultados era um
           cartão vazio de 360px que só repetia o título da página. */
        <Grid container spacing={3} sx={{ mt: 1 }} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 7 }}>{formCard}</Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <SectionCard sx={{ bgcolor: T.surface.sunken, border: `1px solid ${T.border.subtle}` }}>
              <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                <Typography variant="overline" sx={{ color: T.tools.research.dark }}>Como funciona</Typography>
                {/* A espera acontece aqui, onde estava a explicação do que vai
                    acontecer — e não num cartão vazio mais abaixo, fora do
                    campo de visão de quem acabou de clicar. */}
                {busy && (
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: T.surface.raised, border: `1px solid ${T.tools.research.main}` }}>
                    <CircularProgress size={20} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: T.ink.strong }}>Pesquisando e conferindo fontes públicas…</Typography>
                      <Typography variant="caption" sx={{ color: T.ink.muted }}>O primeiro lote pode levar alguns minutos.</Typography>
                    </Box>
                  </Stack>
                )}
                <Stack gap={2} sx={{ mt: 1.5 }}>
                  {[
                    ['A pesquisa sai em lotes de até cinco', 'Cada lote é aprofundado e conferido antes de virar card. Pedidos maiores levam vários minutos, e cada lote concluído fica preservado mesmo se o seguinte falhar.'],
                    ['Você revisa card por card', 'Nada entra no catálogo sem sua aprovação. Aprovar em massa é um clique para os que chegam sem ressalva.'],
                  ].map(([title, detail]) => (
                    <Box key={title}>
                      <Typography variant="subtitle2" sx={{ color: T.ink.strong }}>{title}</Typography>
                      <Typography variant="body2" sx={{ mt: .25, color: T.ink.muted }}>{detail}</Typography>
                    </Box>
                  ))}
                </Stack>

                {/* O vocabulário da revisão aparece antes da revisão: são três
                    estados que pedem decisões diferentes, e chegar neles sem
                    aviso é o que faz a tela de resultados parecer densa. */}
                <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${T.border.base}` }}>
                  <Typography variant="subtitle2" sx={{ color: T.ink.strong }}>O que você vai decidir</Typography>
                  <Stack gap={1.25} sx={{ mt: 1.25 }}>
                    {[
                      ['Novos', 'adicionar ou descartar', T.feedback.success],
                      ['Já no catálogo', 'manter o atual ou mesclar', T.feedback.warning],
                      ['Sem evidência', 'ficam de fora, com o motivo', T.ink.subtle],
                    ].map(([label, action, color]) => (
                      <Stack key={label} direction="row" alignItems="center" gap={1.25}>
                        <Chip label={label} size="small" sx={{ bgcolor: T.surface.raised, color, border: `1px solid ${color}`, fontWeight: 700, minWidth: 116 }} />
                        <Typography variant="body2" sx={{ color: T.ink.muted }}>{action}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </SectionCard>
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ mt: 3 }}>
          {/* Com resultados na tela, o formulário deixa de ser o assunto: ele
              vira uma linha com o que foi pedido, e a revisão fica com a
              largura inteira em vez de começar depois de 900px de campos. */}
          <SectionCard sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.75 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                    <Chip size="small" label={CATEGORY_LABELS[form.category]} variant="outlined" />
                    {form.subtype && <Chip size="small" label={form.subtype} variant="outlined" />}
                    <Chip size="small" label={CATALOG_RESEARCH_GEOGRAPHIES.find((option) => option.value === form.geography)?.label || form.geography} variant="outlined" />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: .75, color: T.ink.muted, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    “{form.context.trim()}”
                  </Typography>
                </Box>
                <Button
                  onClick={() => setFormOpen((current) => !current)}
                  endIcon={<ExpandMoreIcon sx={{ transform: formOpen ? 'rotate(180deg)' : 'none', transition: `transform ${T.motion.fast}` }} />}
                  sx={{ flexShrink: 0 }}
                  aria-expanded={formOpen}
                >
                  {formOpen ? 'Ocultar a pesquisa' : 'Ajustar a pesquisa'}
                </Button>
              </Stack>
            </CardContent>
          </SectionCard>

          <Collapse in={formOpen}>
            <Box sx={{ maxWidth: 720, mb: 3 }}>{formCard}</Box>
          </Collapse>
        </Box>
      )}

      <Box sx={{ mt: 3 }}>
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
