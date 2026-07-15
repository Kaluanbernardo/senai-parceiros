import React, { useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
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
import { buildInterview, CATEGORY_LABELS, OBJECTIVE_LABELS } from '../domain/interview';
import { buildLocalEvaluation, getCandidatePool } from '../domain/selectionEngine';
import SelectionResults from '../components/SelectionResults';

const CATEGORY_OPTIONS = [
  { id: 'researcher', label: CATEGORY_LABELS.researcher, description: 'Pessoa com conhecimento especializado, produção ou experiência relevante.', icon: <ScienceIcon sx={{ fontSize: 34 }} /> },
  { id: 'school', label: CATEGORY_LABELS.school, description: 'Escola, centro de formação ou instituição de educação profissional.', icon: <SchoolIcon sx={{ fontSize: 34 }} /> },
  { id: 'organization', label: CATEGORY_LABELS.organization, description: 'Empresa, órgão público, associação, fundação ou rede.', icon: <BusinessIcon sx={{ fontSize: 34 }} /> },
];

const OBJECTIVE_OPTIONS = [
  { id: 'speaker', label: OBJECTIVE_LABELS.speaker },
  { id: 'project_partner', label: OBJECTIVE_LABELS.project_partner },
  { id: 'benchmark', label: OBJECTIVE_LABELS.benchmark },
  { id: 'research_support', label: OBJECTIVE_LABELS.research_support },
  { id: 'guided', label: OBJECTIVE_LABELS.guided },
];

export default function SelectionPage() {
  const data = useData();
  const [phase, setPhase] = useState('setup');
  const [category, setCategory] = useState('');
  const [objective, setObjective] = useState('');
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const questions = useMemo(() => buildInterview({ category, objective }), [category, objective]);
  const question = questions[questionIndex];
  const currentAnswer = answers[question?.id] || '';

  function chooseCategory(value) {
    setCategory(value);
    setObjective('');
    setAnswers({});
    setError('');
  }

  function beginInterview() {
    if (!category || !objective) return;
    setPhase('interview');
    setQuestionIndex(0);
  }

  function setAnswer(value) {
    setAnswers((previous) => ({ ...previous, [question.id]: value }));
  }

  async function finishInterview(finalAnswers = answers) {
    const pool = getCandidatePool({ category, data });
    const local = buildLocalEvaluation({ category, objective, answers: finalAnswers, candidates: pool });
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/selection/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, objective, answers: finalAnswers }),
      });
      if (!response.ok) throw new Error('ai_unavailable');
      const payload = await response.json();
      setResult(payload);
    } catch {
      setResult(local);
    } finally {
      setBusy(false);
      setPhase('results');
    }
  }

  function nextQuestion() {
    const nextAnswers = { ...answers, [question.id]: currentAnswer || 'não informado' };
    setAnswers(nextAnswers);
    if (questionIndex === questions.length - 1) {
      finishInterview(nextAnswers);
    } else {
      setQuestionIndex((index) => index + 1);
    }
  }

  function previousQuestion() {
    if (questionIndex === 0) {
      setPhase('setup');
    } else {
      setQuestionIndex((index) => index - 1);
    }
  }

  function reviewAnswers() {
    setPhase('interview');
    setQuestionIndex(0);
  }

  function restart() {
    setPhase('setup');
    setCategory('');
    setObjective('');
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
    setError('');
  }

  if (phase === 'results') {
    return <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}><SelectionResults result={result} onReview={reviewAnswers} onRestart={restart} /></Box>;
  }

  if (phase === 'setup') {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
        <Typography variant="overline" color="secondary.main" fontWeight={800}>SELEÇÃO GUIADA</Typography>
        <Typography variant="h3" sx={{ mt: 1, fontSize: { xs: '2rem', md: '3rem' } }}>Vamos descobrir quem você precisa encontrar.</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>Começaremos pela categoria. Depois, algumas perguntas simples transformarão seu contexto em critérios de busca.</Typography>
        <Typography variant="h6" fontWeight={800} sx={{ mt: 4, mb: 1.5 }}>1. Que tipo de stakeholder você quer selecionar?</Typography>
        <Grid container spacing={2}>
          {CATEGORY_OPTIONS.map((option) => (
            <Grid size={{ xs: 12, md: 4 }} key={option.id}>
              <Card variant="outlined" sx={{ height: '100%', borderColor: category === option.id ? 'secondary.main' : 'divider', borderWidth: category === option.id ? 2 : 1 }}>
                <CardActionArea onClick={() => chooseCategory(option.id)} sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ color: category === option.id ? 'secondary.main' : 'primary.main' }}>{option.icon}</Box>
                    <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>{option.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{option.description}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
        {category && (
          <>
            <Typography variant="h6" fontWeight={800} sx={{ mt: 4, mb: 1.5 }}>2. Para que você quer esse stakeholder?</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                {OBJECTIVE_OPTIONS.map((option) => (
                  <Button key={option.id} variant={objective === option.id ? 'contained' : 'text'} color={objective === option.id ? 'secondary' : 'inherit'} onClick={() => setObjective(option.id)} sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.2 }}>
                    {objective === option.id ? <CheckCircleOutlineIcon sx={{ mr: 1 }} /> : <Box sx={{ width: 28 }} />}
                    {option.label}
                  </Button>
                ))}
              </Stack>
            </Paper>
            <Button variant="contained" size="large" endIcon={<ArrowForwardIcon />} disabled={!objective} onClick={beginInterview} sx={{ mt: 3 }}>Continuar entrevista</Button>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box><Typography variant="overline" color="secondary.main" fontWeight={800}>ENTREVISTA GUIADA</Typography><Typography variant="h5" fontWeight={800}>{CATEGORY_LABELS[category]}</Typography></Box>
        <Chip label={'Pergunta ' + (questionIndex + 1) + ' de ' + questions.length} color="primary" variant="outlined" />
      </Stack>
      <LinearProgress variant="determinate" value={((questionIndex + 1) / questions.length) * 100} sx={{ mt: 2, height: 8, borderRadius: 4 }} />
      <Paper variant="outlined" sx={{ mt: 4, p: { xs: 2.5, md: 5 } }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.65rem', md: '2.35rem' } }}>{question.label}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{question.helper}</Typography>
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,51,102,.05)', display: 'flex', gap: 1 }}>
          <LightbulbOutlinedIcon color="primary" /><Typography variant="body2">{question.example}</Typography>
        </Box>
        <TextField fullWidth multiline={question.kind === 'textarea'} minRows={question.kind === 'textarea' ? 5 : 2} value={currentAnswer} onChange={(event) => setAnswer(event.target.value)} placeholder="Digite sua resposta ou escreva “não sei ainda”." sx={{ mt: 3 }} autoFocus />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{question.answerHint}</Typography>
        {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={previousQuestion}>Voltar</Button>
          <Button variant="contained" endIcon={questionIndex === questions.length - 1 ? <CheckCircleOutlineIcon /> : <ArrowForwardIcon />} onClick={nextQuestion} disabled={busy}>{busy ? 'Calculando…' : questionIndex === questions.length - 1 ? 'Calcular shortlist' : 'Próxima pergunta'}</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
