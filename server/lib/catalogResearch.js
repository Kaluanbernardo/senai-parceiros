import crypto from 'node:crypto';
import {
  CATALOG_SCHEMA_VERSION,
  getCatalogColumns,
  getCatalogHeaders,
  normalizeCatalogCategory,
  rowToCanonical,
  serializeList,
  validateCatalogRow,
} from '../../src/domain/catalogImportSchema.js';
import { generateStructured } from './structuredGeneration.js';

export const CATALOG_RESEARCH_MAX_CANDIDATES = 3;

const COMMON_FIELDS = [
  'nome', 'pais', 'cidade_estado', 'resumo', 'descricao', 'areas_temas',
  'aderencia_contexto', 'relacao_publica', 'evidencias_publicas',
  'riscos_sinais', 'website_oficial', 'contato_publico', 'fontes',
  'confianca', 'dados_nao_localizados',
];

const CATEGORY_FIELDS = Object.freeze({
  person: [
    'perfis_atuacao', 'instituicao_atual', 'cargo', 'areas_especialidade',
    'perfil_principal_url', 'linkedin_url', 'producoes_relevantes',
    'credenciais_relevantes', 'linhas_pesquisa', 'publicacoes_relevantes',
    'citacoes', 'h_index', 'orcid', 'google_scholar_url', 'openalex_id',
  ],
  school: [
    'tipo_instituicao', 'nivel_rede', 'areas_formacao', 'niveis_oferta',
    'relacao_industria', 'escala', 'acreditacoes', 'dominio_oficial',
    'identificador_publico',
  ],
  organization: [
    'natureza_juridica', 'setor', 'atuacao', 'programas_relevantes',
    'parcerias_industriais', 'alcance_geografico', 'dominio_oficial',
    'identificador_publico',
  ],
});

const CATEGORY_LABELS = Object.freeze({
  person: 'pessoas especialistas',
  school: 'instituições de educação',
  organization: 'organizações',
});

const SOURCE_PREFERENCE_LABELS = Object.freeze({
  auto: 'as melhores fontes públicas disponíveis para cada fato',
  official: 'sites oficiais e fontes governamentais',
  academic: 'bases acadêmicas e publicações originais',
  industry: 'entidades setoriais e imprensa especializada',
  professional: 'perfis profissionais e páginas institucionais',
});

function limitedText(value, field, maximum, { required = false } = {}) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${field}_required`);
  if (text.length > maximum) throw new Error(`${field}_too_long`);
  return text;
}

export function normalizeCatalogResearchRequest(input = {}) {
  const category = normalizeCatalogCategory(String(input.category || '').trim().toLowerCase());
  if (!CATEGORY_FIELDS[category]) throw new Error('invalid_research_category');
  const quantity = Number(input.quantity || CATALOG_RESEARCH_MAX_CANDIDATES);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > CATALOG_RESEARCH_MAX_CANDIDATES) {
    throw new Error('invalid_research_quantity');
  }
  return {
    category,
    quantity,
    context: limitedText(input.context, 'research_context', 1600, { required: true }),
    purpose: limitedText(input.purpose, 'research_purpose', 800),
    geography: limitedText(input.geography, 'research_geography', 300),
    extraCriteria: limitedText(input.extraCriteria, 'research_criteria', 1000),
    sourcePreferences: (() => {
      const value = limitedText(input.sourcePreferences || 'auto', 'research_sources', 50).toLowerCase();
      if (!SOURCE_PREFERENCE_LABELS[value]) throw new Error('invalid_research_source_preference');
      return value;
    })(),
  };
}

function propertySchema(column) {
  if (column.name === 'confianca') {
    return { type: 'integer', minimum: 0, maximum: 100, description: column.description };
  }
  if (column.type === 'lista') {
    return { type: 'array', items: { type: 'string' }, description: column.description };
  }
  return { type: 'string', description: column.description };
}

export function catalogResearchOutputSchema(category, quantity) {
  const wanted = new Set([...COMMON_FIELDS, ...CATEGORY_FIELDS[category]]);
  const columns = getCatalogColumns(category).filter((column) => wanted.has(column.name));
  const properties = Object.fromEntries(columns.map((column) => [column.name, propertySchema(column)]));
  return {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        minItems: 1,
        maxItems: quantity,
        items: {
          type: 'object',
          additionalProperties: false,
          required: columns.map((column) => column.name),
          properties,
        },
      },
    },
  };
}

function promptFor(request) {
  const categoryGuidance = request.category === 'person'
    ? [
      'Diferencie atuação acadêmica, industrial, educacional, jornalística ou pública.',
      'Aplique métricas acadêmicas somente a pesquisadores. Quando for pesquisador, priorize em publicacoes_relevantes os cinco artigos mais citados que conseguir verificar publicamente, com URL direta; se a contagem não for pública, registre a lacuna.',
      'Use páginas institucionais, ORCID, OpenAlex, Crossref e perfis públicos diretos para resolver a identidade correta.',
    ]
    : ['Priorize o site oficial e fontes públicas independentes que confirmem atuação, escala, programas e relação com indústria ou educação profissional.'];
  return [
    `Pesquise somente ${CATEGORY_LABELS[request.category]}.`,
    `Entregue no máximo ${request.quantity} sugestões.`,
    `Contexto: ${request.context}`,
    `Finalidade: ${request.purpose || 'não informada'}`,
    `Geografia ou idioma: ${request.geography || 'sem preferência'}`,
    `Critérios adicionais: ${request.extraCriteria || 'nenhum'}`,
    `Fontes prioritárias: ${SOURCE_PREFERENCE_LABELS[request.sourcePreferences]}. Use a preferência para ordenar a busca, sem dispensar fontes complementares necessárias à verificação.`,
    '',
    'Regras obrigatórias:',
    '- Pesquise a web e use somente informações públicas e verificáveis.',
    '- Não invente entidades, vínculos, cargos, números, contatos, publicações ou URLs.',
    '- Cada sugestão precisa de descrição factual detalhada, pelo menos três temas específicos e três URLs públicas distintas em fontes.',
    '- fontes deve conter apenas URLs http(s) exatas. evidencias_publicas deve ligar fatos importantes às respectivas URLs.',
    '- Separe fatos de inferências; registre conflitos em riscos_sinais e ausências em dados_nao_localizados.',
    '- Para qualquer campo não localizado, use string vazia ou lista vazia, conforme o schema.',
    '- Não inclua dados privados nem meios de contato que não tenham sido publicados profissionalmente.',
    ...categoryGuidance.map((line) => `- ${line}`),
    '- Responda somente o JSON exigido pelo schema. Não produza CSV, Markdown ou explicações fora dele.',
  ].join('\n');
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function rowHash(row) {
  return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function candidateToEntry(candidate, category, rowNumber, consultedAt) {
  const columnMap = new Map(getCatalogColumns(category).map((column) => [column.name, column]));
  const row = Object.fromEntries(getCatalogHeaders(category).map((header) => [header, '']));
  for (const [field, value] of Object.entries(candidate || {})) {
    const column = columnMap.get(field);
    if (!column) continue;
    row[field] = column.type === 'lista' ? serializeList(value) : String(value ?? '').trim();
  }
  const suppliedSources = Array.isArray(candidate?.fontes) ? candidate.fontes : [];
  const validSources = [...new Set(suppliedSources.map(validHttpUrl).filter(Boolean))];
  row.schema_version = CATALOG_SCHEMA_VERSION;
  row.tipo_registro = category;
  row.data_consulta = consultedAt;
  row.fontes = serializeList(validSources);

  const validation = validateCatalogRow(row, category, rowNumber);
  const qualityErrors = [];
  if (validSources.length < 3) qualityErrors.push(`Linha ${rowNumber}: informe ao menos três fontes públicas válidas.`);
  if (String(row.resumo || '').trim().length < 80) qualityErrors.push(`Linha ${rowNumber}: resumo factual insuficiente.`);
  if (String(row.descricao || '').trim().length < 240) qualityErrors.push(`Linha ${rowNumber}: descrição factual insuficiente.`);
  const errors = [...validation.errors, ...qualityErrors];
  return {
    rowNumber,
    row,
    record: rowToCanonical(row),
    valid: errors.length === 0,
    errors,
    hash: rowHash(row),
  };
}

/**
 * Pesquisa e normaliza sugestões sem gravá-las. A rota administrativa decide
 * onde persistir a prévia; testes e outros chamadores recebem o mesmo lote sem
 * precisar conhecer OpenRouter, prompts ou o formato intermediário do modelo.
 */
export async function researchCatalogCandidates(input, { generate = generateStructured, now = () => new Date(), signal } = {}) {
  const request = normalizeCatalogResearchRequest(input);
  const generated = await generate({
    task: `catalog_research_${request.category}`,
    model: 'x-ai/grok-4.3',
    disableReasoning: true,
    strictOutput: true,
    schema: catalogResearchOutputSchema(request.category, request.quantity),
    messages: [
      { role: 'system', content: 'Você realiza pesquisa pública, rastreável e conservadora para o catálogo de stakeholders do SENAI-SP.' },
      { role: 'user', content: promptFor(request) },
    ],
    maxOutputTokens: 3200,
    temperature: 0.1,
    webSearch: {
      engine: 'native',
      maxResults: 3,
      maxTotalResults: 3,
      searchContextSize: 'low',
    },
    signal,
  });
  const consultedAt = now().toISOString().slice(0, 10);
  const candidates = Array.isArray(generated.data?.candidates) ? generated.data.candidates.slice(0, request.quantity) : [];
  if (!candidates.length) throw new Error('research_empty_output');
  const rows = candidates.map((candidate, index) => candidateToEntry(candidate, request.category, index + 1, consultedAt));
  return {
    category: request.category,
    parsed: {
      schemaVersion: CATALOG_SCHEMA_VERSION,
      category: request.category,
      headers: getCatalogHeaders(request.category),
      rows,
      errors: rows.flatMap((row) => row.errors),
      metadata: {
        origin: 'catalog_research',
        provider: generated.trace.provider,
        model: generated.trace.model,
        webSearchRequests: generated.trace.webSearchRequests || 0,
      },
      filename: `Pesquisa direta — ${CATEGORY_LABELS[request.category]} — ${consultedAt}`,
      rowCount: rows.length,
    },
    trace: generated.trace,
  };
}
