import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { exportSelection } from '../services/exportSelection';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

function decisionBand(value) {
  if (value >= 75) return { label: 'Boa opção para conhecer', color: 'success' };
  if (value >= 55) return { label: 'Vale conhecer', color: 'warning' };
  return { label: 'Opção complementar', color: 'default' };
}

function ExportButton({ result, metadata }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setBusy(true);
    setError('');
    try {
      const artifact = await exportSelection(result, 'xlsx', metadata);
      const url = URL.createObjectURL(artifact.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError.message || 'Não foi possível preparar o arquivo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap={1}>
      <Button size="small" variant="contained" startIcon={<DownloadIcon />} disabled={busy} onClick={handleExport}>
        {busy ? 'Preparando arquivo...' : 'Baixar resultados'}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

export default function SelectionResults({ result, onReview, onRestart }) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shortlist = result?.shortlist || [];
  const activeIndex = Math.min(selectedIndex, Math.max(0, shortlist.length - 1));
  const selected = shortlist[activeIndex] || shortlist[0];
  const selectedMeta = [selected?.candidate.instituicao, selected?.candidate.pais]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
  const metadata = useMemo(() => ({
    title: 'Recomendações do Farol de Parcerias',
    category: CATEGORY_LABELS[result?.trace?.category] || result?.trace?.category,
    objective: OBJECTIVE_LABELS[result?.trace?.objective] || result?.trace?.objective,
    context: result?.trace?.answers?.context || '',
  }), [result]);

  if (!shortlist.length) {
    const unreadable = result?.trace?.requestSignal && !result.trace.requestSignal.hasSignal;
    return (
      <Stack spacing={2}>
        <Alert severity="warning">
          {unreadable
            ? 'Não conseguimos reconhecer um tema nas suas respostas.'
            : 'Não encontramos uma opção segura para recomendar com esse recorte.'}
        </Alert>
        <Typography color="text.secondary">
          {unreadable
            ? 'Descreva o assunto, quem participa e o que precisa acontecer. Uma frase concreta já basta.'
            : 'Revise as respostas e tente ampliar o tema, o local ou o tipo de contribuição desejada.'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<EditIcon />} onClick={onReview}>Revisar respostas</Button>
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={onRestart}>Começar de novo</Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2">Parceiros recomendados</Typography>
          <Typography color="text.secondary" sx={{ mt: .75, maxWidth: 760 }}>
            {result?.trace?.answers?.context || 'Veja as opções e abra uma delas para entender a recomendação.'}
          </Typography>
          <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
            <Chip size="small" label={metadata.category} variant="outlined" />
            <Chip size="small" label={metadata.objective} variant="outlined" />
          </Stack>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" startIcon={<EditIcon />} onClick={onReview}>Revisar respostas</Button>
          <Button size="small" startIcon={<RestartAltIcon />} onClick={onRestart}>Começar de novo</Button>
          <ExportButton result={result} metadata={metadata} />
        </Stack>
      </Stack>

      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} variant="scrollable">
        <Tab label="Recomendações" />
        <Tab label="Comparar opções" />
        <Tab label="Como escolhemos" />
      </Tabs>

      {selectedTab === 0 && (
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5, lg: 4 }}>
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <List disablePadding aria-label="Parceiros recomendados">
                {shortlist.map((entry, index) => {
                  const name = entry.candidate.nome || entry.candidate.instituicao;
                  const meta = [entry.candidate.instituicao !== name ? entry.candidate.instituicao : '', entry.candidate.pais].filter(Boolean).join(' · ');
                  return (
                    <ListItemButton
                      key={entry.candidate.id}
                      selected={index === activeIndex}
                      onClick={() => setSelectedIndex(index)}
                      divider={index < shortlist.length - 1}
                      sx={{ alignItems: 'flex-start', gap: 1.25, py: 1.5, '&.Mui-selected': { bgcolor: T.surface.raised, boxShadow: `inset 4px 0 0 ${T.tools.selection.main}` } }}
                    >
                      <Typography variant="caption" sx={{ minWidth: 22, pt: .25, color: index === activeIndex ? T.tools.selection.dark : T.ink.subtle, fontWeight: 800 }}>{index + 1}</Typography>
                      <ListItemText primary={name} secondary={meta || null} slotProps={{ primary: { fontWeight: index === activeIndex ? 800 : 650 }, secondary: { fontSize: T.fontSize.caption } }} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 7, lg: 8 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                <Box>
                  <Typography variant="h3">{selected.candidate.nome || selected.candidate.instituicao}</Typography>
                  {selectedMeta && <Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>{selectedMeta}</Typography>}
                </Box>
                <Chip size="small" color={decisionBand(selected.total).color} label={decisionBand(selected.total).label} sx={{ alignSelf: 'flex-start' }} />
              </Stack>

              {selected.explanation?.headline && <Typography sx={{ mt: 2, fontWeight: 650 }}>{selected.explanation.headline}</Typography>}
              <Grid container spacing={2.5} sx={{ mt: .25 }}>
                {selected.explanation?.why?.length ? (
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="subtitle2" color="success.dark">Por que foi indicado</Typography>
                    <Stack component="ul" spacing={.6} sx={{ pl: 2.25, mt: .75, mb: 0 }}>
                      {selected.explanation.why.slice(0, 3).map((reason) => <Typography component="li" variant="body2" key={reason}>{reason}</Typography>)}
                    </Stack>
                  </Grid>
                ) : null}
                {selected.explanation?.against?.length ? (
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <Typography variant="subtitle2" color="warning.dark">O que checar antes</Typography>
                    <Stack component="ul" spacing={.6} sx={{ pl: 2.25, mt: .75, mb: 0 }}>
                      {selected.explanation.against.slice(0, 3).map((item) => <Typography component="li" variant="body2" color="text.secondary" key={item}>{item}</Typography>)}
                    </Stack>
                  </Grid>
                ) : null}
              </Grid>
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
                {selected.candidate.website && <Button size="small" href={selected.candidate.website} target="_blank" rel="noreferrer">Abrir site</Button>}
                {selected.candidate.scholar && <Button size="small" href={selected.candidate.scholar} target="_blank" rel="noreferrer">Ver perfil público</Button>}
                <Button size="small" onClick={() => setSelectedTab(1)}>Comparar com outras opções</Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {selectedTab === 1 && (
        <Grid container spacing={2}>
          {shortlist.map((entry, index) => {
            const name = entry.candidate.nome || entry.candidate.instituicao;
            const meta = [entry.candidate.instituicao !== name ? entry.candidate.instituicao : '', entry.candidate.pais].filter(Boolean).join(' · ');
            return (
              <Grid size={{ xs: 12, md: 6 }} key={entry.candidate.id}>
                <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                  <Typography variant="overline" sx={{ color: T.tools.selection.dark }}>OPÇÃO {index + 1}</Typography>
                  <Typography variant="h5">{name}</Typography>
                  {meta && <Typography variant="body2" color="text.secondary" sx={{ mt: .25 }}>{meta}</Typography>}
                  {entry.explanation?.why?.[0] && <Typography variant="body2" sx={{ mt: 1.5 }}><strong>Ponto forte:</strong> {entry.explanation.why[0]}</Typography>}
                  {entry.explanation?.against?.[0] && <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}><strong>Antes de escolher:</strong> {entry.explanation.against[0]}</Typography>}
                  <Button size="small" sx={{ mt: 1.5 }} onClick={() => { setSelectedIndex(index); setSelectedTab(0); }}>Ver detalhes</Button>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {selectedTab === 2 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h5">Como chegamos a estas opções</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>
              Cruzamos suas respostas com temas, experiência, alcance e condições de colaboração descritos nos perfis públicos do catálogo. As primeiras opções reúnem mais sinais de compatibilidade com o que você pediu.
            </Typography>
          </Paper>
          {result?.trace?.contextProfile ? (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h5">O que entendemos do seu pedido</Typography>
              <Grid container spacing={1.5} sx={{ mt: .25 }}>
                {[
                  ['Temas', result.trace.contextProfile.themeTokens],
                  ['Público', result.trace.contextProfile.audiences],
                  ['Contribuição esperada', result.trace.contextProfile.contributions],
                  ['Local ou idioma', result.trace.contextProfile.geography],
                  ['Prazo', result.trace.contextProfile.horizons],
                  ['Limites importantes', result.trace.contextProfile.hardConstraints],
                ].filter(([, values]) => values?.length).map(([label, values]) => (
                  <Grid size={{ xs: 12, md: 6 }} key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                    <Stack direction="row" gap={.5} flexWrap="wrap" sx={{ mt: .5 }}>
                      {values.slice(0, 8).map((value) => <Chip key={value} size="small" variant="outlined" label={value} />)}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ) : null}
          <Alert severity="info">As recomendações são um ponto de partida. Antes de entrar em contato, abra as fontes públicas e confirme se a experiência e a disponibilidade continuam atuais.</Alert>
        </Stack>
      )}
    </Stack>
  );
}
