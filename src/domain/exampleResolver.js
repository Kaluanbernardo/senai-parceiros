/**
 * Exemplos da entrevista sao uma orientacao de UX, nao uma regra de
 * pontuacao. O resolver e puro e deterministico: recebe apenas a categoria,
 * objetivo, id da pergunta e contexto atual; nao persiste respostas.
 */

export const EXAMPLE_RESOLVER_VERSION = 'contextual-examples-v1';

const CONTEXT_SIGNALS = Object.freeze([
  {
    id: 'industrial_ai',
    pattern: /\b(ia|intelig[eê]ncia artificial|machine learning|aprendizagem de m[aá]quina)\b/i,
    label: 'IA aplicada à indústria',
  },
  {
    id: 'circular_economy',
    pattern: /economia circular|circularidade|res[ií]duos|descarboniza[cç][aã]o/i,
    label: 'economia circular e sustentabilidade',
  },
  {
    id: 'industry_4',
    pattern: /ind[uú]stria\s*4\.0|manufatura avan[cç]ada|transforma[cç][aã]o digital/i,
    label: 'Indústria 4.0 e transformação digital',
  },
]);

const CATEGORY_EXAMPLES = Object.freeze({
  researcher: Object.freeze({
    context: 'Ex.: uma iniciativa do SENAI-SP que precisa de conhecimento especializado e evidências públicas.',
    themes: 'Ex.: educação profissional, competências técnicas, inovação e relação entre formação e trabalho.',
    audience: 'Ex.: gestores de educação, docentes, pesquisadores e representantes da indústria paulista.',
    desired_contribution: 'Ex.: trazer evidências, indicar caminhos de pesquisa e traduzir achados para a prática.',
    geography: 'Ex.: Brasil e exterior, desde que haja possibilidade de interação remota em português ou inglês.',
    timeframe: 'Ex.: precisamos identificar contatos nas próximas seis semanas.',
    constraints: 'Ex.: orçamento limitado e necessidade de trabalhar somente com informações públicas.',
  }),
  school: Object.freeze({
    context: 'Ex.: uma comparação entre instituições de educação profissional para orientar uma decisão do SENAI-SP.',
    themes: 'Ex.: currículo, aprendizagem prática, empregabilidade, parceria com empresas e qualidade da formação.',
    audience: 'Ex.: equipe de gestão, coordenação pedagógica, docentes e empresas parceiras.',
    desired_contribution: 'Ex.: compartilhar práticas verificáveis, indicadores e possibilidades de cooperação institucional.',
    geography: 'Ex.: São Paulo, Brasil ou uma referência internacional comparável.',
    timeframe: 'Ex.: precisamos preparar a análise para uma reunião no próximo mês.',
    constraints: 'Ex.: priorizar fontes institucionais e organizações com informações públicas suficientes.',
  }),
  organization: Object.freeze({
    context: 'Ex.: uma possível articulação com empresa, órgão público, associação, fundação ou rede ligada à indústria.',
    themes: 'Ex.: desenvolvimento industrial, qualificação profissional, inovação, sustentabilidade e inclusão produtiva.',
    audience: 'Ex.: lideranças institucionais, equipes técnicas e áreas de educação ou desenvolvimento econômico.',
    desired_contribution: 'Ex.: oferecer rede, dados, infraestrutura, expertise ou capacidade de executar uma iniciativa.',
    geography: 'Ex.: preferência por São Paulo, mas parcerias remotas também podem ser consideradas.',
    timeframe: 'Ex.: precisamos chegar a uma lista inicial antes do próximo ciclo de planejamento.',
    constraints: 'Ex.: não há orçamento definido e toda a triagem deve usar informações públicas.',
  }),
});

const OBJECTIVE_EXAMPLES = Object.freeze({
  speaker: Object.freeze({
    researcher: Object.freeze({
      context: 'Ex.: uma palestra, mesa-redonda ou aula aberta sobre um desafio atual da indústria e da educação profissional.',
      communication_style: 'Ex.: palestra prática ou mesa-redonda; indique duração, profundidade e o que o público deve levar.',
      audience: 'Ex.: gestores, docentes, estudantes e representantes da indústria que precisam de exemplos aplicáveis.',
    }),
    school: Object.freeze({
      context: 'Ex.: uma participação institucional para compartilhar práticas de formação profissional com a rede do SENAI-SP.',
      communication_style: 'Ex.: apresentação de caso, visita técnica ou conversa com gestores; indique o formato e o público.',
      audience: 'Ex.: direção, coordenação pedagógica, docentes e parceiros empresariais.',
    }),
    organization: Object.freeze({
      context: 'Ex.: um painel ou conversa técnica para aproximar a organização de uma agenda da indústria paulista.',
      communication_style: 'Ex.: painel executivo, fala técnica ou conversa de trabalho; indique o formato e o público.',
      audience: 'Ex.: lideranças, equipes técnicas e convidados que podem transformar a conversa em colaboração.',
    }),
  }),
  project_partner: Object.freeze({
    researcher: Object.freeze({
      context: 'Ex.: um projeto aplicado que combina pesquisa, formação profissional e um desafio concreto de empresas.',
      partnership_model: 'Ex.: pesquisa aplicada, laboratório conjunto, formação de instrutores ou coorientação técnica.',
    }),
    school: Object.freeze({
      context: 'Ex.: uma cooperação para testar ou aprimorar uma prática de educação profissional.',
      partnership_model: 'Ex.: intercâmbio de docentes, currículo conjunto, laboratório compartilhado ou projeto-piloto.',
    }),
    organization: Object.freeze({
      context: 'Ex.: uma iniciativa conjunta para desenvolver competências ligadas à competitividade industrial.',
      partnership_model: 'Ex.: financiamento, infraestrutura, dados, tecnologia, rede de parceiros ou execução conjunta.',
    }),
  }),
  benchmark: Object.freeze({
    researcher: Object.freeze({
      context: 'Ex.: entender uma abordagem de pesquisa ou avaliação que possa orientar uma decisão do SENAI-SP.',
      benchmark_focus: 'Ex.: comparar métodos, evidências, indicadores e condições para adaptar uma prática ao contexto paulista.',
    }),
    school: Object.freeze({
      context: 'Ex.: comparar como instituições de educação profissional organizam currículo, gestão e relação com empresas.',
      benchmark_focus: 'Ex.: analisar governança, aprendizagem prática, qualidade, empregabilidade e articulação com a indústria.',
      audience: 'Ex.: equipe que precisa transformar a comparação em recomendações de gestão ou currículo.',
    }),
    organization: Object.freeze({
      context: 'Ex.: estudar uma organização como referência de governança, inovação ou desenvolvimento de competências.',
      benchmark_focus: 'Ex.: identificar práticas transferíveis, resultados demonstrados, limitações e condições de adaptação.',
    }),
  }),
  research_support: Object.freeze({
    researcher: Object.freeze({
      research_output: 'Ex.: dados, método, revisão especializada, rede de fontes ou leitura crítica de um estudo.',
    }),
    school: Object.freeze({
      research_output: 'Ex.: acesso a práticas, indicadores, documentos institucionais ou especialistas da própria rede.',
    }),
    organization: Object.freeze({
      research_output: 'Ex.: dados públicos, acesso a especialistas, experiência setorial ou validação de hipóteses.',
    }),
  }),
  guided: Object.freeze({
    researcher: Object.freeze({
      desired_outcome: 'Ex.: sair com clareza sobre que tipo de especialista ajudaria a tomar a próxima decisão.',
    }),
    school: Object.freeze({
      desired_outcome: 'Ex.: descobrir que tipo de instituição seria uma referência útil para o problema apresentado.',
    }),
    organization: Object.freeze({
      desired_outcome: 'Ex.: entender qual organização poderia abrir o caminho mais concreto para a iniciativa.',
    }),
  }),
});

function categoryKey(category) {
  return CATEGORY_EXAMPLES[category] ? category : 'organization';
}

function objectiveKey(objective) {
  return OBJECTIVE_EXAMPLES[objective] ? objective : 'guided';
}

export function resolveContextSignal(context = '') {
  const value = String(context || '').trim();
  if (!value) return null;
  return CONTEXT_SIGNALS.find((signal) => signal.pattern.test(value)) || null;
}

function contextAwareExample({ questionId, category, objective, context }) {
  const signal = resolveContextSignal(context);
  // Contexto temático só refina situações em que o formato da interação é
  // parte da decisão. Benchmarking continua descrevendo comparação, nunca
  // transforma a pergunta em convite para evento.
  if (!signal || objective === 'benchmark') return null;
  if (questionId === 'communication_style' && objective === 'speaker' && category === 'researcher') {
    return `Ex.: para ${signal.label}, escolha entre palestra, mesa-redonda ou oficina; informe duração, profundidade e público esperado.`;
  }
  if (questionId === 'context' && objective === 'speaker') {
    return `Ex.: uma participação sobre ${signal.label}, com formato e público definidos para a necessidade do SENAI-SP.`;
  }
  if (questionId === 'themes') {
    return `Ex.: ${signal.label}, competências profissionais e aplicações que façam sentido para a indústria paulista.`;
  }
  return null;
}

export function resolveExample({ questionId, category, objective, context = '' } = {}) {
  const contextual = contextAwareExample({ questionId, category, objective, context });
  if (contextual) return contextual;

  const categoryExample = CATEGORY_EXAMPLES[categoryKey(category)]?.[questionId];
  const objectiveExample = OBJECTIVE_EXAMPLES[objectiveKey(objective)]?.[categoryKey(category)]?.[questionId];
  return objectiveExample || categoryExample || 'Ex.: descreva o que seria mais útil para você, mesmo que ainda seja uma hipótese.';
}

export function getExampleCoverage({ category, objective, context = '' } = {}) {
  const safeCategory = categoryKey(category);
  const safeObjective = objectiveKey(objective);
  const contextSignal = resolveContextSignal(context);
  const specialized = OBJECTIVE_EXAMPLES[safeObjective]?.[safeCategory] || {};
  const categoryExamples = CATEGORY_EXAMPLES[safeCategory] || {};
  const questionIds = [...new Set([...Object.keys(categoryExamples), ...Object.keys(specialized)])];
  return {
    version: EXAMPLE_RESOLVER_VERSION,
    category: safeCategory,
    objective: safeObjective,
    contextSignal: contextSignal?.id || 'general',
    contextLabel: contextSignal?.label || 'contexto geral',
    questionIds,
    specializedQuestionIds: Object.keys(specialized),
    fallbackQuestionIds: questionIds.filter((questionId) => !specialized[questionId] && !categoryExamples[questionId]),
  };
}

export const ExampleResolver = Object.freeze({
  resolve: resolveExample,
  coverage: getExampleCoverage,
});
