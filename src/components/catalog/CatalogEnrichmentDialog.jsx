import React, { useEffect, useRef, useState } from 'react';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const CATEGORY_LABELS = {
  organization: 'Outras organizações',
  school: 'Instituições de educação',
  person: 'Especialistas',
};

const ERROR_MESSAGES = {
  budget_exceeded: 'O limite diário de IA foi atingido. O lote ficou salvo e pode continuar depois.',
  catalog_search_not_configured: 'A pesquisa pública do catálogo ainda não está configurada.',
  ai_not_configured: 'O provedor de IA ainda não está configurado.',
  provider_timeout: 'A pesquisa deste card demorou mais que o limite. O lote ficou salvo; use Continuar enriquecimento para tentar novamente.',
  enrichment_source_changed: 'O catálogo mudou durante o processamento. Reabra a auditoria antes de consolidar o lote.',
  enrichment_commit_quality_failed: 'A conferência final encontrou um card fora do padrão. Nenhuma alteração do lote foi mantida.',
};

export function catalogEnrichmentErrorMessage(code) {
  return ERROR_MESSAGES[code] || 'Não foi possível concluir o enriquecimento agora.';
}

export function catalogEnrichmentActionState({ running, hasFailed, pending, needsEnrichment }) {
  if (running) return { kind: 'running', label: 'Processando...' };
  if (hasFailed) return { kind: 'retry', label: 'Tentar novamente' };
  if (pending > 0) return { kind: 'continue', label: 'Continuar enriquecimento' };
  return { kind: 'start', label: `Enriquecer ${needsEnrichment || ''} card(s)` };
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
    const error = new Error(catalogEnrichmentErrorMessage(payload.error));
    error.code = payload.error;
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
  const handled = Number(counts.passed || 0) + Number(counts.failed || 0);
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
        <Chip size="small" label={`${counts.passed || 0} aprovados`} color="success" variant="outlined" />
        <Chip size="small" label={`${counts.pending || 0} pendentes`} variant="outlined" />
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

export default function CatalogEnrichmentDialog({ open, onClose, onCatalogChanged }) {
  const [overview, setOverview] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningSeconds, setRunningSeconds] = useState(0);
  const [notice, setNotice] = useState(null);
  const continueRef = useRef(false);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setRunningSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!open) {
      continueRef.current = false;
      return undefined;
    }
    let active = true;
    setLoading(true);
    setNotice(null);
    requestEnrichment()
      .then((payload) => {
        if (!active) return;
        setOverview(payload);
        setBatch(payload.pending);
      })
      .catch((error) => active && setNotice({ severity: 'error', text: error.message }))
      .finally(() => active && setLoading(false));
    return () => { active = false; continueRef.current = false; };
  }, [open]);

  const commit = async (current) => {
    const result = await requestEnrichment({ action: 'commit', batchId: current.batchId });
    await onCatalogChanged?.();
    const refreshed = await requestEnrichment();
    setOverview(refreshed);
    setBatch(null);
    setNotice({ severity: 'success', text: `${result.applied?.length || 0} card(s) enriquecido(s). Todos passaram pela conferência final.` });
  };

  const run = async (initial) => {
    continueRef.current = true;
    setRunningSeconds(0);
    setRunning(true);
    setNotice({ severity: 'info', text: 'Pesquisando fontes e conferindo os cards. Você pode fechar esta janela e continuar o lote depois.' });
    let current = initial;
    try {
      while (continueRef.current && current?.counts?.pending > 0) {
        setRunningSeconds(0);
        current = await requestEnrichment({ action: 'process', batchId: current.batchId });
        setBatch(current);
      }
      if (continueRef.current && current?.readyToCommit) await commit(current);
      else if (continueRef.current && current?.counts?.failed) {
        setNotice({ severity: 'warning', text: 'Alguns cards ainda não encontraram evidência suficiente. O lote não foi consolidado.' });
      }
    } catch (error) {
      setNotice({ severity: 'warning', text: error.message });
    } finally {
      continueRef.current = false;
      setRunning(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const created = await requestEnrichment({ action: 'start' });
      setBatch(created);
      if (created.completeWithoutChanges) {
        setNotice({ severity: 'success', text: 'O catálogo já está integralmente no padrão de qualidade.' });
      } else {
        await run(created);
      }
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
      await run(retried);
    } catch (error) {
      setNotice({ severity: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    continueRef.current = false;
    onClose();
  };

  const audit = overview?.audit;
  const capabilities = overview?.capabilities;
  const needsEnrichment = Number(audit?.needsEnrichment || 0);
  const hasFailed = Number(batch?.counts?.failed || 0) > 0;
  const primaryAction = catalogEnrichmentActionState({
    running,
    hasFailed,
    pending: Number(batch?.counts?.pending || 0),
    needsEnrichment,
  });

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
          <BatchProgress batch={batch} running={running} runningSeconds={runningSeconds} />
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
                    <Typography variant="caption" color="text.secondary">{(failure.missing || []).join(' · ') || 'Evidência pública insuficiente'}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            O enriquecimento é consolidado como um único lote. Se qualquer card não passar, o lote permanece pendente e pode ser retomado; depois de concluído, ele também pode ser desfeito pelo histórico de importações.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>{running ? 'Fechar e continuar depois' : 'Fechar'}</Button>
        {primaryAction.kind === 'running' ? (
          <Button variant="contained" disabled>{primaryAction.label}</Button>
        ) : primaryAction.kind === 'retry' ? (
          <Button variant="contained" onClick={handleRetry} disabled={loading || running || !capabilities?.ready}>{primaryAction.label}</Button>
        ) : primaryAction.kind === 'continue' ? (
          <Button variant="contained" onClick={() => run(batch)} disabled={loading || running || !capabilities?.ready}>{primaryAction.label}</Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<AutoFixHighOutlinedIcon />}
            onClick={handleStart}
            disabled={loading || running || !needsEnrichment || !capabilities?.ready}
          >
            {primaryAction.label}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
