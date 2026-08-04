import { CATEGORY_IDS, OBJECTIVE_IDS } from './interview.js';
import { getExampleCoverage, resolveExample } from './exampleResolver.js';
import { COVERAGE_CONFIDENCE_THRESHOLD, deriveFieldCoverage, focusTermFor } from './answerSignals.js';
import { deriveDimensionWeights } from './selectionCriteria.js';

export const INTERVIEW_PLANNER_VERSION = 'conversational-planner-v3';
/**
 * A entrevista para quando tem o que precisa, não quando bate uma cota.
 * O teto existe apenas como proteção; o piso garante que a conversa não
 * termine antes de o contexto ficar minimamente formado.
 */
export const MAX_QUESTIONS = 12;
export const MIN_QUESTIONS = 4;

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

/** Rótulos curtos usados para mostrar ao usuário o que já ficou registrado. */
export const FIELD_LABELS = Object.freeze({
  context: 'situação',
  desired_outcome: 'resultado esperado',
  success_indicators: 'sinais de sucesso',
  themes: 'temas',
  contribution_types: 'tipo de contribuição',
  audience: 'público',
  communication_style: 'formato da participação',
  partnership_model: 'modelo de parceria',
  benchmark_focus: 'foco do benchmarking',
  research_output: 'apoio à pesquisa',
  evidence_preferences: 'evidência esperada',
  geography: 'geografia e idioma',
  timeframe: 'prazo',
  language_modality: 'modalidade',
  budget: 'orçamento',
  constraints: 'restrições',
  risk_rules: 'riscos a observar',
  diversity_preferences: 'equilíbrio da shortlist',
});

export function fieldLabel(id) {
  return FIELD_LABELS[id] || String(id || '').replace(/_/g, ' ');
}

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

/**
 * Aberturas por categoria e objetivo. Mesmo a primeira pergunta — a única que
 * não pode nascer de uma resposta anterior — deixa de ser uma frase única para
 * todo mundo.
 */
const OPENERS = Object.freeze({
  'researcher:speaker': { prompt: 'Conte o que vai acontecer: que encontro ou conversa você quer que essa pessoa ajude a construir?', helper: 'Descreva o evento, o momento e o que precisa sair dali.' },
  'researcher:research_support': { prompt: 'Que pergunta ou decisão de pesquisa está travada e precisa de alguém de fora?', helper: 'Explique o estudo ou a dúvida com suas palavras.' },
  'researcher:benchmark': { prompt: 'O que você quer entender comparando com o trabalho de outra pessoa?', helper: 'Descreva a prática ou abordagem que está tentando avaliar.' },
  'school:benchmark': { prompt: 'Que decisão do SENAI-SP você quer informar comparando com outras instituições?', helper: 'Descreva o que está em jogo, não só o que quer comparar.' },
  'school:project_partner': { prompt: 'O que você quer construir junto com outra instituição de formação?', helper: 'Fale do projeto ou da mudança pretendida.' },
  'organization:project_partner': { prompt: 'Que iniciativa você quer tirar do papel com apoio de outra organização?', helper: 'Descreva a iniciativa e o que falta hoje para ela avançar.' },
  'organization:speaker': { prompt: 'Em que conversa ou evento essa organização entraria, e por quê?', helper: 'Descreva o momento e o que você espera que mude depois.' },
  researcher: { prompt: 'Em que situação você pretende envolver um pesquisador ou especialista?', helper: 'Descreva a situação com suas palavras; não precisa de termos técnicos.' },
  school: { prompt: 'Em que situação você pretende envolver outra escola ou instituição de EPT?', helper: 'Descreva a situação com suas palavras; não precisa de termos técnicos.' },
  organization: { prompt: 'Em que situação você pretende envolver uma organização parceira?', helper: 'Descreva a situação com suas palavras; não precisa de termos técnicos.' },
});

/**
 * Variações de encadeamento. A pergunta seguinte retoma o que a pessoa disse
 * sem repetir sempre a mesma fórmula, que era o que fazia a entrevista soar
 * como um formulário com um prefixo colado na frente.
 */
const PROMPT_VARIANTS = Object.freeze([
  (focus, prompt) => `Você falou em “${focus}”. ${prompt}`,
  (focus, prompt) => `Partindo de “${focus}”, ${lowerFirst(prompt)}`,
  (focus, prompt) => `Ainda sobre “${focus}”: ${lowerFirst(prompt)}`,
  (focus, prompt) => `Com “${focus}” em vista, ${lowerFirst(prompt)}`,
]);

function lowerFirst(text) {
  const value = String(text || '');
  if (value.length < 2 || value[1] !== value[1].toLocaleLowerCase('pt-BR')) return value;
  return value[0].toLocaleLowerCase('pt-BR') + value.slice(1);
}

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
function answerForField(state, id) {
  if (Object.prototype.hasOwnProperty.call(state.answers || {}, id)) return state.answers[id];
  const dynamic = Object.entries(state.answers || {}).find(([answerId]) => definitionFor(state, answerId)?.targetField === id);
  return dynamic ? dynamic[1] : undefined;
}
function derivedFor(state, id) { return state?.derived?.[id]; }
function answered(state, id) {
  const value = answerForField(state, id);
  if (value !== undefined && !isUnknown(value)) return true;
  // Uma resposta rica cobre vários campos de uma vez. Perguntar de novo o que
  // a pessoa acabou de dizer é o que fazia a entrevista parecer um formulário.
  return Boolean(derivedFor(state, id));
}
function needsFollowUp(state, id) {
  const value = answerForField(state, id);
  return value !== undefined && isUnknown(value) && !derivedFor(state, id);
}

/**
 * Recalcula, a partir do histórico inteiro, quais campos canônicos já foram
 * respondidos indiretamente. Recalcular tudo (em vez de acumular) mantém a
 * revisão de uma resposta coerente: retirar uma informação também retira a
 * cobertura que ela dava.
 */
function recomputeDerived(state, history) {
  const derived = {};
  for (const entry of history || []) {
    if (entry.unknown) continue;
    const field = entry.targetField || entry.questionId;
    const coverage = deriveFieldCoverage(entry.answer, { field });
    for (const [id, detail] of Object.entries(coverage)) {
      // Um campo perguntado diretamente nunca é substituído por inferência.
      if (Object.prototype.hasOwnProperty.call(state.answers || {}, id)) continue;
      if ((history || []).some((item) => (item.targetField || item.questionId) === id && !item.unknown)) continue;
      if (derived[id] && derived[id].confidence >= detail.confidence) continue;
      derived[id] = { ...detail, fromQuestionId: entry.questionId, fromTurn: entry.turn };
    }
  }
  return derived;
}

/** Campos que a IA declarou satisfeitos, validados contra o mesmo limiar local. */
export function withProviderCoverage(state, fieldsSatisfied = []) {
  if (!state || !Array.isArray(fieldsSatisfied) || !fieldsSatisfied.length) return state;
  const derived = { ...(state.derived || {}) };
  for (const item of fieldsSatisfied) {
    const id = String(item?.field || '').trim();
    const value = String(item?.value || '').trim();
    const confidence = Number(item?.confidence);
    if (!id || !value || !Number.isFinite(confidence) || confidence < COVERAGE_CONFIDENCE_THRESHOLD) continue;
    if (Object.prototype.hasOwnProperty.call(state.answers || {}, id)) continue;
    if (!QUESTION_BANK.some((question) => (question.targetField || question.id) === id)) continue;
    if (derived[id] && derived[id].confidence >= confidence) continue;
    derived[id] = { value: value.slice(0, 500), confidence: Number(confidence.toFixed(2)), evidence: ['extraído da resposta pelo entrevistador'], source: 'provider' };
  }
  const validated = validationFor({ ...state, derived });
  return { ...state, derived, coveredFields: coveredFieldsFor({ ...state, derived }), remainingRequiredFields: validated.missing, validation: validated };
}

function coveredFieldsFor(state) {
  const explicit = (state.history || []).filter((item) => !item.unknown).map((item) => item.targetField || item.questionId);
  return [...new Set([...explicit, ...Object.keys(state.derived || {})])];
}
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
  // O reforço semântico ordena o aprofundamento, mas nunca passa à frente de
  // um campo obrigatório ainda em aberto: obrigatoriedade é regra
  // determinística, encadeamento é escolha de redação.
  return index === -1 ? 0 : Math.max(200, 300 - index * 25);
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
    // Um campo já respondido — diretamente ou porque uma resposta anterior o
    // entregou — sai da fila. Sem isso, um reforço semântico conseguia trazer
    // de volta uma pergunta que a pessoa já tinha respondido.
    .filter((question) => !asked.has(question.id) && !answered(state, question.targetField || question.id) && questionAllowed(question, state))
    .sort((left, right) => scoreQuestion(right, state) - scoreQuestion(left, state) || QUESTION_BANK.indexOf(left) - QUESTION_BANK.indexOf(right));
  return candidates[0] || null;
}

function questionForState(question, state) {
  const coverage = getExampleCoverage({ category: state.category, objective: state.objective, context: state.answers?.context || state.context });
  const opener = question.id === 'context'
    ? (OPENERS[`${state.category}:${state.objective}`] || OPENERS[state.category] || null)
    : null;
  const basePrompt = opener?.prompt || question.prompt;
  const helper = opener?.helper || question.helper;
  const previousAnswer = answerText(state.answers?.[state.lastAnswered]);
  const focus = focusTermFor(previousAnswer);
  const variant = PROMPT_VARIANTS[(state.askedIds?.length || 0) % PROMPT_VARIANTS.length];
  const contextualPrompt = focus && !opener ? variant(focus, basePrompt) : basePrompt;
  return {
    ...question,
    targetField: question.targetField || question.id,
    category: state.category,
    objective: state.objective,
    context: state.answers?.context || state.context || '',
    prompt: contextualPrompt,
    label: contextualPrompt,
    helper,
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
    covered: coveredFieldsFor(state),
    derivedFields: Object.keys(state.derived || {}),
    answered: Object.keys(state.answers || {}).length,
    minQuestions: MIN_QUESTIONS,
    maxQuestions: MAX_QUESTIONS,
  };
}

/**
 * Encerramento por cobertura, não por cota: assim que todo campo obrigatório
 * está respondido — diretamente ou porque uma resposta anterior já o entregou —
 * a entrevista acaba. O teto continua valendo como proteção.
 */
function canStop(state) {
  const askedCount = state.askedIds?.length || 0;
  if (askedCount >= MAX_QUESTIONS) return true;
  if (missingRequired(state).length) return false;
  return askedCount >= MIN_QUESTIONS;
}

/** Estado de cobertura consultável pelo endpoint adaptativo. */
export function coverage(state) {
  if (!state) return { missing: [], covered: [], canStop: true, asked: 0 };
  return {
    missing: missingRequired(state),
    covered: coveredFieldsFor(state),
    derivedFields: Object.keys(state.derived || {}),
    asked: state.askedIds?.length || 0,
    canStop: canStop(state),
  };
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
    transcript: [],
    semanticFacts: [],
    remainingGaps: [],
    derived: context ? deriveFieldCoverage(answerText(context), { field: 'context' }) : {},
    coveredFields: context ? ['context'] : [],
    remainingRequiredFields: [],
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
  const definition = definitionFor(state, id) || state.currentQuestion;
  const history = [...(state.history || []), {
    turn: (state.history || []).length + 1,
    questionId: id,
    targetField: definition?.targetField || definition?.id || id,
    displayedQuestion: state.currentQuestion.prompt || state.currentQuestion.label || '',
    dimensions: Array.isArray(definition?.dimensions) ? definition.dimensions : [],
    answer: normalized,
    unknown: isUnknown(normalized),
    reasonTag: state.currentQuestion.reasonTag,
  }];
  const uncertainties = isUnknown(normalized) ? addUnique(state.uncertainties, id) : state.uncertainties.filter((item) => item !== id);
  const withAnswers = { ...state, answers, history, transcript: history, uncertainties, context: answers.context || state.context, lastAnswered: id };
  const next = { ...withAnswers, derived: recomputeDerived(withAnswers, history) };
  const validated = validationFor(next);
  return { ...next, coveredFields: coveredFieldsFor(next), remainingRequiredFields: validated.missing, validation: validated };
}

export function next(state) {
  if (!state) return state;
  return withNext(state);
}

export function revise(state, questionId, value) {
  const definition = definitionFor(state, questionId);
  if (!state || !state.askedIds?.includes(questionId) || !definition) return state;
  const normalized = answerText(value);
  const answers = { ...state.answers, [questionId]: normalized };
  const uncertainties = isUnknown(normalized) ? addUnique(state.uncertainties, questionId) : state.uncertainties.filter((item) => item !== questionId);
  const history = (state.history || []).map((entry) => entry.questionId === questionId
    ? { ...entry, answer: normalized, unknown: isUnknown(normalized) }
    : entry);
  const revised = { ...state, answers, history, transcript: history, uncertainties, status: 'active', currentQuestion: questionForState(definition, { ...state, answers }) };
  // Rever uma resposta também revê o que ela cobria indiretamente.
  const next = { ...revised, derived: recomputeDerived(revised, history) };
  const validated = validationFor(next);
  return { ...next, coveredFields: coveredFieldsFor(next), validation: validated, remainingRequiredFields: validated.missing };
}

export function finalize(state) {
  if (!state) return null;
  const rawAnswers = { ...(state.answers || {}) };
  const answers = {};
  for (const [id, value] of Object.entries(rawAnswers)) {
    const field = definitionFor(state, id)?.targetField || id;
    // Prefer the canonical/static answer when both a static and an adaptive
    // turn addressed the same field. This keeps the ranking contract stable.
    if (!Object.prototype.hasOwnProperty.call(answers, field) || !isUnknown(answers[field])) answers[field] = value;
  }
  // O que a pessoa entregou de passagem entra no briefing como resposta de
  // fato — é o motivo pelo qual a pergunta não foi repetida.
  const derived = state.derived || {};
  for (const [field, detail] of Object.entries(derived)) {
    if (!Object.prototype.hasOwnProperty.call(answers, field) || isUnknown(answers[field])) answers[field] = detail.value;
  }
  const unknowns = [...new Set([
    ...(state.uncertainties || []).map((id) => definitionFor(state, id)?.targetField || id),
    ...Object.keys(answers).filter((id) => isUnknown(answers[id])),
  ])].filter((id) => !derived[id]);
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
    uncertainties: unknowns,
    answers,
    rawAnswers,
    derivedAnswers: Object.fromEntries(Object.entries(derived).map(([field, detail]) => [field, { confidence: detail.confidence, evidence: detail.evidence, fromQuestionId: detail.fromQuestionId || null, source: detail.source || 'local-signals' }])),
    planner: { version: INTERVIEW_PLANNER_VERSION, askedIds: [...state.askedIds], questionsAsked: state.askedIds.length, validation: validationFor(state) },
  };
  // Os pesos saem do objetivo e dos sinais das respostas, não de uma constante.
  const criteria = deriveDimensionWeights({ objective: brief.objective, category: brief.category, brief, answers });
  brief.dimensionWeights = criteria.weights;
  brief.criteria = { version: criteria.version, profile: criteria.profile, groupWeights: criteria.groupWeights, adjustments: criteria.adjustments };
  return brief;
}

export const InterviewPlanner = Object.freeze({ start, answer, next, revise, finalize, coverage, withProviderCoverage });
export { QUESTION_BANK };
