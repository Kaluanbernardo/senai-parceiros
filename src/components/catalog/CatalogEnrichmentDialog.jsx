import React, { useEffect, useState } from 'react';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const CATEGORY_LABELS = {
  organization: 'Pessoas Jurídicas',
  person: 'Pessoas Físicas',
};

const ERROR_MESSAGES = {
  budget_exceeded: 'O limite diário de IA foi atingido. O lote ficou salvo e pode continuar depois.',
  catalog_search_not_configured: 'A pesquisa pública do catálogo ainda não está configurada.',
  ai_not_configured: 'O provedor de IA ainda não está configurado.',
  provider_timeout: 'A pesquisa deste card demorou mais que o limite. O lote ficou salvo; use Continuar enriquecimento para tentar novamente.',
  provider_4xx: 'O provedor de IA recusou a chamada para este card (chave inválida, sem crédito ou parâmetro não suportado). Verifique a configuração de IA.',
  provider_5xx: 'O provedor de IA teve instabilidade neste card. Use Continuar enriquecimento para tentar novamente.',
  provider_invalid_response: 'O provedor de IA devolveu uma resposta incompleta para este card. O lote foi preservado; use Tentar novamente.',
  output_truncated: 'A resposta do provedor foi cortada pelo limite de tamanho antes de terminar este card.',
  enrichment_item_missing: 'O provedor não devolveu dados para este card.',
  enrichment_source_changed: 'O catálogo mudou durante o processamento. Reabra a auditoria antes de gravar os cards aprovados.',
  enrichment_commit_quality_failed: 'A conferência final recusou um card gravado. Essa gravação foi desfeita; os cards já salvos foram mantidos.',
  enrichment_batch_not_found: 'O lote não está mais disponível. Recarregue a página e inicie novamente.',
  enrichment_batch_incomplete: 'Nenhum card aprovado para gravar ainda.',
  enrichment_selection_required: 'Escolha pelo menos um card para iniciar.',
  invalid_enrichment_selection: 'A seleção contém um card que não está mais pendente. Reabra a janela e escolha novamente.',
  enrichment_target_not_current: 'O card visível mudou. Reabra a janela antes de continuar.',
  quality_gate_failed: 'A pesquisa não trouxe evidência suficiente para completar os campos exigidos.',
  authentication_required: 'Sua sessão expirou. Entre novamente para continuar o enriquecimento.',
  insufficient_role: 'Esta conta não tem permissão de administrador para enriquecer o catálogo.',
  store_hydrate_failed: 'Não foi possível ler o armazenamento do catálogo agora.',
  store_read_failed: 'Não foi possível ler o armazenamento do catálogo agora.',
  invalid_enrichment_action: 'A janela enviou uma ação inválida. Recarregue a página.',
  not_found: 'A rota de enriquecimento não respondeu. Recarregue a página.',
};

/**
 * Um código sem tradução ainda precisa chegar ao operador. A mensagem genérica
 * sozinha já escondeu duas falhas distintas — uma recusa do provedor e uma
 * queda da carga inicial — e as duas exigiam ações opostas. O texto amigável
 * explica, o código identifica; quando não há texto, o código é o que resta.
 */
export function catalogEnrichmentErrorMessage(code, status) {
  const raw = String(code || '').trim();
  if (raw.startsWith('catalog_source_http_')) {
    return 'Não foi possível consultar uma fonte pública para este card.';
  }
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  const detail = [raw || 'sem código', status ? `HTTP ${status}` : ''].filter(Boolean).join(', ');
  return `Não foi possível concluir o enriquecimento agora (${detail}).`;
}

export function catalogEnrichmentFailureReason(failure) {
  if (failure?.error && failure.error !== 'quality_gate_failed') return catalogEnrichmentErrorMessage(failure.error);
  return (failure?.missing || []).join(' · ') || 'Evidência pública insuficiente';
}

export function catalogEnrichmentRunningMessage(batch, elapsedSeconds = 0) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0));
  const target = batch?.next;
  const card = target?.name ? ` ${target.name}` : ' o próximo card';
  const attempt = target?.attempt && target?.maxAttempts
    ? ` (tentativa ${target.attempt} de ${target.maxAttempts})`
    : '';
  return `Processando${card}${attempt} · ${elapsed} s nesta etapa. Cada card pode levar até 45 segundos; o contador avança quando a etapa termina.`;
}

async function requestEnrichment(body) {
  const response = await fetch('/api/admin/catalog-enrichment', {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(catalogEnrichmentErrorMessage(payload.error, response.status));
    error.code = payload.error;
    error.status = response.status;
    throw error;
  }
  return payload;
}
function AuditSummary({ audit }) {
  if (!audit) return null;
  return (
    <Stack gap={1.25}>
      <Typography variant="body1" fontWeight={700}>
        {audit.conforming} de {audit.total} cards já estão no padrão
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        {(audit.categories || []).map((category) => (
          <Chip
            key={category.category}
            variant="outlined"
            label={`${CATEGORY_LABELS[category.category]}: ${category.needsEnrichment} pendente(s)`}
            color={category.needsEnrichment ? 'warning' : 'success'}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function QualityContract({ quality }) {
  if (!quality) return null;
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'grey.50' }}>
      <Typography variant="subtitle2" fontWeight={800} gutterBottom>Padrão conferido em todos os cards</Typography>
      <Stack component="ul" gap={0.5} sx={{ m: 0, pl: 2.25 }}>
        <Typography component="li" variant="body2">Descrição factual com no mínimo {quality.descriptionMinCharacters} caracteres.</Typography>
        <Typography component="li" variant="body2">Campos essenciais da categoria preenchidos, como instituição, área, atuação e relação pública.</Typography>
        <Typography component="li" variant="body2">Links públicos válidos; especialistas gerais precisam de {quality.personMinPublicLinks} e perfis de pesquisa de {quality.researcherMinPublicationLinks} publicações com links diretos.</Typography>
        <Typography component="li" variant="body2">A informação gerada só usa URLs encontradas na pesquisa ou já presentes no card.</Typography>
      </Stack>
    </Box>
  );
}

function BatchProgress({ batch, running, runningSeconds }) {
  if (!batch || batch.completeWithoutChanges) return null;
  const counts = batch.counts || {};
  const handled = Number(counts.passed || 0) + Number(counts.failed || 0) + Number(counts.committed || 0) + Number(counts.skipped || 0);
  const total = Number(counts.total || 0);
  const value = total ? Math.round((handled / total) * 100) : 0;
  return (
    <Stack gap={1.25}>
      <Stack direction="row" justifyContent="space-between" gap={2}>
        <Typography variant="subtitle2" fontWeight={800}>Lote em andamento</Typography>
        <Typography variant="body2" color="text.secondary">{handled} de {total}</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value} sx={{ height: 8, borderRadius: 999 }} />
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Chip size="small" label={`${counts.committed || 0} gravados`} color="success" variant="outlined" />
        {Boolean(counts.passed) && <Chip size="small" label={`${counts.passed} aprovados`} color="success" variant="outlined" />}
        <Chip size="small" label={`${counts.pending || 0} pendentes`} variant="outlined" />
        {Boolean(counts.skipped) && <Chip size="small" label={`${counts.skipped} pulados`} variant="outlined" />}
        {Boolean(counts.failed) && <Chip size="small" label={`${counts.failed} com pendência`} color="warning" variant="outlined" />}
      </Stack>
      {running && (
        <Box
          aria-label="Enriquecimento em andamento"
          sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'info.50', color: 'info.dark' }}
        >
          <LinearProgress sx={{ mb: 1, borderRadius: 999 }} />
          <Typography variant="body2" fontWeight={700}>
            {catalogEnrichmentRunningMessage(batch, runningSeconds)}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function CardSelection({ candidates, selectedKeys, onChange }) {
  const selected = new Set(selectedKeys);
  return (
    <Stack gap={1.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>Escolha os cards que deseja enriquecer</Typography>
          <Typography variant="body2" color="text.secondary">Nenhum card é selecionado automaticamente.</Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button size="small" onClick={() => onChange(candidates.map((candidate) => candidate.key))}>Selecionar todos</Button>
          <Button size="small" onClick={() => onChange([])}>Limpar</Button>
        </Stack>
      </Stack>
      <Stack gap={0.75} sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
        {candidates.map((candidate) => (
          <Box
            component="label"
            key={candidate.key}
            sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.25, border: '1px solid', borderColor: selected.has(candidate.key) ? 'primary.main' : 'divider', borderRadius: 1.5, cursor: 'pointer' }}
          >
            <Checkbox
              checked={selected.has(candidate.key)}
              onChange={() => onChange(selected.has(candidate.key)
                ? selectedKeys.filter((key) => key !== candidate.key)
                : [...selectedKeys, candidate.key])}
              sx={{ p: 0.25 }}
            />
            <Box>
              <Typography variant="body2" fontWeight={700}>{candidate.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {CATEGORY_LABELS[candidate.category]} · {(candidate.missing || []).join(' · ')}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
      <Typography variant="body2" fontWeight={700}>{selectedKeys.length} card(s) selecionado(s)</Typography>
    </Stack>
  );
}

function CurrentCard({ target }) {
  if (!target) return null;
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 1.5, bgcolor: 'primary.50' }}>
      <Typography variant="overline" color="primary.main" fontWeight={800}>Card atual</Typography>
      <Typography variant="h6" fontWeight={800}>{target.name}</Typography>
      <Typography variant="body2" color="text.secondary">{CATEGORY_LABELS[target.category]}</Typography>
      {Boolean(target.missing?.length) && (
        <Typography variant="body2" sx={{ mt: 1 }}>Lacunas: {target.missing.join(' · ')}</Typography>
      )}
    </Box>
  );
}

export default function CatalogEnrichmentDialog({ open, onClose, onCatalogChanged }) {
  const [overview, setOverview] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningSeconds, setRunningSeconds] = useState(0);
  const [notice, setNotice] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setRunningSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setNotice(null);
    requestEnrichment()
      .then((payload) => {
        if (!active) return;
        setOverview(payload);
        setBatch(payload.pending);
        setSelectedKeys([]);
      })
      .catch((error) => active && setNotice({ severity: 'error', text: error.message }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open]);

  const handleEnrichCurrent = async () => {
    setRunningSeconds(0);
    setRunning(true);
    setNotice({ severity: 'info', text: `Pesquisando fontes e conferindo ${batch.next.name}.` });
    try {
      let current = await requestEnrichment({ action: 'process', batchId: batch.batchId });
      if (Number(current.counts?.passed || 0) > 0) {
        current = await requestEnrichment({ action: 'commit', batchId: current.batchId });
        await onCatalogChanged?.();
        setNotice({ severity: 'success', text: current.next ? 'Card enriquecido e gravado. Agora escolha o que fazer com o próximo.' : 'Card enriquecido e gravado.' });
      } else if (current.next?.key === batch.next.key) {
        setNotice({ severity: 'warning', text: 'Este card ainda não atingiu o padrão. Você pode tentar enriquecê-lo novamente ou pular.' });
      } else {
        setNotice({ severity: 'warning', text: current.next ? 'Este card ficou bloqueado. Agora escolha o que fazer com o próximo.' : 'Este card ficou bloqueado.' });
      }
      setBatch(current);
    } catch (error) {
      setNotice({ severity: 'warning', text: error.message });
    } finally {
      setRunning(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const created = await requestEnrichment({ action: 'start', targetKeys: selectedKeys });
      setBatch(created);
      setNotice({ severity: 'info', text: 'Seleção salva. Escolha se deseja enriquecer ou pular o primeiro card.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    try {
      const retried = await requestEnrichment({ action: 'retry', batchId: batch.batchId });
      setBatch(retried);
      setNotice({ severity: 'info', text: 'Os cards bloqueados voltaram para a fila. Decida um por vez.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const skipped = await requestEnrichment({ action: 'skip', batchId: batch.batchId, targetKey: batch.next.key });
      setBatch(skipped);
      setNotice({ severity: 'info', text: skipped.next ? 'Card pulado. Agora escolha o que fazer com o próximo.' : 'Card pulado. A seleção chegou ao fim.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => onClose();

  const audit = overview?.audit;
  const capabilities = overview?.capabilities;
  const needsEnrichment = Number(audit?.needsEnrichment || 0);
  const hasFailed = Number(batch?.counts?.failed || 0) > 0;
  const candidates = overview?.candidates || [];

  return (
    <Dialog open={open} onClose={running ? undefined : handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', gap: 1.25, alignItems: 'center', fontWeight: 800 }}>
        <AutoFixHighOutlinedIcon color="primary" /> Enriquecer catálogo
      </DialogTitle>
      <DialogContent dividers>
        <Stack gap={2.5}>
          {loading && !running && <LinearProgress />}
          {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
          {audit?.needsEnrichment === 0 && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon />}>Todos os cards atendem ao padrão atual.</Alert>
          )}
          <AuditSummary audit={audit} />
          <QualityContract quality={overview?.quality} />
          {!batch && candidates.length > 0 && (
            <CardSelection candidates={candidates} selectedKeys={selectedKeys} onChange={setSelectedKeys} />
          )}
          <BatchProgress batch={batch} running={running} runningSeconds={runningSeconds} />
          <CurrentCard target={batch?.next} />
          {capabilities && !capabilities.ready && needsEnrichment > 0 && (
            <Alert severity="warning">
              {!capabilities.ai && !capabilities.search
                ? 'Configure o provedor de IA e a pesquisa pública antes de iniciar.'
                : !capabilities.ai ? 'Configure o provedor de IA antes de iniciar.' : 'Configure a pesquisa pública antes de iniciar.'}
            </Alert>
          )}
          {hasFailed && (
            <Box>
              <Typography variant="subtitle2" fontWeight={800} gutterBottom>Cards ainda bloqueados</Typography>
              <Stack gap={1}>
                {(batch.failures || []).map((failure) => (
                  <Box key={failure.key} sx={{ p: 1.25, border: '1px solid', borderColor: 'warning.light', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{failure.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{catalogEnrichmentFailureReason(failure)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Você decide um card por vez. Enriquecer pesquisa e grava somente o card atual; pular não altera o catálogo. Os cards gravados continuam disponíveis no histórico para desfazer.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={running}>Fechar</Button>
        {!batch ? (
          <Button
            variant="contained"
            startIcon={<AutoFixHighOutlinedIcon />}
            onClick={handleStart}
            disabled={loading || running || !selectedKeys.length || !capabilities?.ready}
          >
            Iniciar com {selectedKeys.length} card(s)
          </Button>
        ) : batch.next ? (
          <>
            <Button onClick={handleSkip} disabled={loading || running}>Pular para o próximo</Button>
            <Button variant="contained" startIcon={<AutoFixHighOutlinedIcon />} onClick={handleEnrichCurrent} disabled={loading || running || !capabilities?.ready}>
              {running ? 'Processando...' : 'Enriquecer este card'}
            </Button>
          </>
        ) : hasFailed ? (
          <Button variant="contained" onClick={handleRetry} disabled={loading || running || !capabilities?.ready}>Tentar cards bloqueados novamente</Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
