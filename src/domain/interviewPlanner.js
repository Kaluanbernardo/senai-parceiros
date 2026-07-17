import { CATEGORY_IDS, OBJECTIVE_IDS } from './interview.js';
import { getExampleCoverage, resolveExample } from './exampleResolver.js';

export const INTERVIEW_PLANNER_VERSION = 'semantic-planner-v2';
export const MAX_QUESTIONS = 20;
export const MIN_QUESTIONS = 8;

const UNKNOWN_PATTERN = /^(?:n[aã]o sei(?: ainda)?|ainda n[aã]o sei|desconhe[cç]o|sem prefer[eê]ncia|indefinido|n[aã]o informado|nao informado|\?|-)$/i;

const QUESTION_BANK = Object.freeze([
  {
    id: 'context', stage: 'intention', dimensions: ['impact', 'alignment'], kind: 'textarea', required: true,
    prompt: 'Em que situação você pretende envolver esse stakeholder?', helper: 'Descreva o evento, projeto ou decisão sem precisar usar termos técnicos.',
    reasonTag: 'estabelecer_contexto',
  },
  {
    id: 'desired_outcome', stage: 'outcome', dimensions: ['impact', 'alignment'], kind: 'textarea', required: true,
    prompt: 'Que resultado concreto você espera alcançar?', helper: 'Pense no que deverá estar diferente depois desse contato.',
    reasonTag: 'definir_resultado',
  },
  {
    id: 'success_indicators', stage: 'outcome', dimensions: ['impact', 'credibility'], kind: 'textarea',
    prompt: 'Como você saberá que a escolha deu certo?', helper: 'Pode ser uma entrega, decisão, aprendizagem ou parceria iniciada.',
    reasonTag: 'definir_sucesso',
  },
  {
    id: 'themes', stage: 'strategic_fit', dimensions: ['alignment', 'impact'], kind: 'textarea', required: true,
    prompt: 'Quais temas ou competências devem aparecer?', helper: 'Liste palavras soltas ou escreva que ainda não sabe.',
    reasonTag: 'identificar_temas',
  },
  {
    id: 'contribution_types', stage: 'strategic_fit', dimensions: ['impact', 'collaboration'], kind: 'multiline',
    prompt: 'Que tipo de contribuição seria mais valiosa?', helper: 'Exemplos: evidência, rede, equipamento, currículo, dados, palestra ou execução.',
    reasonTag: 'definir_contribuicao',
  },
  {
    id: 'audience', stage: 'format', dimensions: ['impact', 'collaboration'], kind: 'textarea', required: true,
    prompt: 'Quem é o público ou beneficiário principal?', helper: 'Isso ajuda a diferenciar profundidade técnica, linguagem e alcance.',
    reasonTag: 'identificar_publico',
  },
  {
    id: 'communication_style', stage: 'format', dimensions: ['collaboration', 'feasibility'], objectives: ['speaker'], kind: 'textarea',
    prompt: 'Que formato e estilo de participação seriam mais úteis?', helper: 'Considere palestra, mesa-redonda, oficina, conversa técnica e duração.',
    reasonTag: 'definir_formato',
  },
  {
    id: 'partnership_model', stage: 'collaboration', dimensions: ['collaboration', 'impact'], objectives: ['project_partner'], kind: 'textarea',
    prompt: 'O que você espera construir em conjunto?', helper: 'Pode ser currículo, pesquisa aplicada, laboratório, intercâmbio ou projeto-piloto.',
    reasonTag: 'definir_modelo_parceria',
  },
  {
    id: 'benchmark_focus', stage: 'strategic_fit', dimensions: ['alignment', 'credibility'], objectives: ['benchmark'], kind: 'textarea',
    prompt: 'Qual prática você quer entender ou comparar?', helper: 'Descreva o aspecto transferível, não apenas o nome da instituição.',
    reasonTag: 'definir_benchmark',
  },
  {
    id: 'research_output', stage: 'evidence', dimensions: ['credibility', 'impact'], objectives: ['research_support'], kind: 'textarea',
    prompt: 'Que tipo de contribuição você espera para a pesquisa?', helper: 'Pode ser dado, método, análise, acesso a rede ou revisão especializada.',
    reasonTag: 'definir_apoio_pesquisa',
  },
  {
    id: 'evidence_preferences', stage: 'evidence', dimensions: ['credibility', 'risk'], kind: 'textarea',
    prompt: 'Que evidência faria você confiar nessa recomendação?', helper: 'Exemplos: publicações, resultados, certificações, casos ou fonte institucional.',
    reasonTag: 'definir_evidencia',
  },
  {
    id: 'geography', stage: 'feasibility', dimensions: ['feasibility', 'collaboration'], required: true, kind: 'text',
    prompt: 'Há alguma preferência geográfica ou de idioma?', helper: 'Pode ser São Paulo, Brasil, exterior, remoto ou sem preferência.',
    reasonTag: 'definir_geografia',
  },
  {
    id: 'timeframe', stage: 'feasibility', dimensions: ['feasibility'], kind: 'text',
    prompt: 'Quando você precisa desse contato ou resultado?', helper: 'Uma estimativa basta; você pode responder que não há prazo.',
    reasonTag: 'definir_prazo',
  },
  {
    id: 'language_modality', stage: 'feasibility', dimensions: ['feasibility', 'collaboration'], kind: 'text',
    prompt: 'Que idioma e modalidade de interação são possíveis?', helper: 'Considere presencial, remoto, híbrido e idiomas aceitos.',
    reasonTag: 'definir_modalidade',
  },
  {
    id: 'budget', stage: 'feasibility', dimensions: ['feasibility'], kind: 'text',
    prompt: 'Existe algum limite de orçamento ou disponibilidade?', helper: 'Se ainda não souber, indique isso; a lacuna ficará visível no resultado.',
    reasonTag: 'definir_recursos',
  },
  {
    id: 'constraints', stage: 'risk', dimensions: ['feasibility', 'risk'], required: true, kind: 'textarea',
    prompt: 'Existe alguma restrição importante?', helper: 'Considere conflito de interesses, acesso, orçamento, prazo, idioma ou formato.',
    reasonTag: 'identificar_restricoes',
  },
  {
    id: 'risk_rules', stage: 'risk', dimensions: ['risk'], kind: 'textarea',
    prompt: 'Há algum risco ou critério eliminatório que devemos observar?', helper: 'Riscos graves só serão confirmados por evidência objetiva e verificável.',
    reasonTag: 'definir_riscos',
  },
  {
    id: 'diversity_preferences', stage: 'diversity', dimensions: ['impact', 'collaboration'], kind: 'textarea',
    prompt: 'Você gostaria de equilibrar a shortlist de alguma forma?', helper: 'Exemplos: regiões, tipos de instituição, setores ou perspectivas diferentes.',
    reasonTag: 'definir_diversidade',
  },
  {
    id: 'context_discovery', stage: 'intention', dimensions: ['impact', 'alignment'], kind: 'textarea', followUpFor: ['context'],
    prompt: 'Que situação, público ou necessidade ajuda a explicar melhor esse contexto?', helper: 'Uma frase curta já ajuda; se não souber, podemos continuar.',
    reasonTag: 'aprofundar_contexto',
  },
  {
    id: 'themes_discovery', stage: 'strategic_fit', dimensions: ['alignment'], kind: 'textarea', followUpFor: ['themes'],
    prompt: 'Qual problema da indústria ou da formação profissional motivou essa busca?', helper: 'Não precisa nomear um tema técnico; descreva o desafio em suas palavras.',
    reasonTag: 'descobrir_tema',
  },
  {
    id: 'audience_discovery', stage: 'format', dimensions: ['impact', 'collaboration'], kind: 'textarea', followUpFor: ['audience'],
    prompt: 'Quem seria mais afetado ou beneficiado por esse trabalho?', helper: 'Pense em pessoas, equipes, estudantes, empresas ou territórios.',
    reasonTag: 'descobrir_publico',
  },
  {
    id: 'constraints_discovery', stage: 'risk', dimensions: ['risk', 'feasibility'], kind: 'textarea', followUpFor: ['constraints'],
    prompt: 'O que certamente não poderia acontecer nessa escolha?', helper: 'Essa resposta ajuda a evitar recomendações inviáveis ou inadequadas.',
    reasonTag: 'descobrir_limite',
  },
]);

const OBJECTIVE_REQUIRED = Object.freeze({
  speaker: ['communication_style'],
  project_partner: ['partnership_model'],
  benchmark: ['benchmark_focus'],
  research_support: ['research_output'],
  guided: ['desired_outcome'],
});

const CATEGORY_REQUIRED = Object.freeze({
  researcher: ['evidence_preferences'],
  school: ['evidence_preferences'],
  organization: ['evidence_preferences'],
});

const DEFAULT_WEIGHTS = Object.freeze({ impact: 0.18, alignment: 0.24, credibility: 0.16, collaboration: 0.14, feasibility: 0.14, risk: 0.14 });

function safeCategory(category) { return CATEGORY_IDS.includes(category) ? category : 'organization'; }
function safeObjective(objective) { return OBJECTIVE_IDS.includes(objective) ? objective : 'guided'; }
function questionById(id) { return QUESTION_BANK.find((question) => question.id === id) || null; }
function definitionFor(state, id) { return state?.questionDefinitions?.[id] || questionById(id); }
function answerText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join('; ');
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
function isUnknown(value) {
  const text = answerText(value);
  return !text || UNKNOWN_PATTERN.test(text);
}
function answered(state, id) { return Object.prototype.hasOwnProperty.call(state.answers || {}, id) && !isUnknown(state.answers[id]); }
function needsFollowUp(state, id) { return Object.prototype.hasOwnProperty.call(state.answers || {}, id) && isUnknown(state.answers[id]); }
function toList(value) {
  return answerText(value).split(/[;\n,]/).map((item) => item.trim()).filter(Boolean).filter((item) => !isUnknown(item));
}
function addUnique(list, value) { return list.includes(value) ? list : [...list, value]; }

function requiredIds(state) {
  return [...new Set([
    'context', 'desired_outcome', 'themes', 'audience', 'geography', 'constraints',
    ...(OBJECTIVE_REQUIRED[state.objective] || []),
    ...(CATEGORY_REQUIRED[state.category] || []),
  ])];
}

function questionAllowed(question, state) {
  if (question.categories && !question.categories.includes(state.category)) return false;
  if (question.objectives && !question.objectives.includes(state.objective)) return false;
  if (question.followUpFor && !question.followUpFor.some((id) => needsFollowUp(state, id))) return false;
  return true;
}

function missingRequired(state) { return requiredIds(state).filter((id) => !answered(state, id)); }

function semanticQuestionBoost(question, state) {
  const answer = answerText(state.answers?.[state.lastAnswered]).toLocaleLowerCase('pt-BR');
  if (!answer || isUnknown(answer)) return 0;
  const signals = [
    { pattern: /benchmark|compar|refer[eê]ncia|boa pr[aá]tica|gest[aã]o|curr[ií]cul/, ids: ['benchmark_focus', 'evidence_preferences'] },
    { pattern: /evento|palestra|mesa|oficina|instrutor|estudante|p[uú]blico|audi[eê]ncia/, ids: ['audience', 'communication_style'] },
    { pattern: /parceria|projeto|piloto|coopera|construir|desenvolver em conjunto/, ids: ['partnership_model', 'contribution_types'] },
    { pattern: /urgente|prazo|data|semana|m[eê]s|trimestre/, ids: ['timeframe', 'constraints'] },
    { pattern: /presencial|remoto|h[ií]brido|idioma|internacional|exterior/, ids: ['geography', 'language_modality'] },
    { pattern: /evid[eê]ncia|resultado|indicador|impacto|publica[cç][aã]o|caso/, ids: ['evidence_preferences', 'success_indicators'] },
  ];
  const matched = signals.filter((signal) => signal.pattern.test(answer)).flatMap((signal) => signal.ids);
  const index = matched.indexOf(question.id);
  return index === -1 ? 0 : Math.max(560, 760 - index * 60);
}

function scoreQuestion(question, state) {
  let score = 0;
  const missing = missingRequired(state);
  // Follow-ups to an explicit uncertainty come first; otherwise the planner
  // must always collect the next required field before optional branches.
  if (question.followUpFor?.some((id) => needsFollowUp(state, id))) score += 1000;
  score += semanticQuestionBoost(question, state);
  if (missing.includes(question.id)) score += 500;
  if (question.objectives?.includes(state.objective)) score += 30;
  if (question.stage === state.lastStage) score -= 5;
  score += Math.max(0, 20 - (state.askedIds?.length || 0));
  return score;
}

function nextQuestionFor(state) {
  const asked = new Set(state.askedIds || []);
  // A primeira pergunta isola o contexto antes de qualquer ramo. Isso evita
  // que uma pergunta específica do objetivo apareça para quem ainda não
  // descreveu a situação concreta.
  if (asked.size === 0 && !answered(state, 'context')) return questionById('context');
  const candidates = QUESTION_BANK
    .filter((question) => !asked.has(question.id) && questionAllowed(question, state))
    .sort((left, right) => scoreQuestion(right, state) - scoreQuestion(left, state) || QUESTION_BANK.indexOf(left) - QUESTION_BANK.indexOf(right));
  return candidates[0] || null;
}

function questionForState(question, state) {
  const coverage = getExampleCoverage({ category: state.category, objective: state.objective, context: state.answers?.context || state.context });
  const previousAnswer = answerText(state.answers?.[state.lastAnswered]);
  const clippedAnswer = previousAnswer.slice(0, 120).trim();
  const quotedAnswer = previousAnswer.length > 120 ? `${clippedAnswer}…` : clippedAnswer.replace(/[.!?;:]+$/u, '');
  const contextualPrompt = previousAnswer && !isUnknown(previousAnswer)
    ? `Você mencionou “${quotedAnswer}”. ${question.prompt}`
    : question.prompt;
  return {
    ...question,
    category: state.category,
    objective: state.objective,
    context: state.answers?.context || state.context || '',
    prompt: contextualPrompt,
    label: contextualPrompt,
    example: resolveExample({ questionId: question.id, category: state.category, objective: state.objective, context: state.answers?.context || state.context }),
    exampleCoverage: coverage,
    allowUnknown: true,
    answerHint: 'Você poderá revisar esta resposta antes de calcular o ranking.',
  };
}

function validationFor(state) {
  const missing = missingRequired(state);
  return {
    valid: missing.length === 0,
    missing,
    answered: Object.keys(state.answers || {}).length,
    maxQuestions: MAX_QUESTIONS,
  };
}

function canStop(state) {
  const askedCount = state.askedIds?.length || 0;
  return askedCount >= MAX_QUESTIONS || (askedCount >= MIN_QUESTIONS && missingRequired(state).length === 0);
}

function withNext(state) {
  if (state.status === 'finalized' || state.status === 'ready') return state;
  if (canStop(state)) {
    return { ...state, currentQuestion: null, status: 'ready', validation: validationFor(state), progress: { asked: state.askedIds.length, max: MAX_QUESTIONS } };
  }
  const nextQuestion = nextQuestionFor(state);
  if (!nextQuestion) return { ...state, currentQuestion: null, status: 'ready', validation: validationFor(state), progress: { asked: state.askedIds.length, max: MAX_QUESTIONS } };
  const askedIds = addUnique(state.askedIds, nextQuestion.id);
  const questionDefinitions = { ...(state.questionDefinitions || {}), [nextQuestion.id]: questionForState(nextQuestion, state) };
  return { ...state, askedIds, questionDefinitions, currentQuestion: questionDefinitions[nextQuestion.id], lastStage: nextQuestion.stage, status: 'active', validation: validationFor({ ...state, askedIds }), progress: { asked: askedIds.length, max: MAX_QUESTIONS } };
}

export function start({ category, objective, context = '', gaps = [] } = {}) {
  const safe = { category: safeCategory(category), objective: safeObjective(objective) };
  const state = {
    version: INTERVIEW_PLANNER_VERSION,
    category: safe.category,
    objective: safe.objective,
    context: answerText(context),
    answers: context ? { context: answerText(context) } : {},
    askedIds: context ? ['context'] : [],
    history: [],
    questionDefinitions: {},
    gaps: Array.isArray(gaps) ? gaps.filter(Boolean).map(String) : [],
    uncertainties: [],
    status: 'active',
    currentQuestion: null,
    validation: null,
    progress: { asked: 0, max: MAX_QUESTIONS },
  };
  return withNext(state);
}

export function answer(state, value, questionId = state?.currentQuestion?.id) {
  if (!state || !state.currentQuestion || state.status !== 'active') return state;
  let answerValue = value;
  let id = questionId;
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
    answerValue = value.value;
    id = value.questionId || id;
  }
  if (!id || id !== state.currentQuestion.id) return { ...state, validation: { ...validationFor(state), error: 'question_mismatch' } };
  const normalized = answerText(answerValue);
  const answers = { ...state.answers, [id]: (id === 'context' && state.context && !isUnknown(state.context)) ? state.context : normalized };
  const history = [...state.history, { questionId: id, answer: normalized, unknown: isUnknown(normalized), reasonTag: state.currentQuestion.reasonTag }];
  const uncertainties = isUnknown(normalized) ? addUnique(state.uncertainties, id) : state.uncertainties.filter((item) => item !== id);
  return { ...state, answers, history, uncertainties, context: answers.context || state.context, validation: validationFor({ ...state, answers }), lastAnswered: id };
}

export function next(state) {
  if (!state) return state;
  return withNext(state);
}

export function revise(state, questionId, value) {
  const definition = definitionFor(state, questionId);
  if (!state || !state.askedIds?.includes(questionId) || !definition) return state;
  const answers = { ...state.answers, [questionId]: answerText(value) };
  const uncertainties = isUnknown(value) ? addUnique(state.uncertainties, questionId) : state.uncertainties.filter((item) => item !== questionId);
  return { ...state, answers, uncertainties, status: 'active', currentQuestion: questionForState(definition, { ...state, answers }), validation: validationFor({ ...state, answers }) };
}

export function finalize(state) {
  if (!state) return null;
  const answers = { ...(state.answers || {}) };
  const unknowns = [...new Set([...state.uncertainties, ...Object.keys(answers).filter((id) => isUnknown(answers[id]))])];
  const brief = {
    category: state.category,
    objective: state.objective,
    context: answerText(answers.context || state.context),
    desiredOutcomes: toList(answers.desired_outcome),
    audience: answerText(answers.audience),
    themes: toList(answers.themes),
    contributionTypes: toList(answers.contribution_types),
    evidencePreferences: toList(answers.evidence_preferences),
    collaborationModel: answerText(answers.partnership_model || answers.collaboration_model),
    feasibility: {
      geography: answerText(answers.geography),
      timeframe: answerText(answers.timeframe),
      languageModality: answerText(answers.language_modality),
      budget: answerText(answers.budget),
    },
    hardConstraints: toList(answers.constraints),
    riskRules: { description: answerText(answers.risk_rules), constraints: toList(answers.constraints) },
    diversityPreferences: { description: answerText(answers.diversity_preferences) },
    dimensionWeights: { ...DEFAULT_WEIGHTS },
    uncertainties: unknowns,
    answers,
    planner: { version: INTERVIEW_PLANNER_VERSION, askedIds: [...state.askedIds], questionsAsked: state.askedIds.length, validation: validationFor(state) },
  };
  return brief;
}

export const InterviewPlanner = Object.freeze({ start, answer, next, revise, finalize });
export { QUESTION_BANK };
