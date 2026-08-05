/**
 * Contexto institucional pré-configurado do SENAI-SP.
 *
 * Este módulo substitui a lista de frases soltas que antes era jogada no mesmo
 * saco de tokens das respostas do usuário. Cada prioridade, tipo de
 * contribuição, público, evidência e escopo geográfico é uma entidade nomeada,
 * com termos reconhecíveis, para que a entrevista e a avaliação possam dizer
 * *qual* critério foi acionado e *por quê* — sem depender de sobreposição
 * literal de palavras.
 */

export const SENAI_CONTEXT_VERSION = 'senai-context-v1';

export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function taxonomy(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry, terms: Object.freeze(entry.terms.map(fold)) })));
}

/**
 * Prioridades estratégicas usadas como baseline institucional. O peso indica
 * quanto cada agenda pesa quando o usuário não a mencionou explicitamente —
 * o contexto do usuário sempre domina, o baseline apenas desempata.
 */
export const STRATEGIC_PRIORITIES = taxonomy([
  {
    id: 'advanced_manufacturing',
    short: 'manufatura avançada',
    label: 'Manufatura avançada e Indústria 4.0',
    weight: 1,
    terms: ['manufatura avancada', 'industria 4.0', 'industria 40', 'automacao', 'robotica', 'mecatronica', 'sistemas de manufatura', 'producao enxuta', 'lean', 'gemeo digital', 'digital twin', 'usinagem', 'metalmecanica', 'manufacturing', 'fabricacao'],
  },
  {
    id: 'digital_ai',
    short: 'inteligência artificial e tecnologias digitais',
    label: 'Inteligência artificial, dados e transformação digital',
    weight: 1,
    terms: ['inteligencia artificial', 'artificial intelligence', 'machine learning', 'aprendizagem de maquina', 'ciencia de dados', 'big data', 'analytics', 'transformacao digital', 'competencias digitais', 'iot', 'internet das coisas', 'computacao', 'software', 'programacao', 'ciberseguranca'],
  },
  {
    id: 'sustainability',
    short: 'sustentabilidade e economia circular',
    label: 'Sustentabilidade, ESG, descarbonização e economia circular',
    weight: 1,
    terms: ['sustentabilidade', 'economia circular', 'circularidade', 'descarbonizacao', 'esg', 'residuos', 'reciclagem', 'energia renovavel', 'eficiencia energetica', 'transicao energetica', 'emissoes', 'clima', 'ambiental'],
  },
  {
    id: 'vet_quality',
    short: 'educação profissional',
    label: 'Qualidade e inovação da educação profissional',
    weight: 1.1,
    terms: ['educacao profissional', 'ensino tecnico', 'formacao profissional', 'ept', 'vet', 'tvet', 'curriculo', 'competencias', 'aprendizagem pratica', 'formacao dual', 'sistema dual', 'aprendizagem baseada em projetos', 'certificacao', 'qualificacao', 'vocational'],
  },
  {
    id: 'employability',
    short: 'empregabilidade',
    label: 'Empregabilidade e transição escola-trabalho',
    weight: 1,
    terms: ['empregabilidade', 'transicao escola trabalho', 'mercado de trabalho', 'insercao produtiva', 'requalificacao', 'reskilling', 'upskilling', 'estagio', 'aprendiz', 'egressos', 'workforce', 'empregos'],
  },
  {
    id: 'applied_research',
    short: 'pesquisa aplicada e inovação',
    label: 'Pesquisa aplicada, inovação e transferência tecnológica',
    weight: 1,
    terms: ['pesquisa aplicada', 'inovacao', 'transferencia tecnologica', 'p&d', 'pesquisa e desenvolvimento', 'prototipagem', 'laboratorio', 'instituto de inovacao', 'startup', 'empreendedorismo', 'patente', 'tecnologia industrial'],
  },
  {
    id: 'regional_inclusion',
    short: 'desenvolvimento regional',
    label: 'Desenvolvimento regional, acesso e inclusão produtiva',
    weight: 0.9,
    terms: ['desenvolvimento regional', 'interiorizacao', 'inclusao', 'diversidade', 'acesso', 'vulnerabilidade', 'territorio', 'arranjo produtivo', 'pequenas empresas', 'mpe', 'comunidade'],
  },
  {
    // "docentes" e "instrutores" sozinhos descrevem o público, não o tema:
    // mantidos aqui, "um evento para instrutores" virava "formação docente".
    id: 'teacher_development',
    short: 'formação docente',
    label: 'Formação e desenvolvimento de docentes e instrutores',
    weight: 0.9,
    terms: ['formacao docente', 'formacao de instrutores', 'desenvolvimento docente', 'capacitacao de professores', 'formacao de professores', 'pedagogico', 'didatica', 'teacher training'],
  },
  {
    id: 'health_safety',
    short: 'saúde e segurança no trabalho',
    label: 'Saúde, segurança e condições de trabalho na indústria',
    weight: 0.8,
    terms: ['saude e seguranca', 'seguranca do trabalho', 'sst', 'ergonomia', 'nr 12', 'acidente de trabalho', 'saude ocupacional'],
  },
]);

/** Tipos de contribuição que um stakeholder pode oferecer a uma iniciativa. */
export const CONTRIBUTION_TYPES = taxonomy([
  { id: 'evidence', label: 'Evidência, pesquisa e método', terms: ['pesquisa', 'evidencia', 'estudo', 'publicacao', 'artigo', 'metodo', 'analise', 'dados', 'indicador', 'avaliacao'] },
  { id: 'speaking', label: 'Fala pública, palestra ou mediação', terms: ['palestra', 'palestrante', 'mesa redonda', 'painel', 'keynote', 'seminario', 'conferencia', 'webinar', 'aula aberta', 'oficina', 'workshop'] },
  { id: 'curriculum', label: 'Currículo, formação e conteúdo', terms: ['curriculo', 'curso', 'formacao', 'treinamento', 'material didatico', 'trilha', 'capacitacao', 'certificacao'] },
  { id: 'infrastructure', label: 'Infraestrutura, laboratório e equipamento', terms: ['laboratorio', 'equipamento', 'infraestrutura', 'planta', 'fabrica', 'centro tecnologico', 'maquina', 'software licenciado'] },
  { id: 'network', label: 'Rede, articulação e acesso a atores', terms: ['rede', 'articulacao', 'acesso', 'conexao', 'associacao', 'federacao', 'ecossistema', 'consorcio', 'comunidade de pratica'] },
  { id: 'execution', label: 'Execução conjunta de projeto ou piloto', terms: ['projeto', 'piloto', 'implantacao', 'execucao', 'cooperacao tecnica', 'coexecucao', 'projeto conjunto', 'parceria operacional'] },
  { id: 'funding', label: 'Financiamento, fomento ou patrocínio', terms: ['financiamento', 'fomento', 'patrocinio', 'investimento', 'edital', 'recurso', 'orcamento'] },
]);

/** Públicos e beneficiários típicos das iniciativas do SENAI-SP. */
export const AUDIENCE_PROFILES = taxonomy([
  { id: 'instructors', short: 'docentes e instrutores', label: 'Docentes e instrutores', terms: ['docente', 'instrutor', 'professor', 'formador', 'corpo docente'] },
  { id: 'managers', short: 'gestores', label: 'Gestores e lideranças educacionais', terms: ['gestor', 'gestao', 'diretor', 'coordenador', 'lideranca', 'direcao', 'coordenacao'] },
  { id: 'students', short: 'estudantes', label: 'Estudantes e aprendizes', terms: ['estudante', 'aluno', 'aprendiz', 'jovem', 'egresso', 'turma'] },
  { id: 'industry', short: 'empresas da indústria', label: 'Empresas e profissionais da indústria', terms: ['empresa', 'industria', 'empresario', 'setor produtivo', 'empregador', 'fabrica', 'trabalhador', 'profissional'] },
  { id: 'policy', short: 'gestão pública', label: 'Formuladores de política e sistema S', terms: ['politica publica', 'governo', 'ministerio', 'secretaria', 'orgao publico', 'sistema s', 'conselho'] },
  { id: 'researchers', short: 'pesquisadores', label: 'Pesquisadores e comunidade acadêmica', terms: ['pesquisador', 'academico', 'universidade', 'comunidade cientifica', 'pos graduacao'] },
]);

/** Tipos de evidência pública que sustentam uma recomendação. */
export const EVIDENCE_TYPES = taxonomy([
  { id: 'publications', label: 'Publicações e produção científica', terms: ['publicacao', 'artigo', 'paper', 'scholar', 'citacao', 'revista', 'periodico', 'doi'] },
  { id: 'institutional', label: 'Fonte institucional oficial', terms: ['site oficial', 'site institucional', 'website', 'pagina oficial', 'documento institucional', 'relatorio institucional'] },
  { id: 'cases', label: 'Casos e experiências documentadas', terms: ['caso', 'case', 'experiencia', 'projeto realizado', 'implantacao', 'historico'] },
  { id: 'indicators', label: 'Indicadores e resultados mensuráveis', terms: ['indicador', 'resultado', 'metrica', 'numero', 'estatistica', 'avaliacao de impacto'] },
  { id: 'certifications', label: 'Certificações, prêmios e reconhecimento', terms: ['certificacao', 'acreditacao', 'premio', 'reconhecimento', 'selo', 'ranking'] },
]);

/** Escopos geográficos reconhecidos, do mais restrito ao mais amplo. */
export const GEOGRAPHY_SCOPES = taxonomy([
  { id: 'sao_paulo', label: 'Estado de São Paulo', rank: 1, terms: ['sao paulo', 'sp', 'estado de sao paulo', 'capital paulista', 'paulista', 'interior de sao paulo', 'abc paulista', 'campinas'] },
  { id: 'brazil', label: 'Brasil', rank: 2, terms: ['brasil', 'brasileiro', 'nacional', 'brazil', 'pais'] },
  { id: 'latam', label: 'América Latina', rank: 3, terms: ['america latina', 'latino americano', 'mercosul', 'argentina', 'chile', 'colombia', 'mexico', 'uruguai', 'peru'] },
  { id: 'international', label: 'Internacional', rank: 4, terms: ['internacional', 'exterior', 'global', 'estrangeiro', 'fora do brasil', 'europa', 'alemanha', 'eua', 'estados unidos', 'asia', 'coreia', 'japao', 'canada', 'portugal', 'espanha', 'franca', 'reino unido', 'holanda', 'suica', 'australia', 'singapura', 'india', 'china'] },
]);

export const MODALITIES = taxonomy([
  { id: 'remote', label: 'Remoto', terms: ['remoto', 'online', 'a distancia', 'virtual', 'videoconferencia'] },
  { id: 'in_person', label: 'Presencial', terms: ['presencial', 'in loco', 'visita tecnica', 'no local'] },
  { id: 'hybrid', label: 'Híbrido', terms: ['hibrido', 'misto'] },
]);

export const LANGUAGES = taxonomy([
  { id: 'pt', label: 'Português', terms: ['portugues', 'em portugues'] },
  { id: 'en', label: 'Inglês', terms: ['ingles', 'english', 'em ingles'] },
  { id: 'es', label: 'Espanhol', terms: ['espanhol', 'castelhano'] },
]);

export const TIME_HORIZONS = taxonomy([
  { id: 'urgent', label: 'Prazo curto (até um mês)', rank: 1, terms: ['urgente', 'urgencia', 'esta semana', 'proxima semana', 'em duas semanas', 'ainda este mes', 'para ontem', 'imediato', 'proximos dias'] },
  { id: 'short', label: 'Prazo próximo (um a três meses)', rank: 2, terms: ['proximo mes', 'em um mes', 'em dois meses', 'seis semanas', 'proximas semanas', 'no trimestre', 'proximo trimestre', 'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] },
  { id: 'medium', label: 'Prazo médio (três meses a um ano)', rank: 3, terms: ['semestre', 'proximo semestre', 'este ano', 'ate o fim do ano', 'proximo ciclo', 'segundo semestre'] },
  { id: 'open', label: 'Sem prazo definido', rank: 4, terms: ['sem prazo', 'sem data', 'nao ha prazo', 'sem urgencia', 'quando for possivel', 'ainda sem definicao'] },
]);

export const BUDGET_LEVELS = taxonomy([
  { id: 'none', label: 'Sem orçamento dedicado', rank: 1, terms: ['sem orcamento', 'nao ha orcamento', 'orcamento zero', 'sem verba', 'sem recurso', 'nao temos orcamento', 'custo zero', 'gratuito'] },
  { id: 'limited', label: 'Orçamento limitado', rank: 2, terms: ['orcamento limitado', 'orcamento restrito', 'recurso limitado', 'verba limitada', 'pouco orcamento'] },
  { id: 'available', label: 'Orçamento disponível', rank: 3, terms: ['ha orcamento', 'temos orcamento', 'orcamento aprovado', 'orcamento disponivel', 'verba aprovada'] },
]);

/** Marcadores léxicos usados para reconhecer intenções sem taxonomia própria. */
export const LEXICAL_MARKERS = Object.freeze({
  constraint: Object.freeze(['nao pode', 'nao podemos', 'nao deve', 'evitar', 'restricao', 'restrito', 'somente', 'apenas', 'obrigatorio', 'exige', 'impedimento', 'limitacao', 'proibido', 'vedado'].map(fold)),
  risk: Object.freeze(['conflito de interesse', 'sancao', 'corrupcao', 'fraude', 'embargo', 'inelegivel', 'controversia', 'reputacional', 'processo judicial', 'condenacao'].map(fold)),
  outcome: Object.freeze(['espero', 'objetivo', 'resultado', 'meta', 'para que', 'pretendo', 'queremos', 'precisamos alcancar', 'entregar', 'gerar'].map(fold)),
  measurable: Object.freeze(['indicador', 'meta', 'percentual', 'numero de', 'quantidade', 'taxa de', 'kpi', 'mensuravel'].map(fold)),
  unknown: Object.freeze(['nao sei', 'nao sei ainda', 'ainda nao sei', 'desconheco', 'sem preferencia', 'indefinido', 'nao informado', 'tanto faz'].map(fold)),
});

/**
 * Conta quantos termos de uma entrada da taxonomia aparecem no texto.
 * A busca usa limites de palavra sempre que o termo é alfanumérico simples,
 * para que "sp" não case dentro de "esporte".
 */
function countTerms(foldedText, terms) {
  const matched = [];
  for (const term of terms) {
    // Termos com quatro letras ou mais aceitam até dois caracteres de flexão
    // ("instrutor" casa "instrutores"), sempre com fronteira de palavra ao
    // final — o que impede que "acesso" case dentro de "acessório".
    const pattern = /^[a-z0-9]{4,}$/.test(term)
      ? new RegExp(`\\b${term}[a-z]{0,2}\\b`)
      : /^[a-z0-9]+$/.test(term)
        ? new RegExp(`\\b${term}\\b`)
        : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
    if (pattern.test(foldedText)) matched.push(term);
  }
  return matched;
}

/**
 * Casa um texto livre contra uma taxonomia.
 * @returns {{id:string,label:string,matched:string[],strength:number}[]} entradas
 * acionadas, da mais forte para a mais fraca.
 */
export function matchTaxonomy(text, entries) {
  const folded = fold(text);
  if (!folded.trim()) return [];
  return entries
    .map((entry) => {
      const matched = countTerms(folded, entry.terms);
      return { id: entry.id, label: entry.label, short: entry.short || entry.label, rank: entry.rank, weight: entry.weight ?? 1, matched, strength: Math.min(1, matched.length / 2) };
    })
    .filter((entry) => entry.matched.length > 0)
    .sort((left, right) => right.matched.length - left.matched.length || String(left.id).localeCompare(String(right.id)));
}

export function hasMarker(text, markers) {
  const folded = fold(text);
  return markers.filter((marker) => folded.includes(marker));
}

/** Baseline legível exibido na rastreabilidade e enviado ao provider. */
export const SENAI_STRATEGIC_BASELINE = Object.freeze(STRATEGIC_PRIORITIES.map((priority) => priority.label));

export const SENAI_CONTEXT = Object.freeze({
  version: SENAI_CONTEXT_VERSION,
  priorities: STRATEGIC_PRIORITIES,
  contributions: CONTRIBUTION_TYPES,
  audiences: AUDIENCE_PROFILES,
  evidence: EVIDENCE_TYPES,
  geography: GEOGRAPHY_SCOPES,
  modalities: MODALITIES,
  languages: LANGUAGES,
  horizons: TIME_HORIZONS,
  budgets: BUDGET_LEVELS,
});
