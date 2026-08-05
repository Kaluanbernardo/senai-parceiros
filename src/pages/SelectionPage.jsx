import React, { useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import ScienceIcon from '@mui/icons-material/Science';
import SchoolIcon from '@mui/icons-material/School';
import BusinessIcon from '@mui/icons-material/Business';
import { useData } from '../context/DataContext';
import { CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { InterviewPlanner, QUESTION_BANK, fieldLabel } from '../domain/interviewPlanner';
import { buildLocalEvaluation, getCandidatePool } from '../domain/selectionEngine';
import SelectionResults from '../components/SelectionResults';
import PageContainer from '../design-system/primitives/PageContainer';
import PageHeader from '../design-system/primitives/PageHeader';
import { DESIGN_TOKENS as T } from '../design-system/tokens';

const CATEGORY_OPTIONS = [
  { id: 'researcher', label: CATEGORY_LABELS.researcher, description: 'Pessoa com conhecimento especializado, produção ou experiência relevante.', icon: <ScienceIcon sx={{ fontSize: 34 }} /> },
  { id: 'school', label: CATEGORY_LABELS.school, description: 'Escola, centro de formação ou rede de educação profissional.', icon: <SchoolIcon sx={{ fontSize: 34 }} /> },
  { id: 'organization', label: CATEGORY_LABELS.organization, description: 'Empresa, órgão público, associação, fundação ou rede.', icon: <BusinessIcon sx={{ fontSize: 34 }} /> },
];

const OBJECTIVE_OPTIONS = [
  { id: 'speaker', label: OBJECTIVE_LABELS.speaker },
  { id: 'project_partner', label: OBJECTIVE_LABELS.project_partner },
  { id: 'benchmark', label: OBJECTIVE_LABELS.benchmark },
  { id: 'research_support', label: OBJECTIVE_LABELS.research_support },
  { id: 'guided', label: OBJECTIVE_LABELS.guided },
];

/**
 * Um passo do preparo, com o trilho numerado à esquerda.
 *
 * O trilho é o que transforma dois blocos soltos numa sequência: sem ele, "1."
 * e "2." eram apenas texto em negrito, e nada ligava um ao outro.
 */
function SetupStep({ number, title, children, done, disabled, disabledHint, last }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, opacity: disabled ? .55 : 1 }}>
      <Stack alignItems="center" sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: T.fontSize.caption,
            bgcolor: done ? T.ink.accent : T.surface.sunken,
            color: done ? '#fff' : T.ink.muted,
            border: `2px solid ${done ? T.ink.accent : T.border.base}`,
          }}
        >
          {done ? <CheckIcon sx={{ fontSize: 17 }} /> : number}
        </Box>
        {!last && <Box aria-hidden sx={{ flex: 1, width: 2, bgcolor: T.border.subtle, my: .5 }} />}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0, pb: last ? 3 : 4 }}>
        <Typography variant="h4" sx={{ color: T.ink.strong }}>
          <Box component="span" sx={{ display: { md: 'none' }, color: T.ink.accent, mr: .75 }}>{number}.</Box>
          {title}
        </Typography>
        {disabled && disabledHint && (
          <Typography variant="body2" sx={{ mt: .5, color: T.ink.subtle }}>{disabledHint}</Typography>
        )}
        <Box sx={{ mt: 1.75, pointerEvents: disabled ? 'none' : 'auto' }} aria-disabled={disabled || undefined}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default function SelectionPage() {
  const data = useData();
  const [phase, setPhase] = useState('setup');
  const [category, setCategory] = useState('');
  const [objective, setObjective] = useState('');
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [plannerState, setPlannerState] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [interviewTrace, setInterviewTrace] = useState([]);
  const [adaptiveStatus, setAdaptiveStatus] = useState(null);
  const [adaptiveRetry, setAdaptiveRetry] = useState(null);

  const reviewQuestions = useMemo(() => (plannerState?.askedIds || []).map((id) => plannerState?.questionDefinitions?.[id] || QUESTION_BANK.find((item) => item.id === id)).filter(Boolean).map((item) => ({ ...item, label: item.prompt, example: 'Revise a resposta registrada e ajuste apenas o que desejar.' })), [plannerState]);
  // A conversa até aqui fica visível: é o que diferencia uma entrevista de um
  // formulário com uma pergunta por tela.
  const conversation = useMemo(() => (plannerState?.history || []).filter((turn) => turn.answer), [plannerState]);
  const capturedFields = useMemo(() => Object.entries(plannerState?.derived || {}).map(([field, detail]) => ({ field, label: fieldLabel(field), evidence: detail.evidence || [] })), [plannerState]);
  const remainingRequired = plannerState?.validation?.missing || [];
  // O aviso descreve o que de fato aconteceu. Antes, qualquer turno resolvido
  // localmente — inclusive a entrevista simplesmente ter terminado — aparecia
  // como "IA indisponível", o que não era verdade.
  const adaptiveNotice = useMemo(() => {
    if (!adaptiveStatus) return null;
    if (!adaptiveStatus.fallback) {
      return { severity: 'info', retryable: false, message: `Pergunta gerada por IA${adaptiveStatus.model ? ` · ${adaptiveStatus.model}` : ''}.` };
    }
    const kind = adaptiveStatus.fallbackKind || (adaptiveStatus.degraded === false ? 'none' : 'error');
    if (kind === 'none') return null;
    if (kind === 'not_configured') {
      return { severity: 'info', retryable: false, message: 'A IA não está configurada neste ambiente, então a entrevista segue pelo roteiro local. Configure OPENROUTER_API_KEY (ou o provedor Azure) para as perguntas serem escritas pelo modelo.' };
    }
    if (kind === 'budget') {
      return { severity: 'warning', retryable: false, message: 'O limite diário de uso de IA foi atingido; a entrevista segue pelo roteiro local até a cota renovar.' };
    }
    return { severity: 'warning', retryable: true, message: `A IA não respondeu a tempo${adaptiveStatus.fallbackReason ? ` (${adaptiveStatus.fallbackReason})` : ''}; o roteiro local assumiu. Você pode tentar de novo ou continuar.` };
  }, [adaptiveStatus]);
  const questions = reviewing ? reviewQuestions : (plannerState?.currentQuestion ? [plannerState.currentQuestion] : []);
  const question = reviewing ? reviewQuestions[questionIndex] : plannerState?.currentQuestion;
  const currentAnswer = plannerState?.answers?.[question?.id] || '';

  function chooseCategory(value) {
    setCategory(value);
    setObjective('');
    setAnswers({});
    setError('');
    setPlannerState(null);
    setReviewing(false);
    setInterviewTrace([]);
    setAdaptiveStatus(null);
    setAdaptiveRetry(null);
  }

  function beginInterview() {
    if (!category || !objective) return;
    setPhase('interview');
    setQuestionIndex(0);
    setReviewing(false);
    setInterviewTrace([]);
    setAdaptiveStatus(null);
    setAdaptiveRetry(null);
    setPlannerState(InterviewPlanner.start({ category, objective }));
  }

  function setAnswer(value) {
    setPlannerState((previous) => previous ? { ...previous, answers: { ...previous.answers, [question.id]: value } } : previous);
  }

  async function finishInterview(finalAnswers = answers, brief = null, traceEntries = interviewTrace) {
    const pool = getCandidatePool({ category, data });
    const local = buildLocalEvaluation({ category, objective, answers: finalAnswers, brief, candidates: pool });
    if (brief) local.trace.selectionBrief = brief;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/selection/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
          body: JSON.stringify({ category, objective, answers: finalAnswers, brief }),
      });
      if (!response.ok) throw new Error('ai_unavailable');
      const payload = await response.json();
      setResult({ ...payload, trace: { ...(payload.trace || {}), interview: traceEntries } });
    } catch {
      setResult({ ...local, trace: { ...(local.trace || {}), interview: traceEntries } });
    } finally {
      setBusy(false);
      setPhase('results');
    }
  }

  async function advanceWithAdaptiveProvider(state, answerValue) {
    setBusy(true);
    setError('');
    const requestState = { ...state, questionDefinitions: { ...(state.questionDefinitions || {}), [state.currentQuestion?.id]: state.currentQuestion } };
    setAdaptiveRetry({ state: requestState, answer: answerValue });
    const answeredState = InterviewPlanner.answer(requestState, answerValue, requestState.currentQuestion?.id);
    let nextState = InterviewPlanner.next(answeredState);
    let providerTrace = { provider: 'local-fallback', model: 'semantic-planner-v2', fallback: true, fallbackReason: 'request_failed' };
    try {
      const response = await fetch('/api/selection/interview-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ state: requestState, questionId: requestState.currentQuestion?.id, answer: answerValue }),
      });
      if (!response.ok) throw new Error('adaptive_interview_unavailable');
      const payload = await response.json();
      if (!payload?.state) throw new Error('adaptive_interview_invalid_response');
      nextState = payload.state;
      providerTrace = payload.trace || providerTrace;
    } catch {
      // O planejador local mantém o fluxo quando a IA não está configurada ou está indisponível.
    }
    const traceEntry = {
      questionId: answeredState.lastAnswered,
      answer: answerValue,
      nextQuestionId: nextState.currentQuestion?.id || null,
      ...providerTrace,
    };
    const nextTrace = [...interviewTrace, traceEntry];
    setAdaptiveStatus(providerTrace);
    setInterviewTrace(nextTrace);
    setPlannerState(nextState);
    setAnswers(nextState.answers || {});
    setBusy(false);
    if (nextState.status === 'ready') {
      const brief = InterviewPlanner.finalize(nextState);
      await finishInterview(brief.answers, brief, nextTrace);
    }
  }

  async function nextQuestion() {
    if (plannerState && !reviewing) {
      await advanceWithAdaptiveProvider(plannerState, currentAnswer || 'não informado');
      return;
    }
    if (plannerState && reviewing) {
      const revised = InterviewPlanner.revise(plannerState, question.id, currentAnswer || 'não informado');
      setPlannerState(revised);
      if (questionIndex >= reviewQuestions.length - 1) {
        setReviewing(false);
        const brief = InterviewPlanner.finalize(revised);
        finishInterview(brief.answers, brief);
      }
      else setQuestionIndex((index) => index + 1);
      return;
    }
    const nextAnswers = { ...answers, [question.id]: currentAnswer || 'não informado' };
    setAnswers(nextAnswers);
    if (questionIndex === questions.length - 1) {
      finishInterview(nextAnswers);
    } else {
      setQuestionIndex((index) => index + 1);
    }
  }

  function previousQuestion() {
    if (reviewing) {
      if (questionIndex === 0) { setReviewing(false); setPhase('results'); }
      else setQuestionIndex((index) => index - 1);
      return;
    }
    if (plannerState) {
      // Reabre a pergunta anterior com a resposta registrada. Só volta ao
      // início quando não há turno anterior para reabrir.
      const rewound = InterviewPlanner.back(plannerState);
      if (rewound !== plannerState) {
        setError('');
        setPlannerState(rewound);
        setAnswers(rewound.answers || {});
        setAdaptiveStatus(null);
        setAdaptiveRetry(null);
        return;
      }
      setPhase('setup');
      return;
    }
    if (questionIndex === 0) {
      setPhase('setup');
    } else {
      setQuestionIndex((index) => index - 1);
    }
  }

  function reviewAnswers() {
    setPhase('interview');
    setReviewing(true);
    setQuestionIndex(0);
  }

  function restart() {
    setPhase('setup');
    setCategory('');
    setObjective('');
    setAnswers({});
    setPlannerState(null);
    setReviewing(false);
    setQuestionIndex(0);
    setResult(null);
    setError('');
    setInterviewTrace([]);
    setAdaptiveStatus(null);
    setAdaptiveRetry(null);
  }

  if (phase === 'results') {
    return (
      <PageContainer width="wide">
        <SelectionResults result={result} onReview={reviewAnswers} onRestart={restart} />
      </PageContainer>
    );
  }

  if (phase === 'setup') {
    return (
      <PageContainer width="page">
        <PageHeader
          eyebrow="SELEÇÃO GUIADA"
          title="Vamos descobrir quem você precisa encontrar"
          description="Duas escolhas rápidas e depois é uma conversa: cada pergunta parte do que você acabou de responder, e ela termina assim que houver informação suficiente."
          accent="selection"
        />

        {/* Os dois passos ficam visíveis desde o começo. Antes, o passo 2 só
            existia depois de escolher a categoria: a tela abria pela metade,
            sem dizer quantas decisões ainda vinham, e a que aparecia empurrava
            o conteúdo para baixo sem aviso. */}
        <Box sx={{ mt: 4 }}>
          <SetupStep
            number={1}
            title="Que tipo de stakeholder você quer selecionar?"
            done={Boolean(category)}
          >
            <Grid container spacing={2}>
              {CATEGORY_OPTIONS.map((option) => {
                const selected = category === option.id;
                return (
                  <Grid size={{ xs: 12, md: 4 }} key={option.id}>
                    <Card
                      sx={{
                        height: '100%',
                        borderColor: selected ? T.ink.accent : T.border.subtle,
                        // A seleção é dupla: borda mais grossa e fundo. Só a
                        // cor da borda não sobrevive a quem não a distingue.
                        borderWidth: selected ? 2 : 1,
                        bgcolor: selected ? T.surface.accentSoft : T.surface.raised,
                        transition: `border-color ${T.motion.fast}, background-color ${T.motion.fast}`,
                      }}
                    >
                      <CardActionArea
                        onClick={() => chooseCategory(option.id)}
                        aria-pressed={selected}
                        sx={{ height: '100%', p: 2.25 }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ color: selected ? T.ink.accent : T.ink.muted, display: 'flex' }}>{option.icon}</Box>
                          {selected && <CheckCircleIcon sx={{ color: T.ink.accent, fontSize: 20 }} />}
                        </Stack>
                        <Typography variant="h5" sx={{ mt: 1.25, color: T.ink.strong }}>{option.label}</Typography>
                        <Typography variant="body2" sx={{ mt: .5, color: T.ink.muted }}>{option.description}</Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </SetupStep>

          <SetupStep
            number={2}
            title="Para que você quer esse stakeholder?"
            done={Boolean(objective)}
            // Desabilitado em vez de ausente: o passo continua legível e diz o
            // que falta para liberá-lo.
            disabled={!category}
            disabledHint="Escolha uma categoria acima para liberar este passo."
            last
          >
            <Stack gap={1}>
              {OBJECTIVE_OPTIONS.map((option) => {
                const selected = objective === option.id;
                return (
                  <Card
                    key={option.id}
                    sx={{
                      borderColor: selected ? T.ink.accent : T.border.subtle,
                      borderWidth: selected ? 2 : 1,
                      bgcolor: selected ? T.surface.accentSoft : T.surface.raised,
                    }}
                  >
                    <CardActionArea onClick={() => setObjective(option.id)} aria-pressed={selected} sx={{ px: 2, py: 1.5 }}>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        {selected
                          ? <CheckCircleIcon sx={{ fontSize: 20, color: T.ink.accent }} />
                          : <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: T.border.strong }} />}
                        <Typography sx={{ fontWeight: selected ? 700 : 500, color: T.ink.strong }}>{option.label}</Typography>
                      </Stack>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Stack>
          </SetupStep>
        </Box>

        <Box sx={{ mt: 1, pl: { md: 5.5 } }}>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            disabled={!category || !objective}
            onClick={beginInterview}
          >
            Começar a entrevista
          </Button>
          {(!category || !objective) && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: T.ink.subtle }}>
              Responda aos dois passos acima para continuar.
            </Typography>
          )}
        </Box>
      </PageContainer>
    );
  }

  if (!question) {
    return (
      <PageContainer width="form" sx={{ py: { xs: 8, md: 10 }, textAlign: 'center' }}>
        <LinearProgress sx={{ maxWidth: 420, mx: 'auto', mb: 3 }} />
        <Typography variant="h3">Preparando sua shortlist…</Typography>
        <Typography sx={{ mt: 1, color: T.ink.muted }}>Estamos organizando as respostas antes de mostrar os resultados.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="form">
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box>
          <Typography variant="overline" sx={{ color: T.tools.selection.dark }}>ENTREVISTA GUIADA</Typography>
          <Typography variant="h4" sx={{ color: T.ink.strong }}>{CATEGORY_LABELS[category]}</Typography>
        </Box>
        <Chip label={reviewing ? 'Revisão ' + (questionIndex + 1) + ' de ' + reviewQuestions.length : remainingRequired.length ? 'Faltam ' + remainingRequired.length + ' informação(ões)' : 'Quase lá'} color="primary" variant="outlined" />
      </Stack>
      {/* O progresso acompanha o que já foi entendido, não uma cota de perguntas. */}
      <LinearProgress variant="determinate" value={reviewing ? ((questionIndex + 1) / Math.max(reviewQuestions.length, 1)) * 100 : Math.min(100, ((conversation.length + capturedFields.length) / Math.max(conversation.length + capturedFields.length + remainingRequired.length, 1)) * 100)} sx={{ mt: 2, height: 8, borderRadius: 4 }} />
      {!reviewing && adaptiveNotice && (
        <Alert severity={adaptiveNotice.severity} sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
            <Typography variant="body2" sx={{ flex: 1 }}>{adaptiveNotice.message}</Typography>
            {adaptiveNotice.retryable && adaptiveRetry && <>
              <Button size="small" variant="outlined" onClick={() => advanceWithAdaptiveProvider(adaptiveRetry.state, adaptiveRetry.answer)} disabled={busy}>Tentar novamente</Button>
              <Button size="small" onClick={() => setAdaptiveStatus(null)} disabled={busy}>Continuar localmente</Button>
            </>}
          </Stack>
        </Alert>
      )}
      {!reviewing && conversation.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 3, p: { xs: 2, md: 2.5 }, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" fontWeight={800} color="text.secondary">A conversa até aqui</Typography>
          <Stack spacing={1.25} sx={{ mt: 1.25 }}>
            {conversation.map((turn) => (
              <Box key={turn.turn}>
                <Typography variant="caption" color="text.secondary" display="block">{turn.displayedQuestion}</Typography>
                <Typography variant="body2" sx={{ borderLeft: '3px solid', borderColor: 'secondary.main', pl: 1.25, mt: .25 }}>{turn.answer}</Typography>
              </Box>
            ))}
          </Stack>
          {capturedFields.length > 0 && (
            <Box sx={{ mt: 1.75 }}>
              <Typography variant="caption" color="text.secondary" display="block">Já anotei destas respostas, sem precisar perguntar de novo:</Typography>
              <Stack direction="row" gap={.75} flexWrap="wrap" sx={{ mt: .75 }}>
                {capturedFields.map((item) => <Chip key={item.field} size="small" variant="outlined" color="success" label={item.label} title={item.evidence.join(' · ')} />)}
              </Stack>
            </Box>
          )}
        </Paper>
      )}
      {/* A pergunta é o objeto principal da tela: fundo branco, respiro largo e
          nada disputando com ela. O cartão da conversa acima fica em superfície
          rebaixada justamente para não competir. */}
      <Card sx={{ mt: 3, p: { xs: 2.5, md: 4 } }}>
        <Typography variant="h2" sx={{ color: T.ink.strong }}>{question.label}</Typography>
        {question.helper && <Typography sx={{ mt: 1, color: T.ink.muted }}>{question.helper}</Typography>}
        <Stack direction="row" gap={1.25} sx={{ mt: 2, p: 1.5, borderRadius: `${T.radius.sm}px`, bgcolor: T.surface.accentSoft }}>
          <LightbulbOutlinedIcon sx={{ color: T.ink.accent, fontSize: 20, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: T.ink.base }}>{question.example}</Typography>
        </Stack>
        <TextField
          fullWidth
          multiline={question.kind === 'textarea'}
          minRows={question.kind === 'textarea' ? 5 : 2}
          value={currentAnswer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Digite sua resposta ou escreva “não sei ainda”."
          aria-label={question.label}
          sx={{ mt: 3 }}
          autoFocus
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: T.ink.subtle }}>{question.answerHint}</Typography>
        {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      </Card>

      {/* Barra fixa: as ações não mudam de lugar quando a pergunta, o exemplo
          ou a conversa acima crescem. A largura mínima dos botões impede que
          a troca de rótulo ("Calculando…") desloque a posição deles. */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          mt: 3,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
          py: 1.75,
          bgcolor: T.surface.canvas,
          borderTop: `1px solid ${T.border.subtle}`,
        }}
      >
        {/* Os dois botões têm a mesma altura e a mesma largura mínima; o que os
            distingue é o preenchimento — o de avançar é sólido, o de voltar é
            contornado. Antes os dois eram sólidos e só a cor os separava. */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          <Button variant="outlined" size="large" startIcon={<ArrowBackIcon />} onClick={previousQuestion} disabled={busy} sx={{ minWidth: { xs: 0, sm: 210 } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Pergunta anterior</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Voltar</Box>
          </Button>
          <Button
            variant="contained"
            size="large"
            endIcon={reviewing && questionIndex === reviewQuestions.length - 1 ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />}
            onClick={nextQuestion}
            disabled={busy}
            sx={{ minWidth: { xs: 0, sm: 210 } }}
          >
            {busy ? 'Calculando…' : reviewing && questionIndex === reviewQuestions.length - 1 ? 'Voltar aos resultados' : 'Próxima pergunta'}
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  );
}
