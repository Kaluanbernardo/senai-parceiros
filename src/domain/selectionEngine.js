import { mergeSchoolSources } from './schoolCatalog';
import { extractSignals } from './answerSignals.js';
import { explainCandidate } from './candidateExplanation.js';
import {
  DIMENSIONS, DIMENSION_GROUPS, SELECTION_CRITERIA_VERSION, SUBCRITERIA,
  deriveDimensionWeights, describeCriteria, groupShares,
} from './selectionCriteria.js';
import {
  AUDIENCE_PROFILES, CONTRIBUTION_TYPES, EVIDENCE_TYPES, GEOGRAPHY_SCOPES, LANGUAGES,
  MODALITIES, STRATEGIC_PRIORITIES, SENAI_STRATEGIC_BASELINE, fold, matchTaxonomy,
} from './senaiContext.js';

const STOPWORDS = new Set([
  'para', 'como', 'uma', 'com', 'que', 'dos', 'das', 'por', 'sobre', 'entre', 'mais',
  'esse', 'essa', 'este', 'esta', 'isso', 'ainda', 'não', 'nao', 'sem', 'pela', 'pelo',
  'seus', 'suas', 'nossa', 'nosso', 'quando', 'onde', 'muito', 'todo', 'toda', 'onde',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'their', 'about',
]);

export const DEFAULT_WEIGHTS = {
  impact: 0.18,
  alignment: 0.24,
  credibility: 0.16,
  collaboration: 0.14,
  feasibility: 0.14,
  risk: 0.14,
};

/**
 * Piso absoluto e corte relativo da shortlist. O corte relativo evita tanto
 * uma shortlist vazia num catálogo fraco quanto uma shortlist inflada quando
 * poucos candidatos se destacam muito acima dos demais.
 */
/**
 * Fração mínima da especificidade do pedido que o perfil precisa cobrir para
 * ser considerado relacionado. Abaixo disso, a coincidência é de vocabulário
 * genérico e não sustenta uma indicação.
 */
export const SUPPORT_MIN_SPECIFICITY = 0.15;

/** Campos da entrevista que descrevem o assunto, e não a logística. */
const THEMATIC_ANSWER_FIELDS = Object.freeze([
  'context', 'themes', 'desired_outcome', 'success_indicators', 'contribution_types',
  'audience', 'communication_style', 'partnership_model', 'benchmark_focus', 'research_output',
]);

export const SHORTLIST_POLICY = Object.freeze({
  minimum: 5,
  maximum: 10,
  absoluteFloor: 28,
  relativeToBest: 0.55,
  ceiling: 62,
  institutionDiversity: true,
});

export { SENAI_STRATEGIC_BASELINE };

/**
 * Campos que sustentam a completude usada no controle de risco. O campo
 * `relacao` fica de fora de propósito: descrever a *ausência* de parceria é
 * informação legítima e não pode virar penalidade nem bônus de risco.
 */
const RISK_EVIDENCE_FIELDS = Object.freeze(['nome', 'instituicao', 'cargo', 'pais', 'areas', 'perfis_atuacao', 'pesquisa', 'descricao', 'diferencial', 'website', 'perfil_principal_url', 'linkedin_url', 'scholar']);

const EVIDENCE_FIELDS = Object.freeze(['nome', 'instituicao', 'cargo', 'pais', 'areas', 'perfis_atuacao', 'pesquisa', 'descricao', 'diferencial', 'relevancia', 'relacao', 'relacao_publica', 'aderencia_contexto', 'evidencias_publicas', 'producoes_relevantes', 'credenciais_relevantes', 'riscos_sinais', 'website', 'perfil_principal_url', 'linkedin_url', 'scholar']);

const PARTNERSHIP_CONFIRMED = /^(?:\s*(?:✅|🔗))|parceria\s+(?:entre|formalizada|not[aá]vel|firmada|ativa)|parceiro\s+(?:tecnol[oó]gico|de\s+projetos|irm[ãa]o|estrat[eé]gico|oficial)|firmaram|memorando de entendimento|\bmou\b|coopera[cç][ãa]o\s+(?:formalizada|firmada|t[eé]cnica ativa)|^\s*sim\b/i;
const PARTNERSHIP_ABSENT = /sem\s+evid[eê]ncia\s+p[uú]blica\s+de\s+parceria|sem\s+parceria|n[ãa]o\s+h[áa]\s+parceria|parceria\s+n[ãa]o\s+(?:identificada|localizada|confirmada)/i;
const RISK_SIGNAL = /conflito|san[cç][aã]o|sancao|impediment|fraude|corrup|controvers|embargo|ineleg|condena|processo judicial/i;
const SCALE_MARKERS = /\b\d{1,3}(?:[.,]\d{3})+\b|\bmilh[oõ]es?\b|\bbilh[oõ]es?\b|\bmaior\b|\bglobal(?:mente)?\b|\bnacional\b|\brede de\b|\bmais de \d+/i;
const RECOGNITION_MARKERS = /refer[eê]ncia|reconhecid|premi|prêmio|ranking|l[ií]der|renomad|excel[eê]ncia|nobel|acredita[cç][aã]o|certificad/i;

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function tokens(text) {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !STOPWORDS.has(token));
}

function numericCitations(value) {
  const match = String(value || '').replace(/\./g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function candidateText(candidate) {
  return [
    candidate.nome,
    candidate.instituicao,
    candidate.cargo,
    candidate.organizacao,
    candidate.pais,
    candidate.areas,
    candidate.pesquisa,
    candidate.descricao,
    candidate.diferencial,
    candidate.relevancia,
    candidate.relacao,
    candidate.relacao_publica,
    candidate.aderencia_contexto,
    candidate.evidencias_publicas,
    candidate.riscos_sinais,
    candidate.categoria,
    candidate.natureza,
    candidate.miniBio,
    candidate.perfis_atuacao,
    ...(candidate.producoes_relevantes || []).map((item) => item.titulo || item),
    ...(candidate.artigos || []).map((article) => article.titulo),
  ].filter(Boolean).join(' ');
}

function sourceFields(candidate) {
  return Object.entries(candidate)
    .filter(([key, value]) => value && EVIDENCE_FIELDS.includes(key))
    .map(([key]) => key);
}

function riskEvidenceFields(candidate) {
  return RISK_EVIDENCE_FIELDS.filter((field) => Boolean(candidate[field]));
}

function confirmedSevereRisk(candidate) {
  const evidence = [candidate.riscos_sinais, candidate.risco, candidate.risk].filter(Boolean).join(' ').trim();
  const value = fold(evidence);
  if (!value) return null;
  const severeSignal = /sancao|impediment|corrup|fraude|embargo|ineleg|conflito de interesse|condena/.test(value);
  const confirmed = /confirmad|oficial|vigent|sentenca|decisao|lista|condena/.test(value);
  const negated = [
    /(?:sem|nao ha|nenhum|nao localizado).{0,40}(?:sancao|impediment|corrup|fraude|embargo|ineleg|conflito|condena)/,
    /(?:sancao|impediment|corrup|fraude|embargo|ineleg|conflito|condena).{0,50}(?:nao confirmad|nao comprova|sem confirmacao|alegad|suspeit)/,
    /(?:alegad|suspeit).{0,40}(?:sancao|impediment|corrup|fraude|embargo|ineleg|conflito|condena)/,
  ].some((pattern) => pattern.test(value));
  return severeSignal && confirmed && !negated ? { confirmed: true, evidence } : null;
}

/**
 * Perfil de contexto derivado do briefing e das respostas. É aqui que as
 * palavras do usuário e o contexto institucional deixam de ser um único saco
 * de tokens: cada faceta é guardada separadamente e pontuada com seu peso.
 */
export function buildContextProfile({ brief = {}, answers = {}, category, objective } = {}) {
  const userWords = [
    brief.context,
    brief.audience,
    brief.collaborationModel,
    ...(brief.themes || []),
    ...(brief.desiredOutcomes || []),
    ...(brief.contributionTypes || []),
    ...(brief.evidencePreferences || []),
  ].filter(Boolean).map(String).join(' ');
  // Só as respostas temáticas viram termo de aderência. Geografia, prazo,
  // orçamento e restrições são fatos de viabilidade e têm dimensão própria —
  // misturá-los aqui fazia "Brasil" contar como tema e um especialista em
  // poesia "casar" com um pedido sobre inteligência artificial.
  const answerWords = Object.entries(answers || {})
    .filter(([field]) => THEMATIC_ANSWER_FIELDS.includes(field))
    .map(([, value]) => value)
    .filter(Boolean).map(String).join(' ');
  const feasibilityWords = Object.values(brief.feasibility || {}).filter(Boolean).map(String).join(' ');
  const constraintWords = [...(brief.hardConstraints || []), brief.riskRules?.description].filter(Boolean).map(String).join(' ');
  const allText = [userWords, answerWords, feasibilityWords, constraintWords].filter(Boolean).join(' \n ');
  const signals = extractSignals(allText);

  return {
    category,
    objective,
    // Termos vindos exclusivamente das palavras do usuário. O baseline
    // institucional entra em `priorities`, com peso próprio, e nunca dilui
    // este conjunto.
    themeTokens: [...new Set(tokens([userWords, answerWords].filter(Boolean).join(' ')))],
    // As palavras do usuário como ele as escreveu, para a justificativa citar
    // "educação profissional" em vez do token normalizado "educacao".
    themePhrases: [...new Set([...(brief.themes || []), ...String(answers.themes || '').split(/[;\n]/)].map((phrase) => String(phrase).trim()).filter((phrase) => phrase.length > 3))],
    // Prioridades vindas do pedido. Quando o usuário não nomeia nenhuma, esta
    // lista fica vazia de propósito: preenchê-la com o baseline institucional
    // fazia todo candidato "coincidir" com uma agenda que ninguém pediu, e a
    // justificativa passava a afirmar aderência inexistente.
    priorities: signals.priorities,
    baselinePriorities: matchTaxonomy(SENAI_STRATEGIC_BASELINE.join(' '), STRATEGIC_PRIORITIES),
    prioritiesFromUser: signals.priorities.length > 0,
    audiences: signals.audiences,
    contributions: signals.contributions.length ? signals.contributions : matchTaxonomy(brief.collaborationModel || '', CONTRIBUTION_TYPES),
    evidence: signals.evidence.length ? signals.evidence : matchTaxonomy((brief.evidencePreferences || []).join(' '), EVIDENCE_TYPES),
    geography: matchTaxonomy([feasibilityWords, brief.feasibility?.geography, answers.geography].filter(Boolean).join(' ') || allText, GEOGRAPHY_SCOPES),
    modalities: signals.modalities,
    languages: signals.languages,
    horizons: signals.horizons,
    hardConstraints: (brief.hardConstraints || []).map(String),
    constraintText: constraintWords,
    measurable: signals.measurableMarkers.length > 0,
    uncertainties: (brief.uncertainties || []).map(String),
  };
}

/**
 * IDF calculado sobre o próprio catálogo avaliado. Um termo presente em quase
 * todos os perfis ("indústria", "formação") deixa de valer como diferencial;
 * um termo raro e específico passa a valer. Isso substitui a contagem crua de
 * sobreposição que fazia candidatos genéricos parecerem aderentes.
 */
export function buildTermWeights(candidates) {
  const total = candidates.length || 1;
  const documentFrequency = new Map();
  for (const candidate of candidates) {
    for (const token of new Set(tokens(candidateText(candidate)))) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
  }
  const scale = Math.log(total + 1) || 1;
  return {
    total,
    weightOf(token) {
      const frequency = documentFrequency.get(token) || 0;
      return clamp01(Math.log((total + 1) / (frequency + 1)) / scale);
    },
  };
}

function subscore(id, dimension, score, evidence) {
  const definition = SUBCRITERIA[dimension].find((item) => item.id === id);
  return { id, label: definition?.label || id, weight: definition?.weight || 0, score: clamp(score), evidence: (evidence || []).filter(Boolean).slice(0, 4) };
}

function compose(dimension, subscores) {
  const total = subscores.reduce((sum, item) => sum + item.weight, 0) || 1;
  const score = clamp(subscores.reduce((sum, item) => sum + item.score * item.weight, 0) / total);
  return { score, subscores };
}

function taxonomyOverlap(wanted, found) {
  if (!wanted.length) return null;
  const foundIds = new Set(found.map((item) => item.id));
  const hits = wanted.filter((item) => foundIds.has(item.id));
  return { ratio: hits.length / wanted.length, hits, wanted };
}

function scoreAlignment({ candidate, profile, terms, text }) {
  const matchedTokens = profile.themeTokens.filter((token) => text.includes(token));
  const wantedMass = profile.themeTokens.reduce((sum, token) => sum + terms.weightOf(token), 0);
  const matchedMass = matchedTokens.reduce((sum, token) => sum + terms.weightOf(token), 0);
  // Sem temas informados a nota fica explicitamente neutra em vez de premiar
  // quem por acaso repete palavras genéricas do briefing.
  // Zero sobreposição com o que foi pedido significa zero aderência. O piso de
  // 25 que existia aqui dava nota a quem não tinha nenhuma relação com o pedido.
  const themeFit = wantedMass > 0 ? clamp01(matchedMass / wantedMass) * 100 : 50;
  const themeEvidence = wantedMass > 0
    ? [`termos do seu pedido presentes no perfil: ${matchedTokens.slice(0, 6).join(', ') || 'nenhum'}`]
    : ['nenhum tema foi informado na entrevista'];

  const candidatePriorities = matchTaxonomy(candidateText(candidate), STRATEGIC_PRIORITIES);
  // Só as prioridades que o próprio usuário acionou entram na nota. O baseline
  // institucional serve de desempate, com peso menor, e nunca como aderência.
  const priorityOverlap = taxonomyOverlap(profile.priorities, candidatePriorities);
  const baselineOverlap = taxonomyOverlap(profile.baselinePriorities, candidatePriorities);
  const priorityFit = priorityOverlap
    ? priorityOverlap.ratio * 100
    : (baselineOverlap ? Math.min(50, baselineOverlap.ratio * 100) : 50);
  const priorityEvidence = [
    priorityOverlap?.hits.length
      ? `prioridades do seu pedido presentes no perfil: ${priorityOverlap.hits.map((item) => item.label).join('; ')}`
      : profile.prioritiesFromUser
        ? 'nenhuma das prioridades que você indicou aparece no perfil'
        : 'você não indicou prioridades; só o alinhamento institucional foi considerado, com peso reduzido',
  ];

  const nature = fold([candidate.categoria, candidate.natureza, candidate.instituicao].filter(Boolean).join(' '));
  const academic = /universidad|instituto|faculdad|escola|college|research|pesquisa|centro/.test(nature) || Boolean(candidate.scholar);
  const company = /empresa|privada|industria|corpora|s\.a|ltda/.test(nature);
  const profileFit = ({
    benchmark: academic ? 85 : 55,
    research_support: candidate.scholar || academic ? 85 : 45,
    project_partner: company || academic ? 75 : 55,
    speaker: candidate.nome && (candidate.instituicao || candidate.scholar) ? 75 : 60,
    guided: 65,
  })[profile.objective] ?? 65;

  return compose('alignment', [
    subscore('theme_fit', 'alignment', themeFit, themeEvidence),
    subscore('priority_fit', 'alignment', priorityFit, priorityEvidence),
    subscore('profile_fit', 'alignment', profileFit, [`perfil público classificado como ${candidate.categoria || candidate.natureza || 'não informado'}`]),
  ]);
}

function scoreImpact({ candidate, profile, alignment, text }) {
  const candidateContributions = matchTaxonomy(candidateText(candidate), CONTRIBUTION_TYPES);
  const contributionOverlap = taxonomyOverlap(profile.contributions, candidateContributions);
  // Sem contribuição declarada, o impacto acompanha a aderência já apurada em
  // vez de receber uma constante arbitrária.
  const outcomeFit = contributionOverlap ? 25 + contributionOverlap.ratio * 75 : alignment.score;

  const candidateAudiences = matchTaxonomy(candidateText(candidate), AUDIENCE_PROFILES);
  const audienceOverlap = taxonomyOverlap(profile.audiences, candidateAudiences);
  const audienceFit = audienceOverlap ? 25 + audienceOverlap.ratio * 75 : 50;

  const scaleHits = SCALE_MARKERS.test(text) ? 1 : 0;
  const documented = Boolean(candidate.relevancia || candidate.diferencial || candidate.descricao);
  const scale = 35 + scaleHits * 35 + (documented ? 20 : 0);

  return compose('impact', [
    subscore('outcome_fit', 'impact', outcomeFit, contributionOverlap?.hits.map((item) => item.label) || ['contribuição desejada não informada; herdada da aderência']),
    subscore('audience_fit', 'impact', audienceFit, audienceOverlap?.hits.map((item) => item.label) || ['público não informado na entrevista']),
    subscore('scale', 'impact', scale, [scaleHits ? 'escala documentada no perfil público' : 'escala não quantificada no perfil', documented ? 'diferencial ou relevância descritos' : 'sem descrição de diferencial']),
  ]);
}

function scoreCredibility({ candidate, profile, text }) {
  const fields = sourceFields(candidate);
  const publicEvidence = 20 + clamp01(fields.length / 9) * 80;

  const citations = numericCitations(candidate.citacoes);
  const citationScore = citations ? Math.min(100, Math.log10(citations + 1) * 30) : 0;
  const recognition = RECOGNITION_MARKERS.test(text) ? 70 : 0;
  const recognitionScore = Math.max(citationScore, recognition, citations || recognition ? 0 : 35);

  const candidateEvidence = matchTaxonomy(candidateText(candidate), EVIDENCE_TYPES);
  const available = new Set(candidateEvidence.map((item) => item.id));
  if (candidate.website) available.add('institutional');
  if (candidate.scholar || citations) available.add('publications');
  const wanted = profile.evidence;
  const evidenceFit = wanted.length
    ? 20 + (wanted.filter((item) => available.has(item.id)).length / wanted.length) * 80
    : (available.size ? 60 : 40);

  return compose('credibility', [
    subscore('public_evidence', 'credibility', publicEvidence, [`${fields.length} campo(s) público(s) preenchido(s)`]),
    subscore('recognition', 'credibility', recognitionScore, [citations ? `${citations} citações localizadas` : 'sem contagem de citações', recognition ? 'marcadores de reconhecimento no perfil' : 'sem marcador de reconhecimento']),
    subscore('evidence_preference_fit', 'credibility', evidenceFit, wanted.length ? [`evidência pedida: ${wanted.map((item) => item.label).join('; ')}`] : ['nenhuma preferência de evidência informada']),
  ]);
}

function partnershipState(candidate) {
  const relation = String(candidate.relacao || candidate.relacao_publica || '').trim();
  if (candidate.hasPartnership === true) return { confirmed: true, evidence: relation || 'parceria registrada no cadastro' };
  if (PARTNERSHIP_ABSENT.test(relation)) return { confirmed: false, evidence: 'ausência de parceria declarada explicitamente' };
  if (relation && PARTNERSHIP_CONFIRMED.test(relation)) return { confirmed: true, evidence: relation.slice(0, 160) };
  return { confirmed: false, evidence: relation ? 'relação descrita sem confirmação de parceria' : 'relação com o SENAI não informada' };
}

function scoreCollaboration({ candidate, profile, partnership }) {
  const candidateContributions = matchTaxonomy(candidateText(candidate), CONTRIBUTION_TYPES);
  const contributionOverlap = taxonomyOverlap(profile.contributions, candidateContributions);
  const contributionFit = contributionOverlap ? 25 + contributionOverlap.ratio * 75 : (candidateContributions.length ? 55 : 45);
  const contactable = Boolean(candidate.website || candidate.perfil_principal_url || candidate.linkedin_url || candidate.scholar || candidate.contato_publico);
  const relationshipScore = partnership.confirmed ? 92 : (candidate.relacao ? 48 : 40);

  return compose('collaboration', [
    subscore('existing_relationship', 'collaboration', relationshipScore, [partnership.evidence]),
    subscore('contribution_fit', 'collaboration', contributionFit, contributionOverlap?.hits.map((item) => item.label) || ['contribuição desejada não informada']),
    subscore('contactability', 'collaboration', contactable ? 90 : 35, [contactable ? 'canal público disponível (site ou perfil)' : 'sem canal público localizado']),
  ]);
}

function scoreFeasibility({ candidate, profile, partnership, text }) {
  const country = fold(candidate.pais || '');
  const candidateScopes = matchTaxonomy([candidate.pais, candidate.instituicao].filter(Boolean).join(' '), GEOGRAPHY_SCOPES);
  const wantedScopes = profile.geography;
  const acceptsRemote = profile.modalities.some((item) => ['remote', 'hybrid'].includes(item.id));
  let geographyFit;
  let geographyEvidence;
  if (!wantedScopes.length) {
    geographyFit = 60;
    geographyEvidence = ['nenhuma preferência geográfica informada'];
  } else {
    const wantedIds = new Set(wantedScopes.map((item) => item.id));
    const candidateIds = new Set(candidateScopes.map((item) => item.id));
    const direct = [...candidateIds].some((id) => wantedIds.has(id));
    const wantedRank = Math.max(...wantedScopes.map((item) => item.rank || 4));
    const candidateRank = Math.min(...(candidateScopes.map((item) => item.rank || 4).concat([4])));
    const withinScope = candidateRank <= wantedRank;
    geographyFit = direct ? 92 : withinScope ? 70 : acceptsRemote ? 62 : 38;
    geographyEvidence = [
      `país do perfil: ${candidate.pais || 'não informado'}`,
      `escopo pedido: ${wantedScopes.map((item) => item.label).join('; ')}`,
      direct ? 'escopo coincidente' : withinScope ? 'escopo compatível' : 'fora do escopo informado',
    ];
  }

  const foreign = country && !/brasil|brazil/.test(country);
  const languageOk = !foreign || profile.languages.some((item) => item.id !== 'pt') || !profile.languages.length;
  const modalityFit = !profile.modalities.length ? 62 : acceptsRemote ? 88 : (foreign ? 42 : 78);
  const modalityLanguageFit = clamp(modalityFit * (languageOk ? 1 : 0.7));

  const horizon = profile.horizons[0];
  const urgent = horizon && ['urgent', 'short'].includes(horizon.id);
  // Um prazo curto favorece quem já tem relação e canal de contato; sem prazo
  // declarado, a dimensão fica neutra em vez de premiar ninguém.
  const timeframeFit = !horizon
    ? 60
    : urgent
      ? (partnership.confirmed ? 88 : candidate.website ? 62 : 42)
      : (partnership.confirmed ? 80 : 68);

  return compose('feasibility', [
    subscore('geography_fit', 'feasibility', geographyFit, geographyEvidence),
    subscore('modality_language_fit', 'feasibility', modalityLanguageFit, [profile.modalities.length ? `modalidade pedida: ${profile.modalities.map((item) => item.label).join('; ')}` : 'modalidade não informada', foreign ? 'perfil fora do Brasil: verificar idioma' : 'perfil no Brasil']),
    subscore('timeframe_fit', 'feasibility', timeframeFit, [horizon ? `prazo informado: ${horizon.label}` : 'prazo não informado', partnership.confirmed ? 'relação já existente encurta o acesso' : 'sem relação prévia registrada']),
  ]);
}

function scoreRisk({ candidate, profile, severeRisk, text }) {
  const declaredRisk = [candidate.riscos_sinais, candidate.risco, candidate.risk].filter(Boolean).join(' ');
  const relationRisk = RISK_SIGNAL.test(String(candidate.relacao || '')) ? String(candidate.relacao) : '';
  const warning = RISK_SIGNAL.test(`${declaredRisk} ${relationRisk}`);
  const signalControl = severeRisk ? 0 : warning ? 45 : 88;

  const completeness = riskEvidenceFields(candidate).length;
  const informationCompleteness = 25 + clamp01(completeness / RISK_EVIDENCE_FIELDS.length) * 75;

  const violated = profile.hardConstraints.filter((constraint) => {
    const value = fold(constraint);
    if (!value) return false;
    if (/somente|apenas|exclusivamente/.test(value) && /brasil|nacional/.test(value)) return Boolean(candidate.pais) && !/brasil/.test(fold(candidate.pais));
    if (/presencial/.test(value)) return Boolean(candidate.pais) && !/brasil/.test(fold(candidate.pais));
    return false;
  });
  const constraintCompliance = profile.hardConstraints.length ? (violated.length ? 30 : 85) : 65;

  return compose('risk', [
    subscore('signal_control', 'risk', signalControl, [severeRisk ? 'risco grave confirmado por evidência' : warning ? 'sinal de risco não esclarecido no cadastro' : 'nenhum sinal de risco no cadastro']),
    subscore('information_completeness', 'risk', informationCompleteness, [`${completeness} de ${RISK_EVIDENCE_FIELDS.length} campos verificáveis preenchidos`]),
    subscore('constraint_compliance', 'risk', constraintCompliance, profile.hardConstraints.length ? [violated.length ? `restrição possivelmente violada: ${violated[0]}` : 'nenhuma restrição declarada é violada'] : ['nenhuma restrição eliminatória informada']),
  ]);
}

/** Compõe valor estratégico, viabilidade e total com os pesos derivados. */
export function composeTotals(dimensions, criteria, severeRisk) {
  const weights = criteria?.weights || DEFAULT_WEIGHTS;
  const groups = criteria?.groupWeights || { strategic: 0.58, viability: 0.42 };
  const strategicShares = groupShares(weights, 'strategic');
  const viabilityShares = groupShares(weights, 'viability');
  const strategicValue = severeRisk
    ? 0
    : clamp(DIMENSION_GROUPS.strategic.reduce((sum, dimension) => sum + dimensions[dimension] * strategicShares[dimension], 0));
  const viability = clamp(DIMENSION_GROUPS.viability.reduce((sum, dimension) => sum + dimensions[dimension] * viabilityShares[dimension], 0));
  return { strategicValue, viability, total: clamp(strategicValue * groups.strategic + viability * groups.viability) };
}

function scoreCandidate({ candidate, profile, criteria, terms }) {
  const raw = candidateText(candidate);
  const text = fold(raw);
  const severeRisk = confirmedSevereRisk(candidate);
  const partnership = partnershipState(candidate);

  const alignment = scoreAlignment({ candidate, profile, terms, text });
  const impact = scoreImpact({ candidate, profile, alignment, text });
  const credibility = scoreCredibility({ candidate, profile, text });
  const collaboration = scoreCollaboration({ candidate, profile, partnership });
  const feasibility = scoreFeasibility({ candidate, profile, partnership, text });
  const risk = scoreRisk({ candidate, profile, severeRisk, text });

  const detail = { impact, alignment, credibility, collaboration, feasibility, risk };
  const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, detail[dimension].score]));
  const { strategicValue, viability, total } = composeTotals(dimensions, criteria, severeRisk);

  const matchedTokens = profile.themeTokens.filter((token) => text.includes(token));
  const distinctive = [...matchedTokens].sort((left, right) => terms.weightOf(right) - terms.weightOf(left)).slice(0, 4);

  /**
   * Suporte factual: existe algo no perfil público que ligue este candidato ao
   * que foi pedido? Sem isso a nota media apenas atributos do próprio
   * candidato — credibilidade, completude, ausência de risco — que são iguais
   * para qualquer pedido e faziam respostas sem sentido produzirem shortlist.
   */
  const candidatePriorityIds = new Set(matchTaxonomy(raw, STRATEGIC_PRIORITIES).map((item) => item.id));
  const priorityMatches = profile.priorities.filter((item) => candidatePriorityIds.has(item.id));
  // O suporte é medido em especificidade (IDF), não em contagem: casar
  // "indústria", que aparece em quase todo o catálogo, não liga ninguém a
  // nada. Casar "circular" liga.
  const wantedMass = profile.themeTokens.reduce((sum, token) => sum + terms.weightOf(token), 0);
  const matchedMass = matchedTokens.reduce((sum, token) => sum + terms.weightOf(token), 0);
  const specificity = wantedMass > 0 ? matchedMass / wantedMass : 0;
  const support = {
    themeMatches: matchedTokens.length,
    priorityMatches: priorityMatches.length,
    specificity: Math.round(specificity * 100) / 100,
    requestHasSignal: profile.themeTokens.length > 0 || profile.priorities.length > 0,
    supported: priorityMatches.length > 0 || specificity >= SUPPORT_MIN_SPECIFICITY,
  };
  const fields = sourceFields(candidate);
  const strongest = [...DIMENSIONS].sort((left, right) => dimensions[right] - dimensions[left])[0];
  const weakest = [...DIMENSIONS].sort((left, right) => dimensions[left] - dimensions[right])[0];

  const explanation = explainCandidate({
    candidate,
    profile,
    dimensions,
    partnership,
    text: raw,
    matches: {
      priorities: matchTaxonomy(raw, STRATEGIC_PRIORITIES).filter((item) => profile.priorities.some((wanted) => wanted.id === item.id)),
      audiences: matchTaxonomy(raw, AUDIENCE_PROFILES).filter((item) => profile.audiences.some((wanted) => wanted.id === item.id)),
      contributions: matchTaxonomy(raw, CONTRIBUTION_TYPES).filter((item) => profile.contributions.some((wanted) => wanted.id === item.id)),
      geographyScore: feasibility.subscores.find((item) => item.id === 'geography_fit')?.score,
      themeMatches: support.themeMatches,
    },
  });

  return {
    candidate,
    dimensions,
    criteria: detail,
    strategicValue,
    viability,
    total,
    severeRisk,
    partnership,
    support,
    explanation,
    confidence: clamp(30 + clamp01(fields.length / 9) * 45 + clamp01(matchedTokens.length / 6) * 25),
    summary: explanation.why[0],
    comparativeEdge: explanation.why.slice(1).join(' ') || `Diferencia-se sobretudo por ${DIMENSION_LABELS[strongest]}.`,
    tradeoffs: explanation.against,
    dimensionRationale: Object.fromEntries(DIMENSIONS.map((dimension) => [
      dimension,
      `${DIMENSION_LABELS[dimension]} ${dimensions[dimension]}/100: ${detail[dimension].subscores.map((item) => `${item.label}: ${item.score}`).join('; ')}.`,
    ])),
    evidence: fields.slice(0, 6),
    gaps: [
      fields.length < 5 ? 'Perfil público com campos incompletos.' : null,
      !profile.themeTokens.length ? 'Nenhum tema foi informado na entrevista; a aderência não pôde ser verificada.' : null,
      profile.uncertainties.length ? `Respostas em aberto na entrevista: ${profile.uncertainties.slice(0, 3).join(', ')}.` : null,
    ].filter(Boolean),
  };
}

const DIMENSION_LABELS = Object.freeze({
  impact: 'impacto',
  alignment: 'alinhamento',
  credibility: 'credibilidade',
  collaboration: 'colaboração',
  feasibility: 'viabilidade',
  risk: 'controle de risco',
});

function sortEntries(entries) {
  return [...entries].sort((a, b) => b.total - a.total || b.strategicValue - a.strategicValue);
}

export function rankProviderCandidates(entries, limit = 30) {
  const sorted = sortEntries(entries);
  const selected = [];
  const groups = new Set();
  for (const entry of sorted) {
    if (selected.length >= limit) break;
    const group = String(entry.candidate?.instituicao || entry.candidate?.organizacao || entry.candidate?.pais || entry.candidate?.catalogIdentity || entry.candidate?.nome || '').trim().toLowerCase();
    if (group && groups.has(group)) continue;
    selected.push(entry);
    if (group) groups.add(group);
  }
  for (const entry of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  return selected;
}

/**
 * Corte de elegibilidade relativo ao melhor candidato do próprio catálogo.
 * Um piso fixo trata igualmente um catálogo excelente e um catálogo fraco;
 * o corte relativo mantém a shortlist honesta nos dois casos.
 */
export function computeEligibilityThreshold(entries, policy = SHORTLIST_POLICY) {
  const best = entries.reduce((max, entry) => Math.max(max, Number(entry.total) || 0), 0);
  const relative = best * policy.relativeToBest;
  return Math.round(Math.min(policy.ceiling, Math.max(policy.absoluteFloor, relative)));
}

/**
 * Produces a practical shortlist: up to ten candidates, with at least five
 * whenever the catalog has five or more eligible records. The first pass
 * favors distinct institutions so the result does not collapse into one
 * organization; the second pass fills remaining slots by score.
 */
export function selectShortlist(entries, { minimum = 5, maximum = 10, threshold = SHORTLIST_POLICY.absoluteFloor } = {}) {
  const sorted = sortEntries(entries);
  const safeMinimum = Math.max(0, Math.min(minimum, maximum));
  const eligible = sorted.filter((entry) => entry.total >= threshold && !entry.severeRisk?.confirmed);
  const fallback = sorted.filter((entry) => !entry.severeRisk?.confirmed);
  const pool = eligible.length >= safeMinimum ? eligible : fallback;
  const target = Math.min(maximum, Math.max(safeMinimum, pool.length));
  const selected = [];
  const institutions = new Set();

  for (const entry of pool) {
    const institution = String(entry.candidate?.instituicao || entry.candidate?.organizacao || entry.candidate?.catalogIdentity || entry.candidate?.nome || '').trim().toLowerCase();
    if (selected.length >= target) break;
    if (institution && institutions.has(institution)) continue;
    selected.push(entry);
    if (institution) institutions.add(institution);
  }
  for (const entry of pool) {
    if (selected.length >= target) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  return selected;
}

function exclusionReport(entries, shortlist, threshold) {
  return entries.filter((entry) => !shortlist.includes(entry)).map((entry) => ({
    id: entry.candidate.id,
    reason: entry.severeRisk?.confirmed ? 'severe-risk' : entry.total < threshold ? 'below-threshold' : 'capacity',
  }));
}

export function buildLocalEvaluation({ category, objective, answers, candidates, brief }) {
  const criteria = deriveDimensionWeights({ objective, category, brief: brief || {}, answers: answers || {} });
  const profile = buildContextProfile({ brief: brief || {}, answers: answers || {}, category, objective });
  const terms = buildTermWeights(candidates);
  const candidatePool = sortEntries(candidates.map((candidate) => scoreCandidate({ candidate, profile, criteria, terms })));
  // Só é candidato quem tem relação demonstrável com o pedido. Completar a
  // lista com os "menos piores" produzia dez indicações confiantes mesmo para
  // respostas sem sentido nenhum.
  const supported = candidatePool.filter((entry) => entry.support.supported);
  const threshold = computeEligibilityThreshold(supported);
  const shortlist = supported.length ? selectShortlist(supported, { ...SHORTLIST_POLICY, threshold }) : [];

  return {
    shortlist,
    candidatePool,
    trace: {
      evaluatorVersion: 'local-v2',
      category,
      objective,
      answers,
      brief: brief || null,
      criteria: {
        version: SELECTION_CRITERIA_VERSION,
        profile: criteria.profile,
        baseline: criteria.baseline,
        weights: criteria.weights,
        groupWeights: criteria.groupWeights,
        adjustments: criteria.adjustments,
        signalsUsed: criteria.signalsUsed,
        subcriteria: describeCriteria(criteria.weights),
      },
      weights: criteria.weights,
      contextProfile: {
        themeTokens: profile.themeTokens.slice(0, 24),
        priorities: profile.priorities.map((item) => item.label),
        prioritiesFromUser: profile.prioritiesFromUser,
        audiences: profile.audiences.map((item) => item.label),
        contributions: profile.contributions.map((item) => item.label),
        evidence: profile.evidence.map((item) => item.label),
        geography: profile.geography.map((item) => item.label),
        modalities: profile.modalities.map((item) => item.label),
        horizons: profile.horizons.map((item) => item.label),
        hardConstraints: profile.hardConstraints,
      },
      formula: `nota = Σ (dimensão × peso derivado); valor estratégico pesa ${criteria.groupWeights.strategic} e viabilidade ${criteria.groupWeights.viability}; risco grave confirmado zera o valor estratégico`,
      sourcePolicy: 'Somente campos do catálogo cadastrado; termos genéricos do catálogo valem menos que termos específicos (IDF); ausência de evidência reduz confiança.',
      institutionalBaseline: SENAI_STRATEGIC_BASELINE,
      catalogSize: candidates.length,
      shortlistPolicy: { ...SHORTLIST_POLICY, threshold },
      objectiveCalibration: 'os pesos partem do perfil do objetivo e são ajustados por sinais explícitos das respostas, dentro de faixas declaradas',
      providerPreselection: { limit: 30, selected: rankProviderCandidates(candidatePool, 30).map((entry) => entry.candidate.id) },
      requestSignal: {
        hasSignal: profile.themeTokens.length > 0 || profile.priorities.length > 0,
        supportedCandidates: supported.length,
        unsupportedCandidates: candidatePool.length - supported.length,
        note: supported.length
          ? 'Só entram na shortlist candidatos cujo perfil público toca o que foi pedido.'
          : 'Nenhum candidato do catálogo tem relação demonstrável com o que foi descrito na entrevista.',
      },
      shortlistExcluded: exclusionReport(candidatePool, shortlist, threshold),
      generatedAt: new Date().toISOString(),
      provider: 'local-fallback',
      model: null,
    },
  };
}

function normalizeAiDimensions(dimensions, fallback) {
  return Object.fromEntries(DIMENSIONS.map((key) => {
    const providerValue = Number(dimensions?.[key]);
    const localValue = Number(fallback[key]) || 0;
    // A small local-evidence blend prevents a provider from flattening all
    // candidates to identical scores while preserving its contextual judgment.
    const value = Number.isFinite(providerValue) ? providerValue * 0.78 + localValue * 0.22 : localValue;
    return [key, clamp(value)];
  }));
}

function recompute(entry, ai, criteria) {
  const dimensions = normalizeAiDimensions(ai?.dimensions, entry.dimensions);
  const severeRisk = entry.severeRisk?.confirmed
    ? entry.severeRisk
    : ai?.severeRisk?.confirmed ? ai.severeRisk : null;
  return { ...entry, ...ai, dimensions, criteria: entry.criteria, ...composeTotals(dimensions, criteria, severeRisk), severeRisk };
}

export function mergeAiEvaluation(local, aiResult = {}) {
  const criteria = local.trace?.criteria || null;
  const aiById = new Map((aiResult.evaluations || []).map((evaluation) => [String(evaluation.id), evaluation]));
  const entries = (local.candidatePool || local.shortlist).map((entry) => recompute(entry, aiById.get(String(entry.candidate.id)), criteria));
  const sortedEntries = sortEntries(entries);
  const supported = sortedEntries.filter((entry) => entry.support?.supported !== false);
  const threshold = computeEligibilityThreshold(supported);
  const shortlist = supported.length ? selectShortlist(supported, { ...SHORTLIST_POLICY, threshold }) : [];
  return {
    ...local,
    shortlist,
    candidatePool: entries,
    trace: {
      ...local.trace,
      provider: aiResult.provider || 'local-fallback',
      model: aiResult.model || null,
      usage: aiResult.usage || null,
      evaluatorVersion: aiResult.provider ? 'openrouter-structured-v2' : local.trace.evaluatorVersion,
      generatedAt: new Date().toISOString(),
      shortlistPolicy: { ...SHORTLIST_POLICY, threshold },
      shortlistExcluded: exclusionReport(sortedEntries, shortlist, threshold),
    },
  };
}

export function getCandidatePool({ category, data }) {
  if (category === 'person' || category === 'researcher') return data.pesquisadores || [];
  if (category === 'school') return mergeSchoolSources({ schools: data.escolas || [], stakeholders: data.stakeholders || [] });
  return data.stakeholders || [];
}

export { DIMENSION_LABELS };
