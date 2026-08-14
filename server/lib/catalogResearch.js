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
import { CATALOG_RESEARCH_BATCH_SIZE, CATALOG_RESEARCH_QUANTITIES } from '../../src/domain/catalogResearchFlow.js';

export { CATALOG_RESEARCH_BATCH_SIZE, CATALOG_RESEARCH_QUANTITIES };

const SYSTEM_MANAGED_FIELDS = new Set(['schema_version', 'tipo_registro', 'data_consulta']);
const PERSON_ENRICHMENT_FIELDS = Object.freeze([
  'website_oficial',
  'perfil_principal_url',
  'linkedin_url',
  'google_scholar_url',
  'orcid',
  'openalex_id',
  'h_index',
  'citacoes',
  'publicacoes_relevantes',
]);
const PERSON_ENRICHMENT_MISSING_FIELDS = new Set([...PERSON_ENRICHMENT_FIELDS, 'lattes.cnpq.br']);

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

const GEOGRAPHY_LABELS = Object.freeze({
  brasil: 'Brasil; inclua somente pessoas ou instituições com atuação verificável no país',
  internacional: 'Internacional; procure referências fora do Brasil ou com atuação transnacional comprovada',
});

function limitedText(value, field, maximum, { required = false } = {}) {
  const text = String(value || '').trim();
  if (required && !text) throw new Error(`${field}_required`);
  if (text.length > maximum) throw new Error(`${field}_too_long`);
  return text;
}

export function normalizeCatalogResearchRequest(input = {}) {
  const category = normalizeCatalogCategory(String(input.category || '').trim().toLowerCase());
  if (!CATEGORY_LABELS[category]) throw new Error('invalid_research_category');
  const quantity = Number(input.quantity || CATALOG_RESEARCH_QUANTITIES[0]);
  if (!CATALOG_RESEARCH_QUANTITIES.includes(quantity)) {
    throw new Error('invalid_research_quantity');
  }
  const batchSize = Number(input.batchSize || Math.min(CATALOG_RESEARCH_BATCH_SIZE, quantity));
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > CATALOG_RESEARCH_BATCH_SIZE || batchSize > quantity) {
    throw new Error('invalid_research_batch_size');
  }
  const batchIndex = Number(input.batchIndex || 0);
  if (!Number.isInteger(batchIndex) || batchIndex < 0 || batchIndex > 99) throw new Error('invalid_research_batch_index');
  const geography = limitedText(input.geography || 'brasil', 'research_geography', 30).toLowerCase();
  if (!GEOGRAPHY_LABELS[geography]) throw new Error('invalid_research_geography');
  const excludeCandidates = Array.isArray(input.excludeCandidates)
    ? [...new Set(input.excludeCandidates.map((value) => limitedText(value, 'research_excluded_candidate', 240)).filter(Boolean))].slice(0, 100)
    : [];
  return {
    category,
    quantity,
    batchSize,
    batchIndex,
    context: limitedText(input.context, 'research_context', 1600, { required: true }),
    purpose: limitedText(input.purpose, 'research_purpose', 800),
    geography,
    prioritizationFactors: limitedText(input.prioritizationFactors, 'research_prioritization_factors', 1200),
    exclusionFactors: limitedText(input.exclusionFactors, 'research_exclusion_factors', 1200),
    excludeCandidates,
    sourcePreferences: (() => {
      const value = limitedText(input.sourcePreferences || 'auto', 'research_sources', 50).toLowerCase();
      if (!SOURCE_PREFERENCE_LABELS[value]) throw new Error('invalid_research_source_preference');
      return value;
    })(),
  };
}

function propertySchema(column, category) {
  const personSearchDescriptions = {
    google_scholar_url: 'Faça busca dedicada por nome e instituição em scholar.google.com/citations; deixe vazio somente sem correspondência inequívoca.',
    linkedin_url: 'Faça busca dedicada por nome e instituição em linkedin.com/in; aceite somente perfil público com identidade confirmada.',
    orcid: 'Faça busca dedicada em orcid.org e confirme afiliação, temas ou publicações antes de associar o identificador.',
    openalex_id: 'Resolva a pessoa no OpenAlex por nome, afiliação e produção; não associe apenas por semelhança nominal.',
    h_index: 'Informe somente métrica pública atribuída à identidade confirmada e registre a fonte.',
    citacoes: 'Informe somente contagem pública atribuída à identidade confirmada e registre a fonte e a data.',
    publicacoes_relevantes: 'Para pesquisadores, procure as cinco publicações mais citadas verificáveis, com URL direta e ano.',
    dados_nao_localizados: 'Só inclua um campo após consulta dedicada, no formato "campo: buscas realizadas e motivo da não confirmação".',
  };
  const description = category === 'person' && personSearchDescriptions[column.name]
    ? `${column.description} ${personSearchDescriptions[column.name]}`
    : column.description;
  if (column.name === 'confianca') {
    return { type: 'integer', minimum: 0, maximum: 100, description };
  }
  if (column.type === 'numero') {
    return { type: ['integer', 'null'], minimum: 0, description };
  }
  if (column.type === 'lista') {
    return { type: 'array', items: { type: 'string' }, description };
  }
  return { type: 'string', description };
}

export function catalogResearchOutputSchema(category, quantity) {
  const columns = getCatalogColumns(category).filter((column) => !SYSTEM_MANAGED_FIELDS.has(column.name));
  const properties = Object.fromEntries(columns.map((column) => [column.name, propertySchema(column, category)]));
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
      'Esta chamada faz a descoberta e a verificação de identidade. Capture os perfis acadêmicos que estiverem diretamente confirmados, mas não gaste o orçamento inteiro tentando esgotar cada métrica: uma segunda chamada fará o enriquecimento dedicado das pessoas selecionadas.',
    ]
    : ['Priorize o site oficial e fontes públicas independentes que confirmem atuação, escala, programas e relação com indústria ou educação profissional.'];
  return [
    `Pesquise somente ${CATEGORY_LABELS[request.category]}.`,
    `Este é o lote ${request.batchIndex + 1}. Entregue até ${request.batchSize} sugestões novas; a pesquisa completa pediu ${request.quantity}.`,
    `Contexto: ${request.context}`,
    `Finalidade: ${request.purpose || 'não informada'}`,
    `Escopo geográfico: ${GEOGRAPHY_LABELS[request.geography]}.`,
    `Fatores de priorização: ${request.prioritizationFactors || 'nenhum além da aderência e da qualidade das evidências'}`,
    `Fatores de exclusão: ${request.exclusionFactors || 'nenhum além das regras obrigatórias abaixo'}`,
    `Não repita candidatos de lotes anteriores: ${request.excludeCandidates.length ? request.excludeCandidates.join(' | ') : 'nenhum candidato anterior'}.`,
    `Fontes prioritárias: ${SOURCE_PREFERENCE_LABELS[request.sourcePreferences]}. Use a preferência para ordenar a busca, sem dispensar fontes complementares necessárias à verificação.`,
    '',
    'Método de pesquisa profunda obrigatório:',
    '- Planeje consultas diferentes, pesquise a web repetidamente e compare fontes antes de selecionar cada candidato.',
    '- Aplique os fatores de exclusão como eliminatórios e use os fatores de priorização para ordenar os candidatos restantes.',
    '- Use somente informações públicas e verificáveis; confirme identidade, atuação atual e aderência antes de preencher a ficha.',
    '- Não invente entidades, vínculos, cargos, números, contatos, publicações ou URLs.',
    '- Cada sugestão precisa do schema completo, descrição factual detalhada, pelo menos três temas específicos e três URLs públicas distintas em fontes.',
    '- fontes deve conter apenas URLs http(s) exatas. evidencias_publicas deve ligar fatos importantes às respectivas URLs.',
    '- Separe fatos de inferências; registre conflitos em riscos_sinais e ausências em dados_nao_localizados.',
    '- Para qualquer campo não localizado, use string vazia ou lista vazia, conforme o schema.',
    '- Não inclua dados privados nem meios de contato que não tenham sido publicados profissionalmente.',
    ...categoryGuidance.map((line) => `- ${line}`),
    '- Responda somente o JSON exigido pelo schema. Não produza CSV, Markdown ou explicações fora dele.',
  ].join('\n');
}

function personEnrichmentOutputSchema(quantity) {
  const stringField = (description) => ({ type: 'string', description });
  const listField = (description) => ({ type: 'array', items: { type: 'string' }, description });
  const properties = {
    nome: stringField('Nome exatamente como recebido na lista de identidades.'),
    website_oficial: stringField('Página institucional ou pessoal oficial confirmada.'),
    perfil_principal_url: stringField('Melhor perfil público confirmado para abrir no catálogo.'),
    linkedin_url: stringField('URL pública inequívoca em linkedin.com/in, ou string vazia.'),
    google_scholar_url: stringField('URL pública inequívoca em scholar.google.com/citations, ou string vazia.'),
    orcid: stringField('Identificador ORCID confirmado, ou string vazia.'),
    openalex_id: stringField('Identificador ou URL de autor no OpenAlex confirmado, ou string vazia.'),
    h_index: { type: ['integer', 'null'], minimum: 0, description: 'h-index público da identidade confirmada; null quando não verificável.' },
    citacoes: { type: ['integer', 'null'], minimum: 0, description: 'Contagem pública de citações da identidade confirmada; null quando não verificável.' },
    publicacoes_relevantes: listField('Até cinco itens no formato Título | URL direta | ano, ordenados por citações somente quando a ordem for verificável.'),
    fontes_enriquecimento: listField('URLs http(s) exatas consultadas nesta segunda passagem.'),
    dados_nao_localizados: listField('Somente lacunas desta segunda passagem, no formato campo: buscas realizadas e motivo da não confirmação.'),
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['profiles'],
    properties: {
      profiles: {
        type: 'array',
        minItems: quantity,
        maxItems: quantity,
        items: {
          type: 'object',
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      },
    },
  };
}

function personEnrichmentPrompt(request, candidates) {
  const identities = candidates.map((candidate) => ({
    nome: candidate.nome,
    instituicao_atual: candidate.instituicao_atual,
    cargo: candidate.cargo,
    website_oficial: candidate.website_oficial,
    perfil_principal_url: candidate.perfil_principal_url,
    google_scholar_url: candidate.google_scholar_url,
    orcid: candidate.orcid,
    openalex_id: candidate.openalex_id,
    fontes: candidate.fontes,
  }));
  return [
    'Faça a segunda passagem de enriquecimento das pessoas já selecionadas abaixo.',
    'Não descubra novas pessoas, não troque identidades e devolva uma entrada para cada nome recebido.',
    'Comece pelas páginas e fontes já localizadas. Inspecione links públicos nelas antes de concluir que um perfil não existe.',
    'Para cada pessoa, pesquise o nome completo junto da instituição atual e repita com variações sem acentos ou nomes intermediários quando houver ambiguidade.',
    'Execute consultas dedicadas com "nome completo" "instituição" site:scholar.google.com/citations, "nome completo" site:orcid.org, "nome completo" site:linkedin.com/in e "nome completo" site:lattes.cnpq.br.',
    'Use também páginas institucionais, OpenAlex e Crossref para confirmar identidade e completar google_scholar_url, orcid, openalex_id, linkedin_url, h_index, citacoes e publicacoes_relevantes.',
    'Métricas devem ser inteiros atribuídos a uma identidade confirmada. Não coloque justificativas, faixas ou "não localizado" em h_index ou citacoes; use null.',
    'Só registre um campo em dados_nao_localizados depois da consulta dedicada. Use o formato "campo: buscas realizadas e motivo da não confirmação" para tornar a lacuna auditável.',
    `Contexto original: ${request.context}`,
    `Identidades confirmadas na descoberta: ${JSON.stringify(identities)}`,
    'Responda somente o JSON exigido pelo schema.',
  ].join('\n');
}

function normalizedIdentity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function missingField(value) {
  return String(value || '').split(':', 1)[0].trim().toLowerCase();
}

function mergePersonEnrichment(candidates, profiles) {
  const byName = new Map((profiles || []).map((profile) => [normalizedIdentity(profile.nome), profile]));
  return candidates.map((candidate) => {
    const profile = byName.get(normalizedIdentity(candidate.nome));
    if (!profile) return candidate;
    const merged = { ...candidate };
    for (const field of PERSON_ENRICHMENT_FIELDS) {
      const value = profile[field];
      if (Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '') merged[field] = value;
    }
    merged.fontes = [...new Set([...(Array.isArray(candidate.fontes) ? candidate.fontes : []), ...(Array.isArray(profile.fontes_enriquecimento) ? profile.fontes_enriquecimento : [])])];
    const priorMissing = (Array.isArray(candidate.dados_nao_localizados) ? candidate.dados_nao_localizados : [])
      .filter((entry) => !PERSON_ENRICHMENT_MISSING_FIELDS.has(missingField(entry)));
    merged.dados_nao_localizados = [...priorMissing, ...(Array.isArray(profile.dados_nao_localizados) ? profile.dados_nao_localizados : [])];
    return merged;
  });
}

function mergedTrace(traces) {
  const usable = traces.filter(Boolean);
  const usage = usable.reduce((total, trace) => {
    for (const field of ['prompt_tokens', 'completion_tokens', 'total_tokens']) total[field] += Number(trace.usage?.[field] || 0);
    return total;
  }, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  const last = usable.at(-1) || {};
  return {
    ...last,
    usage,
    usages: usable.map((trace) => trace.usage || null),
    webSearchRequests: usable.reduce((sum, trace) => sum + Number(trace.webSearchRequests || 0), 0),
    webSearchSources: usable.flatMap((trace) => trace.webSearchSources || []),
  };
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
  const discovery = await generate({
    task: `catalog_research_${request.category}_batch_${request.batchIndex + 1}`,
    model: 'openai/gpt-5.6-luna',
    strictOutput: true,
    requireParameters: false,
    schema: catalogResearchOutputSchema(request.category, request.batchSize),
    messages: [
      { role: 'system', content: 'Você realiza pesquisa pública, rastreável e conservadora para o catálogo de stakeholders do SENAI-SP.' },
      { role: 'user', content: promptFor(request) },
    ],
    maxOutputTokens: 16000,
    temperature: 0.1,
    webSearch: {
      engine: 'native',
      maxResults: 10,
      maxTotalResults: 20,
      searchContextSize: 'high',
    },
    signal,
  });
  const consultedAt = now().toISOString().slice(0, 10);
  let candidates = Array.isArray(discovery.data?.candidates) ? discovery.data.candidates.slice(0, request.batchSize) : [];
  if (!candidates.length) throw new Error('research_empty_output');
  const traces = [discovery.trace];
  if (request.category === 'person') {
    const enrichment = await generate({
      task: `catalog_research_person_enrichment_batch_${request.batchIndex + 1}`,
      model: 'openai/gpt-5.6-luna',
      strictOutput: true,
      requireParameters: false,
      schema: personEnrichmentOutputSchema(candidates.length),
      messages: [
        { role: 'system', content: 'Você verifica identidades e perfis acadêmicos públicos com rastreabilidade e sem inferir URLs ou métricas.' },
        { role: 'user', content: personEnrichmentPrompt(request, candidates) },
      ],
      maxOutputTokens: 10000,
      temperature: 0.1,
      webSearch: {
        engine: 'native',
        maxResults: 10,
        maxTotalResults: 20,
        searchContextSize: 'high',
      },
      signal,
    });
    candidates = mergePersonEnrichment(candidates, enrichment.data?.profiles);
    traces.push(enrichment.trace);
  }
  const trace = mergedTrace(traces);
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
        provider: trace.provider,
        model: trace.model,
        webSearchRequests: trace.webSearchRequests || 0,
        batchIndex: request.batchIndex,
        requestedQuantity: request.quantity,
      },
      filename: `Pesquisa profunda — ${CATEGORY_LABELS[request.category]} — lote ${request.batchIndex + 1} — ${consultedAt}`,
      rowCount: rows.length,
    },
    trace,
  };
}
