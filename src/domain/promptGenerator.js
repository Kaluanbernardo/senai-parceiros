import { CATALOG_COLUMNS, CATALOG_SCHEMA_VERSION, normalizeCatalogCategory } from './catalogImportSchema';

// Backwards-compatible export for the existing prompt UI and tests. The
// import schema is the single source of truth for both sides of the flow.
export const CATEGORY_SCHEMAS = CATALOG_COLUMNS;

const CATEGORY_PROMPT_LABELS = Object.freeze({
  person: 'pessoas especialistas',
  school: 'instituições de educação',
  organization: 'organizações',
});

export function generateResearchPrompt({ category, context, purpose, geography, quantity, extraCriteria, personProfiles, sourcePreferences }) {
  const requestedCategory = normalizeCatalogCategory(category);
  const selectedCategory = CATALOG_COLUMNS[requestedCategory] ? requestedCategory : 'organization';
  const schema = CATALOG_COLUMNS[selectedCategory];
  const selectedLabel = CATEGORY_PROMPT_LABELS[selectedCategory];
  const schemaLines = schema.map((column, index) => `${index + 1}. ${column.name} (${column.type}): ${column.description}${column.required ? ' [OBRIGATÓRIO]' : ''}`).join('\n');
  const headers = schema.map((column) => column.name).join(' | ');
  const sections = [
    'CONTEXTO DA BUSCA',
    `- Contexto: ${context || 'não informado'}`,
    `- Finalidade: ${purpose || 'não informada'}`,
    `- Geografia: ${geography || 'sem preferência'}`,
    `- Quantidade máxima desejada: ${quantity || 'a definir'}`,
    `- Critérios adicionais: ${extraCriteria || 'nenhum além do contexto'}`,
    ...(selectedCategory === 'person' ? [
      `- Atuações profissionais desejadas: ${personProfiles || 'qualquer atuação coerente com o contexto'}`,
      `- Fontes preferidas para descoberta ou verificação: ${sourcePreferences || 'fontes públicas adequadas ao perfil'}`,
    ] : []),
    '',
    'TIPO DE STAKEHOLDER SELECIONADO',
    `PESQUISE SOMENTE ${selectedLabel.toUpperCase()}.`,
    'Não inclua pessoas, organizações ou instituições de educação de outra categoria, mesmo que sejam relevantes. Não misture categorias no mesmo CSV.',
    `Toda linha deve ter tipo_registro exatamente igual a ${selectedCategory}.`,
    '',
    'ESCOPO E CRITÉRIO INSTITUCIONAL',
    'Considere sempre a contribuição potencial para educação profissional de qualidade, desenvolvimento da indústria paulista, inovação, tecnologia, sustentabilidade, desenvolvimento regional e parcerias aplicáveis. Explique quando a conexão for apenas contextual e não direta.',
    '',
    'CONTRATO DE IMPORTAÇÃO',
    `schema_version deve ser exatamente ${CATALOG_SCHEMA_VERSION}. tipo_registro deve ser exatamente ${selectedCategory}.`,
    'A tabela importável deve ficar na aba Stakeholders, com uma linha de cabeçalho e uma entidade por linha. Use exatamente as colunas abaixo, nesta ordem:',
    headers,
    'Use todas as colunas acima. Não remova, renomeie, repita ou acrescente colunas.',
    '',
    'REGRAS DE EVIDÊNCIA',
    '1. Use somente informações públicas e cite a URL exata de cada fato relevante.',
    '2. Não invente fatos, pessoas, organizações, cargos, números, colunas ou contatos.',
    '3. Quando um dado não for localizado, escreva exatamente “não localizado” no campo correspondente.',
    '4. Separe fatos encontrados de inferências e sinalize conflitos entre fontes.',
    '5. Informe a data de consulta e uma confiança de 0 a 100 acompanhada de justificativa.',
    '6. Listas usam ponto e vírgula. Produções usam Título | URL | ano | tipo; ...',
    '7. Não crie colunas de foto, avatar, imagem, credencial ou dado privado.',
    '',
    'PADRÃO MÍNIMO DE QUALIDADE — NÃO NEGOCIÁVEL',
    '1. Cada perfil precisa ter descrição factual e detalhada com pelo menos 400 caracteres; não use texto genérico, repetido ou apenas uma frase biográfica.',
    '2. Cada perfil precisa ter resumo factual, pelo menos 3 áreas/temas específicos e pelo menos 3 URLs públicas distintas em fontes.',
    selectedCategory === 'person'
      ? '3. Para cada pessoa, confirme cargo, organização, áreas de especialidade, atuação profissional e ao menos um perfil público direto. Registre trabalhos relevantes em producoes_relevantes, sejam artigos, projetos, reportagens, entrevistas, palestras ou relatórios.'
      : '3. Para cada registro, preencha os campos específicos da categoria com fatos verificáveis: não deixe o perfil depender apenas de nome, site e uma descrição curta.',
    selectedCategory === 'person'
      ? '4. Aplique exigências acadêmicas somente a perfis de pesquisa: localize publicações, ORCID, OpenAlex, Google Scholar, citações e h-index quando existirem. Para imprensa, registre veículo, área de cobertura e trabalhos recentes. Para LinkedIn, use a URL pública e confirme o vínculo atual em outra fonte quando possível.'
      : '4. Para escolas e organizações, preencha os campos específicos de oferta, atuação, setor, relação com a indústria e programas/parcerias quando públicos.',
    '5. Se uma entidade não atingir esses mínimos com fontes reais, não a inclua: pesquise outra entidade. Nunca complete a quantidade com perfil raso, link genérico ou dado inventado.',
    '',
    'SAÍDA OBRIGATÓRIA',
    'Entregue somente um CSV UTF-8, separado por vírgulas, com o cabeçalho e as linhas da tabela Stakeholders. Use aspas CSV corretas em campos que contenham vírgulas, ponto e vírgula ou quebras de linha.',
    'Não entregue XLSX, JSON, Markdown, bloco de código, aba Metadados ou qualquer explicação antes/depois do CSV. A primeira linha da resposta deve ser o cabeçalho e a última deve ser a última linha do CSV.',
    '',
    'DEFINIÇÃO DAS COLUNAS',
    schemaLines,
  ];
  return `Você é responsável por uma pesquisa pública e rastreável de stakeholders para o SENAI-SP.\n\n${sections.join('\n')}`;
}
