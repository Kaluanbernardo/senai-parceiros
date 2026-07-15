import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ScoreRadar, { DIMENSION_LABELS, SERIES_COLORS } from './ScoreRadar';
import { getMatrixMarkers, getRadarSeries } from './selectionVisualization';
import ProfileAvatar from '../design-system/primitives/ProfileAvatar';
import { CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { exportSelection } from '../services/exportSelection';

const format = (value) => String(Math.round(value || 0)) + '/100';

function decisionBand(value) {
  if (value >= 75) return { label: 'Prioridade alta', color: 'success' };
  if (value >= 55) return { label: 'Prioridade para validação', color: 'warning' };
  return { label: 'Baixa aderência', color: 'default' };
}

function DecisionMatrix({ entries }) {
  const markers = getMatrixMarkers(entries);
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" fontWeight={700}>Matriz de decisão</Typography>
      <Typography variant="caption" color="text.secondary">Eixo horizontal: viabilidade · eixo vertical: valor estratégico</Typography>
      <Box sx={{ position: 'relative', mt: 2, height: 300, borderLeft: '2px solid #9fb3c8', borderBottom: '2px solid #9fb3c8', background: 'linear-gradient(90deg, rgba(255,244,229,.45) 0 50%, rgba(230,247,237,.45) 50%), linear-gradient(0deg, rgba(255,244,229,.4) 0 50%, rgba(230,247,237,.4) 50%)' }}>
        <Typography sx={{ position: 'absolute', top: 8, left: 8, fontSize: 11, color: 'text.secondary' }}>alto valor</Typography>
        <Typography sx={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: 'text.secondary' }}>baixo valor</Typography>
        <Typography sx={{ position: 'absolute', right: 8, bottom: -26, fontSize: 11, color: 'text.secondary' }}>alta viabilidade</Typography>
        <Typography sx={{ position: 'absolute', left: 8, bottom: -26, fontSize: 11, color: 'text.secondary' }}>baixa viabilidade</Typography>
        {markers.map(({ entry, index, x, y, offsetX, offsetY, clusterSize }) => (
          <Box key={entry.candidate.id} role="img" aria-label={(index + 1) + '. ' + (entry.candidate.nome || entry.candidate.instituicao) + ', valor estratégico ' + format(entry.strategicValue) + ', viabilidade ' + format(entry.viability)} title={entry.candidate.nome || entry.candidate.instituicao} sx={{ position: 'absolute', left: x + '%', bottom: y + '%', transform: 'translate(calc(-50% + ' + offsetX + 'px), calc(50% + ' + offsetY + 'px))', width: 30, height: 30, borderRadius: '50%', bgcolor: index === 0 ? 'secondary.main' : 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, boxShadow: 2, zIndex: 2 }}>
            {index + 1}
            {clusterSize > 1 && <Box component="span" sx={{ position: 'absolute', top: -8, right: -8, minWidth: 16, height: 16, borderRadius: '50%', bgcolor: 'background.paper', color: 'text.primary', border: '1px solid', borderColor: 'divider', fontSize: 9, display: 'grid', placeItems: 'center' }}>{clusterSize}</Box>}
          </Box>
        ))}
      </Box>
      <Box component="table" sx={{ mt: 3, width: '100%', borderCollapse: 'collapse', fontSize: 12 }} aria-label="Dados da matriz de decisão">
        <Box component="tbody">{entries.map((entry, index) => <Box component="tr" key={entry.candidate.id}><Box component="td" sx={{ py: .5, pr: 1, fontWeight: 700 }}>#{index + 1}</Box><Box component="td" sx={{ py: .5 }}>{entry.candidate.nome || entry.candidate.instituicao}</Box><Box component="td" sx={{ py: .5 }}>Valor {format(entry.strategicValue)}</Box><Box component="td" sx={{ py: .5 }}>Viabilidade {format(entry.viability)}</Box></Box>)}</Box>
      </Box>
    </Paper>
  );
}

function ExportButtons({ result, metadata }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const formats = [
    ['xlsx', 'Planilha XLSX'],
    ['pdf', 'Relatório PDF'],
    ['docx', 'Relatório Word'],
    ['pptx', 'Resumo PowerPoint'],
  ];

  async function handleExport(formatId) {
    setBusy(formatId);
    setError('');
    try {
      const artifact = await exportSelection(result, formatId, metadata);
      const url = URL.createObjectURL(artifact.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError.message || 'Não foi possível gerar este arquivo.');
    } finally {
      setBusy('');
    }
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={1}>
      {formats.map(([formatId, label]) => (
        <Button key={formatId} size="small" variant="outlined" startIcon={<DownloadIcon />} disabled={Boolean(busy)} onClick={() => handleExport(formatId)}>
          {busy === formatId ? 'Gerando…' : label}
        </Button>
      ))}
      {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
    </Stack>
  );
}

export default function SelectionResults({ result, onReview, onRestart }) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shortlist = result?.shortlist || [];
  const activeIndex = Math.min(selectedIndex, Math.max(0, shortlist.length - 1));
  const selected = shortlist[activeIndex] || shortlist[0];
  const radarSeries = getRadarSeries(shortlist);
  const metadata = useMemo(() => ({
    title: 'Avaliação de stakeholders SENAI-SP',
    category: CATEGORY_LABELS[result?.trace?.category] || result?.trace?.category,
    objective: OBJECTIVE_LABELS[result?.trace?.objective] || result?.trace?.objective,
    context: result?.trace?.answers?.context || '',
  }), [result]);

  if (!shortlist.length) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">Não encontramos aderência suficiente no catálogo para montar uma shortlist responsável.</Alert>
        <Typography color="text.secondary">Revise o contexto, amplie a geografia ou ajuste as restrições.</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<EditIcon />} onClick={onReview}>Revisar respostas</Button>
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={onRestart}>Começar de novo</Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main">Resultado da seleção</Typography>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.8rem', md: '2.35rem' } }}>Shortlist de até dez stakeholders</Typography>
        <Typography color="text.secondary">A lista usa apenas registros já cadastrados. As respostas podem ser revistas a qualquer momento.</Typography>
      </Box>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Contexto avaliado</Typography>
              <Typography variant="body2">{result.trace.answers?.context || 'Não informado'}</Typography>
              <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
                <Chip size="small" label={metadata.category} />
                <Chip size="small" label={metadata.objective} />
                <Chip size="small" color={result.trace.provider === 'local-fallback' ? 'warning' : 'success'} label={result.trace.provider === 'local-fallback' ? 'Fallback local' : 'IA: ' + (result.trace.model || 'OpenRouter')} />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} alignSelf={{ sm: 'flex-start' }}>
              <Button size="small" startIcon={<EditIcon />} onClick={onReview}>Revisar</Button>
              <Button size="small" startIcon={<RestartAltIcon />} onClick={onRestart}>Novo</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <ExportButtons result={result} metadata={metadata} />
      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} variant="scrollable">
        <Tab label="Comparação" />
        <Tab label="Matriz e radar" />
        <Tab label="Rastreabilidade" />
      </Tabs>
      {selectedTab === 0 && (
        <Stack spacing={1.25}>
          {shortlist.map((entry, index) => (
            <Card key={entry.candidate.id} variant="outlined" sx={{ borderColor: index === 0 ? 'secondary.main' : 'divider' }}>
              <CardContent sx={{ pb: '16px !important' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Stack direction="row" gap={1.5} alignItems="center">
                      <ProfileAvatar person={entry.candidate} size={42} />
                      <Box sx={{ minWidth: 34, height: 34, borderRadius: '50%', bgcolor: index === 0 ? 'secondary.main' : 'primary.main', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{index + 1}</Box>
                      <Box>
                        <Typography fontWeight={700}>{entry.candidate.nome || entry.candidate.instituicao}</Typography>
                        <Typography variant="body2" color="text.secondary">{entry.candidate.instituicao || entry.candidate.pais} · {entry.candidate.pais}</Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6, md: 2 }}><Typography variant="caption" color="text.secondary">Pontuação</Typography><Typography variant="h5" fontWeight={800}>{format(entry.total)}</Typography><Chip size="small" color={decisionBand(entry.total).color} label={decisionBand(entry.total).label} sx={{ mt: .5 }} /></Grid>
                  <Grid size={{ xs: 6, md: 2 }}><Typography variant="caption" color="text.secondary">Valor estratégico</Typography><LinearProgress variant="determinate" value={entry.strategicValue} sx={{ mt: .7, height: 7, borderRadius: 4 }} /><Typography variant="caption">{format(entry.strategicValue)}</Typography></Grid>
                  <Grid size={{ xs: 6, md: 2 }}><Typography variant="caption" color="text.secondary">Viabilidade</Typography><LinearProgress color="success" variant="determinate" value={entry.viability} sx={{ mt: .7, height: 7, borderRadius: 4 }} /><Typography variant="caption">{format(entry.viability)}</Typography></Grid>
                  <Grid size={{ xs: 6, md: 1 }}><Button size="small" onClick={() => { setSelectedIndex(index); setSelectedTab(1); }}>Detalhes</Button></Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>{entry.summary}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      {selectedTab === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 7 }}><DecisionMatrix entries={shortlist} /></Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={700}>Comparação dos cinco primeiros</Typography>
              <Typography variant="body2" color="text.secondary">As cores e os nomes abaixo identificam cada série do radar.</Typography>
              <Box display="grid" placeItems="center" sx={{ mt: 1 }}><ScoreRadar series={radarSeries} /></Box>
              <Stack spacing={.75} sx={{ mt: 1 }}>
                {radarSeries.map((item, index) => <Stack direction="row" gap={1} alignItems="center" key={item.id}><Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: SERIES_COLORS[index % SERIES_COLORS.length] }} /><Typography variant="caption">#{item.rank} {item.label}</Typography></Stack>)}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={700}>Detalhe individual</Typography>
              <Stack direction="row" gap={1} alignItems="center" sx={{ mt: .5 }}>
                <ProfileAvatar person={selected?.candidate} size={42} showStatus />
                <Typography variant="body2" color="text.secondary">{selected?.candidate.nome || selected?.candidate.instituicao}</Typography>
              </Stack>
              <Tabs value={activeIndex} onChange={(_, value) => setSelectedIndex(value)} variant="scrollable" sx={{ mt: 1 }} aria-label="Selecionar stakeholder no radar">
                {shortlist.map((entry, index) => <Tab key={entry.candidate.id} value={index} label={'#' + (index + 1) + ' ' + (entry.candidate.nome || entry.candidate.instituicao || '').slice(0, 18)} />)}
              </Tabs>
              <Box display="grid" placeItems="center"><ScoreRadar dimensions={selected?.dimensions} /></Box>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                {Object.entries(DIMENSION_LABELS).map(([key, label]) => <Grid size={{ xs: 6 }} key={key}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={700}>{format(selected?.dimensions?.[key])}</Typography></Grid>)}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}
      {selectedTab === 2 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Como o resultado foi calculado</Typography><Typography variant="body2" sx={{ mt: 1 }}>{result.trace.formula}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{result.trace.sourcePolicy}</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Perguntas e respostas</Typography>{Object.entries(result.trace.answers || {}).map(([key, answer]) => <Box key={key} sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{key}</Typography><Typography variant="body2">{answer || 'não informado'}</Typography></Box>)}</Paper>
          {selected && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Ficha técnica e evidências de {selected.candidate.nome || selected.candidate.instituicao}</Typography>{(selected.evidence || []).map((field) => <Box key={field} sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{field}</Typography><Typography variant="body2">{typeof selected.candidate[field] === 'string' ? selected.candidate[field] : selected.candidate[field] ? JSON.stringify(selected.candidate[field]) : 'não localizado'}</Typography></Box>)}{selected.candidate.website && <Button size="small" href={selected.candidate.website} target="_blank" rel="noreferrer" sx={{ mt: 1 }}>Abrir fonte institucional</Button>}{selected.candidate.scholar && <Button size="small" href={selected.candidate.scholar} target="_blank" rel="noreferrer" sx={{ mt: 1, ml: 1 }}>Abrir perfil público</Button>}{selected.gaps?.map((gap) => <Alert key={gap} severity="info" sx={{ mt: 1 }}>{gap}</Alert>)}</Paper>}
        </Stack>
      )}
    </Stack>
  );
}
