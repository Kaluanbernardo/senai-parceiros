import { CATALOG_COLUMNS, CATALOG_SCHEMA_VERSION, resolveCatalogColumns } from './catalogImportSchema';

// Backwards-compatible export for the existing prompt UI and tests. The
// import schema is the single source of truth for both sides of the flow.
export const CATEGORY_SCHEMAS = CATALOG_COLUMNS;

/**
 * @param {string[]} [columns] recorte de colunas pedido. Vazio significa todas.
 *   Pedir só o necessário encurta a pesquisa e reduz o campo em que o modelo
 *   pode inventar: cada coluna a mais é uma pergunta a mais que ele vai tentar
 *   responder mesmo sem fonte.
 */
export function generateResearchPrompt({ category, context, purpose, geography, quantity, extraCriteria, columns }) {
  const selectedCategory = CATALOG_COLUMNS[category] ? category : 'organization';
  const schema = resolveCatalogColumns(selectedCategory, columns);
  const schemaLines = schema.map((column, index) => `${index + 1}. ${column.name} (${column.type}) — ${column.description}${column.required ? ' [OBRIGATÓRIO]' : ''}`).join('\n');
  const headers = schema.map((column) => column.name).join(' | ');
  const total = CATALOG_COLUMNS[selectedCategory].length;
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
    schema.length < total
      ? `São ${schema.length} colunas das ${total} previstas para esta categoria. Não acrescente nenhuma coluna fora desta lista: colunas a mais fazem o arquivo ser recusado na importação.`
      : 'Não acrescente nenhuma coluna fora desta lista.',
    'Crie uma aba Metadados separada para contexto, critérios, limitações, fontes que falharam e data de geração. Não misture prosa com as linhas da aba Stakeholders.',
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
    'SAÍDA OBRIGATÓRIA',
    'Entregue um workbook XLSX com as abas Stakeholders e Metadados. Se a ferramenta não conseguir gerar XLSX, entregue CSV UTF-8 usando os mesmos nomes, ordem e tipos de colunas e explique que a conversão para XLSX será necessária antes da importação.',
    '',
    'DEFINIÇÃO DAS COLUNAS',
    schemaLines,
  ];
  return `Você é um pesquisador responsável por uma pesquisa pública e rastreável de stakeholders para o SENAI-SP.\n\n${sections.join('\n')}`;
}
