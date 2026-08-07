import { CATALOG_COLUMNS, CATALOG_SCHEMA_VERSION } from './catalogImportSchema';

// Backwards-compatible export for the existing prompt UI and tests. The
// import schema is the single source of truth for both sides of the flow.
export const CATEGORY_SCHEMAS = CATALOG_COLUMNS;

export function generateResearchPrompt({ category, context, purpose, geography, quantity, extraCriteria }) {
  const selectedCategory = CATALOG_COLUMNS[category] ? category : 'organization';
  const schema = CATALOG_COLUMNS[selectedCategory];
  const schemaLines = schema.map((column, index) => `${index + 1}. ${column.name} (${column.type}): ${column.description}${column.required ? ' [OBRIGATÓRIO]' : ''}`).join('\n');
  const headers = schema.map((column) => column.name).join(' | ');
  const sections = [
    'CONTEXTO DA BUSCA',
    `- Contexto: ${context || 'não informado'}`,
    `- Finalidade: ${purpose || 'não informada'}`,
    `- Geografia: ${geography || 'sem preferência'}`,
    `- Quantidade máxima desejada: ${quantity || 'a definir'}`,
    `- Critérios adicionais: ${extraCriteria || 'nenhum além do contexto'}`,
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
    '6. Listas usam ponto e vírgula. Publicações usam Título | URL | ano; ...',
    '7. Não crie colunas de foto, avatar, imagem, credencial ou dado privado.',
    '',
    'PADRÃO MÍNIMO DE QUALIDADE — NÃO NEGOCIÁVEL',
    '1. Cada perfil precisa ter descrição factual e detalhada com pelo menos 400 caracteres; não use texto genérico, repetido ou apenas uma frase biográfica.',
    '2. Cada perfil precisa ter resumo factual, pelo menos 3 áreas/temas específicos e pelo menos 3 URLs públicas distintas em fontes.',
    selectedCategory === 'researcher'
      ? '3. Cada pesquisador precisa ter pelo menos 5 publicações relevantes verificadas; selecione entre elas os 5 artigos com mais citações no Google Scholar, no formato Título | URL direta | ano. Informe a contagem de citações no título ou em evidencias_publicas quando ela estiver pública. A URL deve apontar para DOI, periódico, editora, repositório ou página institucional da publicação; perfil de Google Scholar, página de busca ou lista genérica não conta como publicação. Se o perfil não permitir verificar cinco artigos, não inclua a pessoa.'
      : '3. Para cada registro, preencha os campos específicos da categoria com fatos verificáveis: não deixe o perfil depender apenas de nome, site e uma descrição curta.',
    selectedCategory === 'researcher'
      ? '4. Para pesquisadores, preencha instituição atual, cargo, áreas de especialidade e linhas de pesquisa quando públicos; localize também ORCID, OpenAlex e Google Scholar quando existirem.'
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
  return `Você é um pesquisador responsável por uma pesquisa pública e rastreável de stakeholders para o SENAI-SP.\n\n${sections.join('\n')}`;
}
