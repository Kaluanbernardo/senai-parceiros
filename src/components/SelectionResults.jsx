import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Link as RouterLink } from 'react-router-dom';
import { CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { buildShortlistComparison } from '../domain/shortlistComparison';
import { sentenceList } from '../domain/candidateExplanation';
import { catalogRouteForCandidate } from '../domain/catalogSelection';
import { exportSelection } from '../services/exportSelection';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

function decisionBand(value) {
  if (value >= 75) return { label: 'Boa opção para conhecer', color: 'success' };
  if (value >= 55) return { label: 'Vale conhecer', color: 'warning' };
  return { label: 'Opção complementar', color: 'default' };
}

const BAND_INK = { success: T.feedback.success, warning: T.feedback.warning, default: T.ink.subtle };

function candidateName(entry) {
  return entry?.candidate?.nome || entry?.candidate?.instituicao || '';
}

function candidateMeta(entry) {
  const name = candidateName(entry);
  return [entry?.candidate?.instituicao !== name ? entry?.candidate?.instituicao : '', entry?.candidate?.pais]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
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

/**
 * Uma linha da lista: posição, nome, origem, faixa de decisão e força relativa.
 *
 * A faixa de decisão era calculada só para o candidato aberto, então a lista
 * apresentava a posição 1 e a posição 7 com exatamente o mesmo peso visual — e
 * a distância entre elas, que é o que ajuda a decidir, ficava invisível.
 */
function CandidateRow({ entry, rank, active, onSelect, last }) {
  const band = decisionBand(entry.total);
  return (
    <ListItemButton
      selected={active}
      onClick={onSelect}
      divider={!last}
      sx={{
        alignItems: 'flex-start',
        gap: 1.25,
        py: 1.5,
        '&.Mui-selected': { bgcolor: T.surface.raised, boxShadow: `inset 4px 0 0 ${T.tools.selection.main}` },
      }}
    >
      <Typography variant="caption" sx={{ minWidth: 22, pt: .25, color: active ? T.tools.selection.dark : T.ink.subtle, fontWeight: 800 }}>
        {rank}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: active ? 800 : 650, color: T.ink.strong }}>{candidateName(entry)}</Typography>
        {candidateMeta(entry) && (
          <Typography variant="caption" sx={{ color: T.ink.muted, display: 'block' }}>{candidateMeta(entry)}</Typography>
        )}
        <Stack direction="row" alignItems="center" gap={1} sx={{ mt: .75 }}>
          <LinearProgress
            variant="determinate"
            value={Math.max(4, Math.min(100, entry.total))}
            aria-label={`Força relativa de ${candidateName(entry)}`}
            sx={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              bgcolor: T.surface.sunken,
              '& .MuiLinearProgress-bar': { bgcolor: BAND_INK[band.color] },
            }}
          />
          <Typography variant="caption" sx={{ color: BAND_INK[band.color], fontWeight: 700, whiteSpace: 'nowrap' }}>
            {band.label}
          </Typography>
        </Stack>
      </Box>
    </ListItemButton>
  );
}

/**
 * Em que o candidato aberto se diferencia dos demais da própria shortlist.
 *
 * Numa lista já filtrada, o nível não informa: todos entraram porque são bons.
 * O que ajuda a decidir é a diferença — e ela era calculada e descartada. As
 * barras usam o intervalo que cada dimensão de fato ocupa nesta shortlist, e
 * não uma escala de 0 a 100 em que uma dimensão variando de 42 a 61 parece
 * constante. As dimensões que não separam ninguém são declaradas como tais em
 * vez de ocuparem uma barra fingindo informação.
 */
function DifferenceBreakdown({ comparison, entry }) {
  const id = entry?.candidate?.id;
  const discriminating = comparison.ranges.filter((range) => range.discriminates);
  const flat = comparison.ranges.filter((range) => !range.discriminates);
  const neighbor = comparison.neighbors.get(id);

  if (!discriminating.length) {
    return (
      <Typography variant="body2" sx={{ color: T.ink.muted }}>
        Nenhuma dimensão separa os candidatos desta lista: eles são equivalentes nos critérios avaliados.
      </Typography>
    );
  }

  return (
    <Stack gap={1.25}>
      {discriminating.map((range) => {
        const point = range.points.find((item) => item.id === id);
        if (!point) return null;
        const position = Math.round(point.position * 100);
        return (
          <Stack key={range.dimension} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={{ xs: .25, sm: 1.5 }}>
            <Typography variant="body2" sx={{ width: { sm: 132 }, flexShrink: 0, color: T.ink.base, '&::first-letter': { textTransform: 'uppercase' } }}>
              {range.label}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.max(3, position)}
              aria-label={`${range.label}: posição de ${candidateName(entry)} no intervalo desta lista`}
              sx={{
                flex: 1,
                width: '100%',
                height: 8,
                borderRadius: 4,
                bgcolor: T.surface.sunken,
                '& .MuiLinearProgress-bar': { bgcolor: point.leader ? T.feedback.success : T.tools.selection.main },
              }}
            />
            <Typography variant="caption" sx={{ width: { sm: 190 }, flexShrink: 0, color: T.ink.muted }}>
              {point.leader
                ? `maior desta lista (${point.value})`
                : `${point.value} · ${range.leaderName} lidera com ${range.max}`}
            </Typography>
          </Stack>
        );
      })}

      {neighbor && (
        <Typography variant="body2" sx={{ mt: .5, color: T.ink.base }}>{neighbor.sentence}</Typography>
      )}

      {/* Dizer quais dimensões não separam ninguém é informação, não ressalva:
          sem isso, quem lê supõe que as barras ausentes foram esquecidas. */}
      {flat.length > 0 && (
        <Typography variant="caption" sx={{ color: T.ink.subtle }}>
          Não {flat.length === 1 ? 'separa' : 'separam'} esta lista: {sentenceList(flat.map((range) => range.label))}. {flat[0].reason}
        </Typography>
      )}
    </Stack>
  );
}

export default function SelectionResults({ result, onReview, onRestart }) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const shortlist = result?.shortlist || [];
  const category = result?.trace?.category;

  // Um candidato entra como exploratório quando fica abaixo do corte de
  // elegibilidade e só está na lista para ampliar opções. O vocabulário do
  // produto separa as duas coisas; a tela não separava, e a distinção sumia.
  const threshold = Number(result?.trace?.shortlistPolicy?.threshold) || 0;
  const recommended = shortlist.filter((entry) => entry.total >= threshold);
  const exploratory = shortlist.filter((entry) => entry.total < threshold);

  const comparison = useMemo(() => buildShortlistComparison(shortlist), [shortlist]);

  const activeIndex = Math.max(0, shortlist.findIndex((entry) => entry.candidate?.id === selectedId));
  const selected = shortlist[activeIndex] || shortlist[0];

  const metadata = useMemo(() => ({
    title: 'Recomendações do Farol de Parcerias',
    category: CATEGORY_LABELS[category] || category,
    subtype: result?.trace?.subtype || result?.trace?.brief?.subtype || '',
    objective: OBJECTIVE_LABELS[result?.trace?.objective] || result?.trace?.objective,
    context: result?.trace?.answers?.context || '',
  }), [result, category]);

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

  const catalogRoute = catalogRouteForCandidate(category, selected?.candidate?.id);

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2">
            {shortlist.length} {shortlist.length === 1 ? 'parceiro recomendado' : 'parceiros recomendados'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: .75, maxWidth: 760 }}>
            {result?.trace?.answers?.context || 'Veja as opções e abra uma delas para entender a recomendação.'}
          </Typography>
          <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
            <Chip size="small" label={metadata.category} variant="outlined" />
            {metadata.subtype && <Chip size="small" label={metadata.subtype} variant="outlined" />}
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
                {recommended.map((entry, index) => (
                  <CandidateRow
                    key={entry.candidate.id}
                    entry={entry}
                    rank={index + 1}
                    active={entry.candidate.id === selected?.candidate?.id}
                    onSelect={() => setSelectedId(entry.candidate.id)}
                    last={index === recommended.length - 1 && exploratory.length === 0}
                  />
                ))}
              </List>

              {/* Exploratórios num bloco à parte e nomeado. Numa lista contínua
                  eles pareciam recomendações de mesmo peso, e o produto define
                  os dois como coisas diferentes de propósito. */}
              {exploratory.length > 0 && (
                <>
                  <Box sx={{ px: 2, pt: 1.75, pb: .75, bgcolor: T.surface.sunken, borderTop: `1px solid ${T.border.subtle}` }}>
                    <Typography variant="overline" sx={{ color: T.ink.muted }}>
                      Exploratórios ({exploratory.length})
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: T.ink.subtle }}>
                      Menor aderência ou menos evidência pública. Entram para ampliar as opções.
                    </Typography>
                  </Box>
                  <List disablePadding aria-label="Candidatos exploratórios">
                    {exploratory.map((entry, index) => (
                      <CandidateRow
                        key={entry.candidate.id}
                        entry={entry}
                        rank={recommended.length + index + 1}
                        active={entry.candidate.id === selected?.candidate?.id}
                        onSelect={() => setSelectedId(entry.candidate.id)}
                        last={index === exploratory.length - 1}
                      />
                    ))}
                  </List>
                </>
              )}
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 7, lg: 8 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                <Box>
                  <Typography variant="h3">{candidateName(selected)}</Typography>
                  {candidateMeta(selected) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>{candidateMeta(selected)}</Typography>
                  )}
                </Box>
                <Chip size="small" color={decisionBand(selected.total).color} label={decisionBand(selected.total).label} sx={{ alignSelf: 'flex-start' }} />
              </Stack>

              {selected.explanation?.headline && <Typography sx={{ mt: 2, fontWeight: 650 }}>{selected.explanation.headline}</Typography>}

              {shortlist.length > 1 && (
                <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${T.border.subtle}` }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.25, color: T.ink.strong }}>
                    Onde este se diferencia {shortlist.length === 2 ? 'do outro' : `dos outros ${shortlist.length - 1}`}
                  </Typography>
                  <DifferenceBreakdown comparison={comparison} entry={selected} />
                </Box>
              )}

              <Grid container spacing={2.5} sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${T.border.subtle}` }}>
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
                {/* O candidato é um registro do catálogo. Sem este caminho, ver
                    a ficha completa exigia sair daqui e procurar pelo nome. */}
                {catalogRoute && <Button size="small" component={RouterLink} to={catalogRoute}>Ver no catálogo</Button>}
                <Button size="small" onClick={() => setSelectedTab(1)}>Comparar com outras opções</Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {selectedTab === 1 && (
        <Stack spacing={2}>
          {/* Agrupar por perfil responde a pergunta que a lista ordenada não
              responde: entre dez nomes parecidos, quais são de fato de tipos
              diferentes? Escolher entre dois ou três perfis é mais simples do
              que comparar dez linhas. */}
          {comparison.profiles.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h5">Perfis desta lista</Typography>
              <Grid container spacing={2} sx={{ mt: .25 }}>
                {comparison.profiles.map((profile) => (
                  <Grid size={{ xs: 12, md: 6 }} key={profile.label}>
                    <Typography variant="subtitle2" sx={{ color: T.tools.selection.dark }}>{profile.label}</Typography>
                    {profile.hint && <Typography variant="caption" sx={{ display: 'block', color: T.ink.subtle }}>{profile.hint}</Typography>}
                    <Stack gap={.4} sx={{ mt: .75 }}>
                      {profile.members.map((member) => (
                        <Typography key={member.id} variant="body2">
                          <Box component="span" sx={{ color: T.ink.subtle, fontWeight: 700, mr: .75 }}>{member.rank}</Box>
                          {member.name}
                        </Typography>
                      ))}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {comparison.combination && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h5">Se for convidar mais de um</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
                Esta combinação cobre mais dimensões junta do que os três primeiros da lista, que tendem a ter o mesmo perfil.
              </Typography>
              <Stack gap={.75} sx={{ mt: 1.25 }}>
                {comparison.combination.members.map((member) => (
                  <Typography key={member.id} variant="body2">
                    <Box component="span" sx={{ color: T.ink.subtle, fontWeight: 700, mr: .75 }}>{member.rank}</Box>
                    <strong>{member.name}</strong>
                    {member.adds.length > 0 && ` — acrescenta ${member.adds.map((add) => `${add.label} (+${add.gain})`).join(' e ')}`}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h5">Dimensão a dimensão</Typography>
            <Stack gap={1.75} sx={{ mt: 1.5 }}>
              {comparison.ranges.map((range) => (
                <Box key={range.dimension}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                    <Typography variant="subtitle2" sx={{ color: T.ink.strong, '&::first-letter': { textTransform: 'uppercase' } }}>{range.label}</Typography>
                    <Typography variant="caption" sx={{ color: T.ink.subtle }}>
                      {range.discriminates ? `varia de ${range.min} a ${range.max}` : 'não separa esta lista'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: T.ink.muted }}>
                    {range.discriminates
                      ? `${range.leaderName} lidera (${range.max}); ${range.trailerName} fecha (${range.min}).`
                      : range.reason}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
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
