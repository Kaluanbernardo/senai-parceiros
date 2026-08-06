import { ExampleResolver, getExampleCoverage, resolveExample } from './exampleResolver.js';

export const CATEGORY_LABELS = {
  researcher: 'Especialista',
  school: 'Instituição de Educação',
  organization: 'Organização',
};

export const OBJECTIVE_LABELS = {
  speaker: 'Convidar para uma palestra ou conversa',
  project_partner: 'Criar um projeto em conjunto',
  benchmark: 'Conhecer uma prática de referência',
  research_support: 'Apoiar uma pesquisa',
  guided: 'Ainda não sei, quero ajuda para decidir',
};

export const CATEGORY_IDS = Object.freeze(Object.keys(CATEGORY_LABELS));
export const OBJECTIVE_IDS = Object.freeze(Object.keys(OBJECTIVE_LABELS));

const commonQuestions = [
  {
    id: 'context',
    label: 'Em que situação você pretende envolver essa pessoa ou instituição?',
    helper: 'Descreva o evento, projeto ou decisão. Não precisa usar termos técnicos.',
    example: 'Ex.: evento sobre IA aplicada à indústria e formação profissional.',
    kind: 'textarea',
  },
  {
    id: 'themes',
    label: 'Quais temas ou competências devem aparecer?',
    helper: 'Você pode listar palavras soltas. Se ainda não souber, escreva “não sei ainda”.',
    example: 'Ex.: manufatura avançada, IA, competências digitais, aprendizagem prática.',
    kind: 'textarea',
  },
  {
    id: 'audience',
    label: 'Quem é o público ou beneficiário principal?',
    helper: 'Pode ser qualquer público: estudantes, docentes, empresas de qualquer setor, gestão pública, comunidade ou convidados externos.',
    example: 'Ex.: gestores de educação, docentes, estudantes e convidados externos.',
    kind: 'textarea',
  },
  {
    id: 'desired_contribution',
    label: 'Que contribuição concreta seria mais valiosa?',
    helper: 'Pense no resultado esperado, mesmo que ainda seja uma hipótese.',
    example: 'Ex.: compartilhar um caso aplicado e indicar caminhos de parceria.',
    kind: 'textarea',
  },
  {
    id: 'geography',
    label: 'Onde isso deve acontecer, e há preferência de lugar ou idioma?',
    helper: 'Pode ser uma unidade do SENAI-SP, a sede do parceiro, outro espaço, outra cidade ou país, remoto — ou sem preferência.',
    example: 'Ex.: encontro em São Paulo, mas participação remota internacional é possível.',
    kind: 'text',
  },
  {
    id: 'timeframe',
    label: 'Quando você precisa desse contato ou resultado?',
    helper: 'Uma estimativa basta e pode ser “sem prazo definido”.',
    example: 'Ex.: convite nas próximas seis semanas.',
    kind: 'text',
  },
  {
    id: 'constraints',
    label: 'Existe alguma restrição importante?',
    helper: 'Considere orçamento, idioma, disponibilidade, formato, conflito de interesses ou outro limite.',
    example: 'Ex.: participação remota é aceita e não há orçamento para viagem.',
    kind: 'textarea',
  },
];

const objectiveQuestions = {
  speaker: {
    id: 'communication_style',
    label: 'Que tipo de participação seria mais útil?',
    helper: 'Pense no formato, profundidade e estilo que o público precisa.',
    example: 'Ex.: palestra prática com exemplos de implantação em escolas e empresas.',
    kind: 'textarea',
  },
  project_partner: {
    id: 'partnership_model',
    label: 'O que você espera construir em conjunto?',
    helper: 'Pode ser currículo, pesquisa aplicada, evento, intercâmbio, laboratório ou outra iniciativa.',
    example: 'Ex.: projeto-piloto para formar instrutores em tecnologias digitais.',
    kind: 'textarea',
  },
  benchmark: {
    id: 'benchmark_focus',
    label: 'Qual prática você quer entender ou comparar?',
    helper: 'Isso define o que será considerado uma referência realmente útil.',
    example: 'Ex.: governança de cursos alinhados a competências da indústria.',
    kind: 'textarea',
  },
  research_support: {
    id: 'research_output',
    label: 'Que tipo de contribuição você espera para a pesquisa?',
    helper: 'Pode ser dados, método, análise, acesso a rede ou revisão especializada.',
    example: 'Ex.: acesso a evidências sobre transição escola-trabalho.',
    kind: 'textarea',
  },
  guided: {
    id: 'desired_outcome',
    label: 'Se essa busca der certo, o que você conseguirá fazer melhor?',
    helper: 'Não há resposta certa; descreva o resultado que faria diferença para você.',
    example: 'Ex.: encontrar alguém que ajude a decidir o formato de um novo programa.',
    kind: 'textarea',
  },
};

export function buildInterview({ category, objective, context = '' }) {
  const specific = objectiveQuestions[objective] || objectiveQuestions.guided;
  const questions = [commonQuestions[0], specific, ...commonQuestions.slice(1)];
  const coverage = getExampleCoverage({ category, objective, context });

  return questions.map((question) => ({
    ...question,
    category,
    objective,
    context,
    example: resolveExample({ questionId: question.id, category, objective, context }),
    exampleCoverage: coverage,
    allowUnknown: true,
    answerHint: 'Você poderá revisar suas respostas antes de ver as recomendações.',
  }));
}

export { ExampleResolver, getExampleCoverage, resolveExample };
