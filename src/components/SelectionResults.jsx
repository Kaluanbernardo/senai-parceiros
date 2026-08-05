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
import ScoreRadar, { DIMENSION_LABELS } from './ScoreRadar';
import { buildShortlistComparison, describeRow } from '../domain/shortlistComparison';
import { CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { exportSelection } from '../services/exportSelection';

const format = (value) => String(Math.round(value || 0)) + '/100';

function decisionBand(value) {
  if (value >= 75) return { label: 'Prioridade alta', color: 'success' };
  if (value >= 55) return { label: 'Prioridade para validação', color: 'warning' };
  return { label: 'Baixa aderência', color: 'default' };
}

/**
 * Tabela de comparação lado a lado.
 *
 * Substitui as faixas com bolinhas, que contrariavam duas coisas conhecidas
 * sobre como se lê uma comparação (Nielsen Norman Group):
 *
 *  - acima de cinco itens a comparação simultânea deixa de funcionar, e é
 *    preciso oferecer um jeito de reduzir o conjunto — mostrávamos dez;
 *  - a varredura acontece em linhas horizontais ("lawn mower pattern"), então
 *    atributo por linha e candidato por coluna acompanha o olho; pontos
 *    espalhados num eixo, não.
 *
 * Também segue duas recomendações que já estavam certas e ganharam reforço:
 * esconder as linhas em que todos empatam, e enunciar a diferença por escrito
 * em vez de deixar o usuário deduzir dos números.
 *
 * O seletor "o que mais importa" existe porque a decisão real costuma ser
 * não-compensatória: primeiro se elimina por um critério, depois se pesa o
 * resto.
 */
function ComparisonTable({ ranges, legend, entries, selectedId, onSelect }) {
  const [chosen, setChosen] = useState(() => legend.slice(0, 3).map((item) => item.id));
  const [showFlat, setShowFlat] = useState(false);
  const [priority, setPriority] = useState('');

  const discriminating = ranges.filter((range) => range.discriminates);
  const flat = ranges.filter((range) => !range.discriminates);
  const rows = priority
    ? [...discriminating].sort((left, right) => (right.dimension === priority) - (left.dimension === priority))
    : discriminating;

  const columns = legend
    .filter((item) => chosen.includes(item.id))
    .map((item) => ({ ...item, entry: entries.find((entry) => entry.candidate.id === item.id) }))
    .filter((item) => item.entry)
    .sort((left, right) => (priority
      ? (right.entry.dimensions[priority] || 0) - (left.entry.dimensions[priority] || 0)
      : left.rank - right.rank));

  function toggle(id) {
    setChosen((current) => {
      if (current.includes(id)) return current.length > 2 ? current.filter((item) => item !== id) : current;
      return current.length >= 4 ? [...current.slice(1), id] : [...current, id];
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Comparar lado a lado</Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        Comparar mais de quatro ao mesmo tempo atrapalha mais do que ajuda. Escolha quem entra na comparação.
      </Typography>
      <Stack direction="row" gap={.5} flexWrap="wrap" sx={{ mt: 1.25 }}>
        {legend.map((item) => (
          <Chip
            key={item.id}
            size="small"
            clickable
            onClick={() => toggle(item.id)}
            variant={chosen.includes(item.id) ? 'filled' : 'outlined'}
            color={chosen.includes(item.id) ? 'primary' : 'default'}
            label={`${item.rank}. ${item.name}`}
          />
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>O que mais importa para você?</Typography>
      <Stack direction="row" gap={.5} flexWrap="wrap" sx={{ mt: .5 }}>
        <Chip size="small" clickable label="Ordem do ranking" variant={priority ? 'outlined' : 'filled'} color={priority ? 'default' : 'secondary'} onClick={() => setPriority('')} />
        {discriminating.map((range) => (
          <Chip
            key={range.dimension}
            size="small"
            clickable
            label={range.label}
            variant={priority === range.dimension ? 'filled' : 'outlined'}
            color={priority === range.dimension ? 'secondary' : 'default'}
            onClick={() => setPriority(range.dimension)}
            // O texto do Chip fica num span interno, então a regra precisa
            // alcançá-lo: no root ela não capitalizava nada e os chips saíam
            // em minúscula ao lado dos rótulos capitalizados da tabela.
            sx={{ '& .MuiChip-label::first-letter': { textTransform: 'uppercase' } }}
          />
        ))}
      </Stack>

      <Box sx={{ overflowX: 'auto', mt: 2 }}>
        <Box component="table" sx={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ textAlign: 'left', p: 1, width: '26%' }} />
              {columns.map((column) => (
                <Box component="th" key={column.id} sx={{ p: 1, textAlign: 'left', verticalAlign: 'bottom', borderBottom: '2px solid', borderColor: column.id === selectedId ? 'secondary.main' : 'divider', cursor: 'pointer' }} onClick={() => onSelect?.(column.rank - 1)}>
                  <Typography variant="caption" color="text.secondary">#{column.rank}</Typography>
                  <Typography variant="body2" fontWeight={700} lineHeight={1.2}>{column.name}</Typography>
                  <Typography variant="caption" color="text.secondary">nota {Math.round(column.entry.total)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map((range) => {
              const values = columns.map((column) => Number(column.entry.dimensions?.[range.dimension]) || 0);
              const row = describeRow(values, columns.map((column) => column.name));
              const { best, tied } = row;
              return (
                <React.Fragment key={range.dimension}>
                  <Box component="tr" sx={{ bgcolor: priority === range.dimension ? 'action.hover' : 'transparent' }}>
                    <Box component="th" scope="row" sx={{ textAlign: 'left', p: 1, verticalAlign: 'top' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ '&::first-letter': { textTransform: 'uppercase' } }}>{range.label}</Typography>
                    </Box>
                    {columns.map((column, index) => (
                      <Box component="td" key={column.id} sx={{ p: 1, verticalAlign: 'top' }}>
                        <Stack direction="row" alignItems="center" gap={.75}>
                          <Typography variant="body2" fontWeight={values[index] === best ? 800 : 400} color={values[index] === best ? 'primary.main' : 'text.primary'}>{values[index]}</Typography>
                          {/* "melhor" só quando há um vencedor único: com dois no
                              topo o selo repetido afirmava dois melhores. */}
                          {values[index] === best && columns.length > 1 && !tied && (
                            <Chip size="small" color="primary" variant="outlined" label={row.soleLeader ? 'melhor' : 'empate no topo'} sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Stack>
                        <LinearProgress variant="determinate" value={values[index]} sx={{ mt: .4, height: 5, borderRadius: 3 }} color={values[index] === best ? 'primary' : 'inherit'} />
                      </Box>
                    ))}
                  </Box>
                  <Box component="tr">
                    <Box component="td" colSpan={columns.length + 1} sx={{ px: 1, pb: 1.25, pt: 0 }}>
                      <Typography variant="caption" color="text.secondary">{row.sentence}</Typography>
                    </Box>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        </Box>
      </Box>

      {flat.length > 0 && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button size="small" onClick={() => setShowFlat((value) => !value)}>
            {showFlat ? 'Ocultar' : `Mostrar ${flat.length} ${flat.length === 1 ? 'critério em que todos empatam' : 'critérios em que todos empatam'}`}
          </Button>
          {showFlat && flat.map((range) => (
            <Typography key={range.dimension} variant="caption" color="text.secondary" display="block" sx={{ mt: .5 }}>
              <Box component="strong" sx={{ '&::first-letter': { textTransform: 'uppercase' } }}>{range.label}</Box> — {range.reason}
            </Typography>
          ))}
        </Box>
      )}
    </Paper>
  );
}

/** Agrupa por onde cada candidato se destaca, para escolher entre trade-offs. */
function ProfileGroups({ profiles, onSelect }) {
  if (!profiles.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Perfis dentro da shortlist</Typography>
      <Typography variant="caption" color="text.secondary">Escolher entre dois ou três perfis costuma ser mais simples do que comparar dez linhas.</Typography>
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {profiles.map((group) => (
          <Box key={group.dimension || 'equivalentes'}>
            <Typography variant="body2" fontWeight={700}>{group.label}</Typography>
            {group.hint && <Typography variant="caption" color="text.secondary" display="block">{group.hint}</Typography>}
            <Stack direction="row" gap={.75} flexWrap="wrap" sx={{ mt: .75 }}>
              {group.members.map((member) => (
                <Chip key={member.id} size="small" variant="outlined" clickable onClick={() => onSelect?.(member.rank - 1)} label={`#${member.rank} ${member.name}`} />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

/** Combinação que cobre mais dimensões junta, para quem vai convidar mais de um. */
function CombinationSuggestion({ combination, onSelect }) {
  if (!combination) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Se for convidar mais de um</Typography>
      <Typography variant="caption" color="text.secondary">Esta combinação cobre mais terreno do que repetir perfis parecidos.</Typography>
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        {combination.members.map((member) => (
          <Stack key={member.id} direction="row" gap={1} alignItems="baseline">
            <Chip size="small" clickable onClick={() => onSelect?.(member.rank - 1)} label={`#${member.rank}`} />
            <Box>
              <Typography variant="body2" fontWeight={700}>{member.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {member.adds.length ? `acrescenta ${member.adds.map((add) => `${add.label} (+${add.gain})`).join(' e ')}` : 'base da combinação'}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

const DIMENSION_ORDER = ['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk'];
const percent = (value) => `${Math.round((Number(value) || 0) * 1000) / 10}%`;

/**
 * Mostra por que os pesos desta seleção são o que são. Sem isso, qualquer
 * nota parece arbitrária, mesmo quando não é.
 */
function CriteriaPanel({ criteria }) {
  if (!criteria?.weights) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Como os critérios foram calibrados</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
        Os pesos partem do perfil do objetivo “{criteria.profile}” e são ajustados pelas suas respostas, dentro de faixas fixas. Valor estratégico pesa {percent(criteria.groupWeights?.strategic)} e viabilidade {percent(criteria.groupWeights?.viability)}.
      </Typography>
      <Grid container spacing={1} sx={{ mt: 1 }}>
        {DIMENSION_ORDER.map((dimension) => (
          <Grid size={{ xs: 6, md: 4 }} key={dimension}>
            <Typography variant="caption" color="text.secondary">{DIMENSION_LABELS[dimension]}</Typography>
            <Typography fontWeight={700}>{percent(criteria.weights[dimension])}</Typography>
            <Typography variant="caption" color="text.secondary">base {percent(criteria.baseline?.[dimension])}</Typography>
          </Grid>
        ))}
      </Grid>
      {criteria.adjustments?.length ? (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Ajustes aplicados a partir da entrevista:</Typography>
          <Stack component="ul" spacing={.25} sx={{ pl: 2.5, mt: .5, mb: 0 }}>
            {criteria.adjustments.map((adjustment) => (
              <Typography component="li" variant="body2" key={adjustment.id}>
                {adjustment.reason} ({Object.entries(adjustment.deltas || {}).map(([dimension, delta]) => `${DIMENSION_LABELS[dimension]} ${delta > 0 ? '+' : ''}${Math.round(delta * 100)}`).join(', ')})
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Nenhum ajuste foi disparado: os pesos do perfil do objetivo foram mantidos.</Typography>}
    </Paper>
  );
}

/** Abre a nota de um candidato nos subcritérios que a compõem. */
function SubcriteriaPanel({ entry }) {
  if (!entry?.criteria) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>Composição da nota de {entry.candidate.nome || entry.candidate.instituicao}</Typography>
      <Stack spacing={1.25} sx={{ mt: 1 }}>
        {DIMENSION_ORDER.map((dimension) => {
          const detail = entry.criteria[dimension];
          if (!detail) return null;
          return (
            <Box key={dimension}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="body2" fontWeight={700}>{DIMENSION_LABELS[dimension]}</Typography>
                <Typography variant="body2" fontWeight={700}>{format(detail.score)}</Typography>
              </Stack>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, mt: .25 }}>
                <Box component="tbody">
                  {detail.subscores.map((sub) => (
                    <Box component="tr" key={sub.id}>
                      <Box component="td" sx={{ py: .25, pr: 1, color: 'text.secondary', width: '46%' }}>{sub.label}</Box>
                      <Box component="td" sx={{ py: .25, pr: 1, whiteSpace: 'nowrap' }}>{Math.round(sub.score)} × {percent(sub.weight)}</Box>
                      <Box component="td" sx={{ py: .25, color: 'text.secondary' }}>{sub.evidence.join(' · ')}</Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

function ExportButtons({ result, metadata }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

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
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.25}>
      <Button size="small" variant="contained" color="primary" startIcon={<DownloadIcon />} disabled={Boolean(busy)} onClick={() => handleExport('xlsx')} aria-label="Baixar planilha rica em formato XLSX">
        {busy === 'xlsx' ? 'Gerando planilha...' : 'Baixar planilha rica (XLSX)'}
      </Button>
      <Typography variant="caption" color="text.secondary">Inclui shortlist, pontuações, dimensões, evidências, lacunas e rastreabilidade.</Typography>
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
  const selectedMeta = [selected?.candidate.instituicao, selected?.candidate.pais]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
  // A comparação é derivada da própria shortlist: as faixas, os vizinhos, os
  // perfis e a combinação só fazem sentido em relação a quem entrou na lista.
  const comparison = useMemo(() => buildShortlistComparison(shortlist), [shortlist]);
  const legend = useMemo(() => shortlist.map((entry, index) => ({
    rank: index + 1,
    id: entry.candidate.id,
    name: entry.candidate.nome || entry.candidate.instituicao || `Candidato ${index + 1}`,
  })), [shortlist]);
  const metadata = useMemo(() => ({
    title: 'Avaliação de stakeholders SENAI-SP',
    category: CATEGORY_LABELS[result?.trace?.category] || result?.trace?.category,
    objective: OBJECTIVE_LABELS[result?.trace?.objective] || result?.trace?.objective,
    context: result?.trace?.answers?.context || '',
  }), [result]);

  if (!shortlist.length) {
    // Distingue "não entendi o que você pediu" de "entendi, mas o catálogo não
    // tem ninguém disso": as duas situações pedem ações diferentes.
    const signal = result?.trace?.requestSignal;
    const unreadable = signal && !signal.hasSignal;
    return (
      <Stack spacing={2}>
        <Alert severity="warning">
          {unreadable
            ? 'Não consegui reconhecer nenhum tema nas suas respostas, então não há como indicar ninguém com honestidade.'
            : 'Nenhum registro do catálogo tem relação demonstrável com o que você descreveu.'}
        </Alert>
        <Typography color="text.secondary">
          {unreadable
            ? 'Descreva a situação com suas palavras — o assunto, quem participa e o que precisa acontecer. Uma frase concreta já basta.'
            : `Foram avaliados ${signal?.unsupportedCandidates ?? 0} registros e nenhum trata do assunto que você pediu. Vale ampliar o tema, revisar as respostas ou considerar que o catálogo ainda não cobre esse recorte.`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Preferimos não mostrar uma lista: indicar os "menos piores" daria a impressão de que existe uma recomendação onde não existe.
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
        <Tab label="Diferenças" />
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
                {entry.explanation?.headline && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2, fontStyle: 'italic' }}>{entry.explanation.headline}</Typography>
                )}
                {/* Por que esta pessoa serve para isto — cada frase apoiada num
                    fato do cadastro, em vez de uma lista de termos que casaram. */}
                {entry.explanation?.why?.length ? (
                  <Box sx={{ mt: 1.25 }}>
                    <Typography variant="caption" fontWeight={700} color="success.dark">Por que foi indicado</Typography>
                    <Stack component="ul" spacing={.4} sx={{ pl: 2.5, mt: .4, mb: 0 }}>
                      {entry.explanation.why.map((reason) => <Typography component="li" variant="body2" key={reason}>{reason}</Typography>)}
                    </Stack>
                  </Box>
                ) : null}
                {entry.explanation?.against?.length ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" fontWeight={700} color="warning.dark">O que checar antes</Typography>
                    <Stack component="ul" spacing={.4} sx={{ pl: 2.5, mt: .4, mb: 0 }}>
                      {entry.explanation.against.map((item) => <Typography component="li" variant="body2" color="text.secondary" key={item}>{item}</Typography>)}
                    </Stack>
                  </Box>
                ) : null}
                {comparison.neighbors.get(entry.candidate.id) && (
                  <Typography variant="body2" sx={{ mt: 1, color: 'primary.main' }}>{comparison.neighbors.get(entry.candidate.id).sentence}</Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      {selectedTab === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <ComparisonTable ranges={comparison.ranges} legend={legend} entries={shortlist} selectedId={selected?.candidate.id} onSelect={setSelectedIndex} />
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={2}>
              <ProfileGroups profiles={comparison.profiles} onSelect={setSelectedIndex} />
              <CombinationSuggestion combination={comparison.combination} onSelect={setSelectedIndex} />
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Detalhe individual</Typography>
                <Box sx={{ mt: .75, p: 1.5, borderRadius: 2, bgcolor: 'action.hover', borderLeft: '4px solid', borderColor: 'secondary.main' }}>
                  <Typography fontWeight={800}>{selected?.candidate.nome || selected?.candidate.instituicao}</Typography>
                  {selectedMeta ? <Typography variant="caption" color="text.secondary">{selectedMeta}</Typography> : null}
                </Box>
                <Tabs value={activeIndex} onChange={(_, value) => setSelectedIndex(value)} variant="scrollable" sx={{ mt: 1 }} aria-label="Selecionar stakeholder">
                  {shortlist.map((entry, index) => <Tab key={entry.candidate.id} value={index} label={'#' + (index + 1) + ' ' + (entry.candidate.nome || entry.candidate.instituicao || '').slice(0, 18)} />)}
                </Tabs>
                {/* O radar individual continua útil: aqui a escala de 0 a 100
                    é a referência certa, porque não se trata de comparar. */}
                <Box sx={{ display: 'grid', placeItems: 'center' }}><ScoreRadar dimensions={selected?.dimensions} /></Box>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  {Object.entries(DIMENSION_LABELS).map(([key, label]) => <Grid size={{ xs: 6 }} key={key}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={700}>{format(selected?.dimensions?.[key])}</Typography></Grid>)}
                </Grid>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      )}
      {selectedTab === 2 && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Como o resultado foi calculado</Typography><Typography variant="body2" sx={{ mt: 1 }}>{result.trace.formula}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{result.trace.sourcePolicy}</Typography>{result.trace.shortlistPolicy ? <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Corte de elegibilidade aplicado: {result.trace.shortlistPolicy.threshold}/100 (piso fixo {result.trace.shortlistPolicy.absoluteFloor}, ou {percent(result.trace.shortlistPolicy.relativeToBest)} da melhor nota deste catálogo).</Typography> : null}</Paper>
          <CriteriaPanel criteria={result.trace.criteria} />
          {result.trace.contextProfile ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>O que foi lido do seu contexto</Typography>
              <Grid container spacing={1.5} sx={{ mt: .25 }}>
                {[
                  ['Temas usados na comparação', result.trace.contextProfile.themeTokens],
                  [result.trace.contextProfile.prioritiesFromUser ? 'Prioridades estratégicas reconhecidas nas suas respostas' : 'Prioridades estratégicas do baseline SENAI-SP (nenhuma foi nomeada por você)', result.trace.contextProfile.priorities],
                  ['Público', result.trace.contextProfile.audiences],
                  ['Contribuição desejada', result.trace.contextProfile.contributions],
                  ['Evidência esperada', result.trace.contextProfile.evidence],
                  ['Geografia', result.trace.contextProfile.geography],
                  ['Prazo', result.trace.contextProfile.horizons],
                  ['Restrições eliminatórias', result.trace.contextProfile.hardConstraints],
                ].filter(([, values]) => values?.length).map(([label, values]) => (
                  <Grid size={{ xs: 12, md: 6 }} key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                    <Stack direction="row" gap={.5} flexWrap="wrap" sx={{ mt: .5 }}>
                      {values.slice(0, 12).map((value) => <Chip key={value} size="small" variant="outlined" label={value} />)}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ) : null}
          {selected ? <SubcriteriaPanel entry={selected} /> : null}
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Perguntas e respostas</Typography>{Object.entries(result.trace.answers || {}).map(([key, answer]) => <Box key={key} sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{key}</Typography><Typography variant="body2">{answer || 'não informado'}</Typography></Box>)}</Paper>
          {selected && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="subtitle1" fontWeight={700}>Ficha técnica e evidências de {selected.candidate.nome || selected.candidate.instituicao}</Typography>{selected.comparativeEdge && <Typography variant="body2" sx={{ mt: 1 }}><strong>Diferencial comparativo:</strong> {selected.comparativeEdge}</Typography>}{selected.tradeoffs?.map((tradeoff) => <Alert key={tradeoff} severity="warning" sx={{ mt: 1 }}>{tradeoff}</Alert>)}{(selected.evidence || []).map((field) => <Box key={field} sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{field}</Typography><Typography variant="body2">{typeof selected.candidate[field] === 'string' ? selected.candidate[field] : selected.candidate[field] ? JSON.stringify(selected.candidate[field]) : 'não localizado'}</Typography></Box>)}{selected.candidate.website && <Button size="small" href={selected.candidate.website} target="_blank" rel="noreferrer" sx={{ mt: 1 }}>Abrir fonte institucional</Button>}{selected.candidate.scholar && <Button size="small" href={selected.candidate.scholar} target="_blank" rel="noreferrer" sx={{ mt: 1, ml: 1 }}>Abrir perfil público</Button>}{selected.gaps?.map((gap) => <Alert key={gap} severity="info" sx={{ mt: 1 }}>{gap}</Alert>)}</Paper>}
        </Stack>
      )}
    </Stack>
  );
}
