import crypto from 'node:crypto';
import { CATALOG_QUALITY_VERSION, auditCatalogQuality, auditCatalogRecord, catalogPublicUrls, catalogQualityPublicContract, isResearchProfile } from '../../src/domain/catalogQuality.js';
import { getCatalog } from './catalog.js';
import { catalogStore } from './catalogStore.js';
import { generateStructured } from './structuredGeneration.js';
import { canUseAi, recordAiUsageAtomic } from './usageBudget.js';
import { ORGANIZATION_SUBTYPES, PERSON_SUBTYPES, normalizeCatalogRequest, normalizeCatalogSubtype, withCatalogClassification } from '../../src/domain/catalogTaxonomy.js';

const CATEGORIES = ['organization', 'person'];
const MAX_ATTEMPTS = 2;
const BATCH_SIZE = 1;
const PROCESS_TIMEOUT_MS = 45_000;
const INTERACTION_VERSION = 2;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function useful(value) {
  return Boolean(text(value)) && !['-', '—', 'n/a', 'não localizado', 'nao localizado', 'não informado', 'nao informado'].includes(text(value).toLowerCase());
}

function list(value) {
  if (Array.isArray(value)) return value.flatMap(list);
  return text(value).split(/[;,\n]/).map((entry) => entry.trim()).filter(useful);
}

function unique(values) {
  return [...new Set(values.flatMap(list))];
}

function safeUrl(value) {
  try {
    const url = new URL(text(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function normalizeSources(sources) {
  const byUrl = new Map();
  for (const source of sources || []) {
    const url = safeUrl(source?.url);
    if (!url) continue;
    byUrl.set(url, { ...source, url });
  }
  return [...byUrl.values()];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function catalogProvider() {
  return Object.fromEntries(CATEGORIES.map((category) => [category, getCatalog(category)]));
}

function publicAudit(audit) {
  return {
    version: audit.version,
    total: audit.total,
    conforming: audit.conforming,
    needsEnrichment: audit.needsEnrichment,
    categories: audit.categories.map(({ category, total, conforming, needsEnrichment }) => ({ category, total, conforming, needsEnrichment })),
  };
}

function withoutInternalFields(value) {
  if (Array.isArray(value)) return value.map(withoutInternalFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith('_') && !['mergeEvidence', 'fieldProvenance', 'sourceRecords', 'sourceTypes', 'legacyIds', 'aliases'].includes(key))
    .map(([key, entry]) => [key, withoutInternalFields(entry)]));
}

/**
 * O registro gravado precisa carregar a mesma identidade com que o catálogo
 * derivado lê o card — só assim a gravação recai sobre o card pretendido.
 *
 * O esquema anterior reconstruía um id a partir da fonte
 * (`organization-<fonte>-<id>`) ou do id bruto do arquivo de origem, e nenhum
 * dos dois endereça o card: um card lido como `school:escolas:47` era gravado
 * como `47`, id que no catálogo derivado pertence a outra organização. Dos 54
 * cards de pessoa jurídica fora do padrão, 15 gravavam por cima de uma
 * organização diferente e 39 criavam um registro órfão, deixando o card
 * original reprovado. Nenhum atualizava o card pretendido — e a conferência
 * final, ao reprovar, era o único motivo de o catálogo não ser corrompido.
 */
function storageRecord(record, category) {
  const original = record?._original && typeof record._original === 'object' ? record._original : {};
  const merged = withoutInternalFields({ ...original, ...record });
  merged.id = record?.id ?? original?.id;
  if (category === 'organization' && record?.subtipo === ORGANIZATION_SUBTYPES[0]) {
    merged.instituicao = record?.nome || record?.instituicao || original?.instituicao || original?.nome;
  }
  return merged;
}

function createTarget(record, category) {
  const stored = storageRecord(record, category);
  return {
    key: `${category}:${String(record.id)}`,
    category,
    lookupId: String(record.id),
    storageId: stored.id,
    name: text(record.nome || record.instituicao),
    researchProfile: category === 'person' && isResearchProfile(record),
    sourceFingerprint: fingerprint(stored),
    record: stored,
    quality: auditCatalogRecord(stored, category),
    status: 'pending',
    attempts: 0,
    error: '',
    result: null,
  };
}

export function createCatalogEnrichmentBatch(catalog, now = new Date(), targetKeys) {
  const audit = auditCatalogQuality(catalog);
  const selected = Array.isArray(targetKeys) ? new Set(targetKeys.map(String)) : null;
  const targets = audit.categories.flatMap(({ category, results }) => results
    .filter((entry) => !entry.quality.pass)
    .map((entry) => createTarget(entry.record, category)))
    .filter((target) => !selected || selected.has(target.key));
  return {
    kind: 'enrichment',
    batchId: `enrich-${now.getTime()}-${crypto.randomBytes(4).toString('hex')}`,
    category: 'catalog',
    filename: 'Enriquecimento assistido do catálogo',
    qualityVersion: audit.version,
    interactionVersion: INTERACTION_VERSION,
    auditBefore: publicAudit(audit),
    targets,
    createdAt: now.toISOString(),
  };
}

function counts(batch) {
  const values = batch.targets || [];
  return {
    total: values.length,
    pending: values.filter((target) => target.status === 'pending').length,
    passed: values.filter((target) => target.status === 'passed').length,
    failed: values.filter((target) => target.status === 'failed').length,
    committed: values.filter((target) => target.status === 'committed').length,
    skipped: values.filter((target) => target.status === 'skipped').length,
  };
}

export function catalogEnrichmentBatchSummary(batch) {
  const progress = counts(batch);
  const nextTarget = (batch.targets || []).find((target) => target.status === 'pending');
  return {
    batchId: batch.batchId,
    kind: batch.kind,
    createdAt: batch.createdAt,
    counts: progress,
    // Cada card aprovado é gravado assim que passa. Exigir o lote inteiro
    // aprovado antes de gravar qualquer coisa significava, com 91 cards fora do
    // padrão, descartar o trabalho de 90 por causa de um — e o lote nunca
    // fechava.
    readyToCommit: progress.passed > 0,
    completeWithoutChanges: progress.total === 0,
    next: nextTarget ? {
      key: nextTarget.key,
      name: nextTarget.name,
      category: nextTarget.category,
      attempt: Math.min(MAX_ATTEMPTS, Number(nextTarget.attempts || 0) + 1),
      maxAttempts: MAX_ATTEMPTS,
      missing: nextTarget.quality?.missing?.map((item) => item.label) || [],
    } : null,
    failures: (batch.targets || []).filter((target) => target.status === 'failed').slice(0, 30).map((target) => ({
      key: target.key,
      name: target.name,
      category: target.category,
      error: target.error,
      missing: target.quality?.missing?.map((item) => item.label) || [],
    })),
  };
}

export function catalogEnrichmentCapabilities() {
  const ai = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT));
  const searchProvider = process.env.TAVILY_API_KEY ? 'tavily' : process.env.OPENROUTER_API_KEY ? 'openrouter' : 'none';
  const search = searchProvider !== 'none';
  return { ai, search, searchProvider, ready: ai && search };
}

function latestPendingBatch() {
  return catalogStore.listPending()
    .filter((batch) => batch?.kind === 'enrichment')
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
}

/**
 * Um lote criado sob outra versão do padrão descreve um catálogo que não existe
 * mais: seus alvos, lacunas e impressões digitais vêm de regras anteriores, e
 * retomá-lo apenas reproduz a falha original. Como um lote pendente bloqueia a
 * criação de outro, ele precisa ser reconhecido como obsoleto em vez de
 * sobreviver indefinidamente.
 */
function isCurrentBatch(batch) {
  return Boolean(batch)
    && Number(batch.qualityVersion) === CATALOG_QUALITY_VERSION
    && Number(batch.interactionVersion) === INTERACTION_VERSION;
}

export function getCatalogEnrichmentOverview({ provideCatalog = catalogProvider } = {}) {
  const catalog = provideCatalog();
  const audit = auditCatalogQuality(catalog);
  const pending = latestPendingBatch();
  return {
    audit: publicAudit(audit),
    quality: catalogQualityPublicContract(),
    capabilities: catalogEnrichmentCapabilities(),
    candidates: audit.categories.flatMap(({ category, results }) => results
      .filter((entry) => !entry.quality.pass)
      .map((entry) => {
        const target = createTarget(entry.record, category);
        return {
          key: target.key,
          name: target.name,
          category: target.category,
          missing: target.quality?.missing?.map((item) => item.label) || [],
        };
      })),
    pending: isCurrentBatch(pending) ? catalogEnrichmentBatchSummary(pending) : null,
  };
}

export function startCatalogEnrichment({ provideCatalog = catalogProvider, now = new Date(), targetKeys } = {}) {
  const existing = latestPendingBatch();
  if (isCurrentBatch(existing)) return catalogEnrichmentBatchSummary(existing);
  if (existing) catalogStore.deletePending(existing.batchId);
  if (!Array.isArray(targetKeys) || !targetKeys.length) throw new Error('enrichment_selection_required');
  const selected = [...new Set(targetKeys.map(String))];
  const batch = createCatalogEnrichmentBatch(provideCatalog(), now, selected);
  if (batch.targets.length !== selected.length) throw new Error('invalid_enrichment_selection');
  catalogStore.setPending(batch);
  return catalogEnrichmentBatchSummary(batch);
}

function fold(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function overlap(left, right) {
  const expected = new Set(fold(left).split(' ').filter((token) => token.length > 2));
  const actual = new Set(fold(right).split(' ').filter((token) => token.length > 2));
  if (!expected.size || !actual.size) return 0;
  return [...expected].filter((token) => actual.has(token)).length / expected.size;
}

async function fetchJson(url, options = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, { ...options, signal: options.signal || AbortSignal.timeout(15_000) });
  if (!response?.ok) throw new Error(`catalog_source_http_${response?.status || 0}`);
  return response.json();
}

function openAlexHeaders() {
  return { 'User-Agent': process.env.OPENALEX_MAILTO ? `senai-parceiros/1.0 (mailto:${process.env.OPENALEX_MAILTO})` : 'senai-parceiros/1.0 catalog-enrichment' };
}

function openAlexId(value) {
  return text(value).match(/A\d+/i)?.[0]?.toUpperCase() || '';
}

async function openAlexEvidence(record, fetchImpl, signal) {
  let author = null;
  const knownId = openAlexId(record.openalex_id);
  if (knownId) {
    author = await fetchJson(`https://api.openalex.org/authors/${knownId}`, { headers: openAlexHeaders(), signal }, fetchImpl);
  } else {
    const params = new URLSearchParams({ search: record.nome, per_page: '5', select: 'id,display_name,alternate_names,last_known_institutions,topics,summary_stats,cited_by_count' });
    if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
    const body = await fetchJson(`https://api.openalex.org/authors?${params}`, { headers: openAlexHeaders(), signal }, fetchImpl);
    const exact = (body.results || []).filter((candidate) => [candidate.display_name, ...(candidate.alternate_names || [])].some((name) => fold(name) === fold(record.nome)));
    author = exact.sort((left, right) => {
      const leftInstitution = (left.last_known_institutions || []).map((entry) => entry.display_name).join(' ');
      const rightInstitution = (right.last_known_institutions || []).map((entry) => entry.display_name).join(' ');
      return overlap(record.instituicao, rightInstitution) - overlap(record.instituicao, leftInstitution);
    })[0] || null;
  }
  const id = openAlexId(author?.id);
  if (!id) return null;
  const params = new URLSearchParams({
    filter: `authorships.author.id:${id}`,
    sort: 'cited_by_count:desc',
    per_page: '5',
    select: 'id,doi,title,display_name,publication_year,publication_date,cited_by_count,primary_location',
  });
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  const worksBody = await fetchJson(`https://api.openalex.org/works?${params}`, { headers: openAlexHeaders(), signal }, fetchImpl);
  const works = (worksBody.results || []).map((work) => ({
    titulo: text(work.display_name || work.title),
    url: safeUrl(work.doi || work.primary_location?.landing_page_url || work.id),
    ano: String(work.publication_year || text(work.publication_date).slice(0, 4)),
    citacoes: Number(work.cited_by_count || 0),
  })).filter((work) => work.titulo && work.url).slice(0, 5);
  return {
    id,
    profileUrl: `https://openalex.org/${id}`,
    institution: author.last_known_institutions?.[0]?.display_name || '',
    topics: (author.topics || []).slice(0, 5).map((topic) => topic.display_name).filter(Boolean),
    hIndex: author.summary_stats?.h_index ?? '',
    citations: author.cited_by_count ?? '',
    works,
  };
}

function evidenceQuery(record, category) {
  const identity = [record.nome || record.instituicao, record.instituicao, record.pais].filter(Boolean).map((value) => `"${text(value)}"`).join(' ');
  if (category === 'person') return `${identity} perfil profissional publicações projetos biografia`;
  if (record.subtipo === ORGANIZATION_SUBTYPES[0]) return `${identity} educação profissional cursos indústria site oficial`;
  return `${identity} atuação programas parcerias indústria site oficial`;
}

export async function collectCatalogEvidence(target, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (!process.env.TAVILY_API_KEY && !process.env.OPENROUTER_API_KEY) throw new Error('catalog_search_not_configured');
  const sources = [];
  if (process.env.TAVILY_API_KEY) {
    const response = await fetchJson(`${String(process.env.TAVILY_API_URL || 'https://api.tavily.com').replace(/\/$/, '')}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: evidenceQuery(target.record, target.category),
        search_depth: process.env.TAVILY_SEARCH_DEPTH || 'advanced',
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
      }),
      signal,
    }, fetchImpl);
    sources.push(...(response.results || []).map((result) => ({
      title: text(result.title).slice(0, 240),
      url: safeUrl(result.url),
      content: text(result.content || result.raw_content).slice(0, 700),
    })).filter((source) => source.url && source.content));
  }
  const existing = catalogPublicUrls(target.record).map((url) => ({ title: 'Link já registrado no card', url, content: 'Fonte pública já associada ao perfil.' }));
  let openAlex = null;
  if (target.researchProfile) {
    try { openAlex = await openAlexEvidence(target.record, fetchImpl, signal); } catch (error) {
      if (signal?.aborted) throw error;
      openAlex = null;
    }
  }
  if (openAlex) {
    sources.push({
      title: 'Perfil OpenAlex verificado',
      url: openAlex.profileUrl,
      content: `Instituição: ${openAlex.institution || 'não informada'}. Tópicos: ${openAlex.topics.join('; ')}. h-index: ${openAlex.hIndex || 'não informado'}.`,
    });
    openAlex.works.forEach((work) => sources.push({ title: work.titulo, url: work.url, content: `Publicação de ${work.ano || 'ano não informado'}; ${work.citacoes} citações no OpenAlex.` }));
  }
  return { sources: normalizeSources([...existing, ...sources]), openAlex };
}

const string = { type: 'string' };
const strings = { type: 'array', items: string };

function generatedItemSchema(category, researchProfile) {
  const common = {
    targetKey: string,
    subtipo: { type: 'string', enum: category === 'person' ? PERSON_SUBTYPES : ORGANIZATION_SUBTYPES },
    pais: string,
    descricao: { type: 'string', minLength: 400 },
    resumo: string,
    areas: strings,
    website: string,
    fontes: strings,
    evidencias_publicas: strings,
    dados_nao_localizados: strings,
  };
  const specific = category === 'person' ? {
    instituicao: string,
    cargo: string,
    perfis_atuacao: strings,
    perfil_principal_url: string,
    linkedin_url: string,
    scholar: string,
    h_index: string,
    orcid: string,
    openalex_id: string,
    citacoes: string,
    artigos: {
      type: 'array',
      minItems: researchProfile ? 5 : 0,
      items: { type: 'object', additionalProperties: false, required: ['titulo', 'url', 'ano'], properties: { titulo: string, url: string, ano: string } },
    },
  } : {
    natureza: string,
    setor: string,
    atuacao: string,
    relacao: string,
    programas_relevantes: strings,
    parcerias_industriais: strings,
    alcance_geografico: string,
    tipo_instituicao: string,
    niveis_oferta: strings,
    relacao_industria: string,
    escala: string,
    acreditacoes: strings,
  };
  const properties = { ...common, ...specific };
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

function generationSchema(category, researchProfile, size) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: { items: { type: 'array', minItems: size, maxItems: size, items: generatedItemSchema(category, researchProfile) } },
  };
}

function generationMessages(targets, evidence, hostedWebSearch = false) {
  const category = targets[0].category;
  const payload = targets.map((target, index) => ({
    targetKey: target.key,
    categoria: target.category,
    lacunas: target.quality.missing.map((item) => item.label),
    cardAtual: target.record,
    fontesDisponiveis: evidence[index].sources,
    openAlex: evidence[index].openAlex,
  }));
  return [
    {
      role: 'system',
      content: [
        'Você enriquece fichas do catálogo de parcerias do SENAI-SP usando somente os fatos das fontes fornecidas.',
        'Escreva em português do Brasil. Preserve todo dado atual que já esteja correto e complete apenas lacunas.',
        'A descrição deve ter pelo menos 400 caracteres, ser factual e específica. Nunca aumente texto com frases genéricas.',
        'Toda URL devolvida precisa ser exatamente uma URL recebida em cardAtual, fontesDisponiveis ou openAlex. Não invente nem altere URLs.',
        hostedWebSearch
          ? 'Use a pesquisa web hospedada para cada targetKey. Em fontes, website, perfis e artigos, devolva apenas URLs que apareçam nas citações da própria pesquisa.'
          : '',
        category === 'person'
          ? 'Para perfil de pesquisa, artigos são os cinco trabalhos com maior número de citações dentre as evidências OpenAlex e devem usar links diretos, nunca uma busca do Google Scholar.'
          : 'Preencha os campos centrais da categoria somente quando a evidência sustentar o conteúdo; registre o que não foi localizado.',
      ].filter(Boolean).join(' '),
    },
    { role: 'user', content: JSON.stringify(payload) },
  ];
}

function allowedGeneratedUrl(value, allowed) {
  const normalized = safeUrl(value);
  return normalized && allowed.has(normalized) ? normalized : '';
}

function prefer(current, generated) {
  return useful(current) ? current : generated;
}

function longer(current, generated) {
  return text(generated).length > text(current).length ? text(generated) : current;
}

function mergeArticles(current, generated, allowed) {
  const result = [];
  const seen = new Set();
  const append = (article, requireEvidence) => {
    const url = requireEvidence ? allowedGeneratedUrl(article?.url, allowed) : safeUrl(article?.url);
    const title = text(article?.titulo || article?.title);
    const key = (url || title).toLowerCase();
    if (!key || seen.has(key) || !title || !url) return;
    seen.add(key);
    result.push({ ...article, titulo: title, url, ano: article?.ano || article?.publication_year || '' });
  };
  (Array.isArray(current) ? current : []).forEach((article) => append(article, false));
  (Array.isArray(generated) ? generated : []).forEach((article) => append(article, true));
  return result;
}

export function mergeCatalogEnrichment(target, generated, evidence, now = new Date()) {
  const current = target.record;
  const allowed = new Set([...catalogPublicUrls(current), ...evidence.sources.map((source) => source.url), ...(evidence.openAlex?.works || []).map((work) => work.url), evidence.openAlex?.profileUrl].map(safeUrl).filter(Boolean));
  const generatedSources = (generated.fontes || []).map((url) => allowedGeneratedUrl(url, allowed)).filter(Boolean);
  const merged = {
    ...current,
    subtipo: normalizeCatalogSubtype(target.category, current.subtipo)
      || normalizeCatalogSubtype(target.category, generated.subtipo),
    pais: prefer(current.pais, generated.pais),
    descricao: longer(current.descricao, generated.descricao),
    website: prefer(current.website || current.website_oficial, allowedGeneratedUrl(generated.website, allowed)),
    website_oficial: prefer(current.website_oficial || current.website, allowedGeneratedUrl(generated.website, allowed)),
    areas: unique([current.areas, current.areas_formacao, generated.areas, evidence.openAlex?.topics || []]),
    fontes: unique([current.fontes || [], generatedSources]),
    evidencias_publicas: unique([current.evidencias_publicas || [], generated.evidencias_publicas || []]),
    dados_nao_localizados: unique([current.dados_nao_localizados || [], generated.dados_nao_localizados || []]),
    data_consulta: now.toISOString().slice(0, 10),
  };
  if (target.category === 'person') {
    const openAlex = evidence.openAlex || {};
    const openAlexArticles = (openAlex.works || []).map((work) => ({ titulo: work.titulo, url: work.url, ano: work.ano }));
    merged.pesquisa = longer(current.pesquisa || current.descricao, generated.descricao);
    merged.miniBio = longer(current.miniBio, generated.resumo);
    merged.instituicao = prefer(current.instituicao, generated.instituicao || openAlex.institution);
    merged.cargo = prefer(current.cargo, generated.cargo);
    merged.perfis_atuacao = unique([current.perfis_atuacao || [], generated.perfis_atuacao || [], target.researchProfile ? ['pesquisa'] : []]);
    merged.perfil_principal_url = prefer(current.perfil_principal_url, allowedGeneratedUrl(generated.perfil_principal_url, allowed) || openAlex.profileUrl);
    merged.linkedin_url = prefer(current.linkedin_url, allowedGeneratedUrl(generated.linkedin_url, allowed));
    merged.scholar = prefer(current.scholar, allowedGeneratedUrl(generated.scholar, allowed));
    merged.h_index = prefer(current.h_index, generated.h_index || openAlex.hIndex);
    merged.orcid = prefer(current.orcid, generated.orcid);
    merged.openalex_id = prefer(current.openalex_id, generated.openalex_id || openAlex.id);
    merged.citacoes = prefer(current.citacoes, generated.citacoes || openAlex.citations);
    merged.artigos = mergeArticles(current.artigos, [...(generated.artigos || []), ...openAlexArticles], allowed);
  } else {
    merged.diferencial = longer(current.diferencial, generated.resumo);
    merged.natureza = prefer(current.natureza, generated.natureza);
    merged.natureza_juridica = prefer(current.natureza_juridica, generated.natureza);
    merged.setor = prefer(current.setor, generated.setor);
    merged.atuacao = prefer(current.atuacao, generated.atuacao);
    merged.relacao = prefer(current.relacao, generated.relacao);
    merged.relacao_publica = prefer(current.relacao_publica, generated.relacao);
    merged.programas_relevantes = unique([current.programas_relevantes || [], generated.programas_relevantes || []]);
    merged.parcerias_industriais = unique([current.parcerias_industriais || [], generated.parcerias_industriais || []]);
    merged.alcance_geografico = prefer(current.alcance_geografico, generated.alcance_geografico);
    if (merged.subtipo === ORGANIZATION_SUBTYPES[0]) {
      merged.instituicao = current.instituicao || current.nome;
      merged.relevancia = longer(current.relevancia || current.diferencial, generated.resumo);
      merged.tipo_instituicao = prefer(current.tipo_instituicao, generated.tipo_instituicao);
      merged.areas_formacao = unique([current.areas_formacao || [], merged.areas]);
      merged.niveis_oferta = unique([current.niveis_oferta || [], generated.niveis_oferta || []]);
      merged.relacao_industria = prefer(current.relacao_industria, generated.relacao_industria);
      merged.escala = prefer(current.escala, generated.escala);
      merged.acreditacoes = unique([current.acreditacoes || [], generated.acreditacoes || []]);
    }
  }
  return merged;
}

function selectedTargets(batch) {
  const first = (batch.targets || []).find((target) => target.status === 'pending');
  if (!first) return [];
  return batch.targets.filter((target) => target.status === 'pending' && target.category === first.category && target.researchProfile === first.researchProfile).slice(0, BATCH_SIZE);
}

function errorCode(error) {
  return String(error?.message || 'catalog_enrichment_failed').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
}

function recordSelectedTargetError(batch, selected, error) {
  for (const selectedTarget of selected) {
    const target = batch.targets.find((entry) => entry.key === selectedTarget.key);
    if (!target) continue;
    target.attempts += 1;
    target.status = target.attempts < MAX_ATTEMPTS ? 'pending' : 'failed';
    target.error = errorCode(error);
    target.result = null;
  }
  catalogStore.setPending(batch);
  return catalogEnrichmentBatchSummary(batch);
}

function isRecoverableTargetError(error) {
  return new Set([
    'provider_5xx',
    'provider_invalid_response',
    'output_truncated',
    'empty_output',
    'invalid_output',
  ]).has(errorCode(error));
}

function evidenceWithHostedCitations(evidence, generated, citations) {
  const generatedUrls = new Set([
    ...(Array.isArray(generated?.fontes) ? generated.fontes : []),
    generated?.website,
    generated?.perfil_principal_url,
    generated?.linkedin_url,
    generated?.scholar,
    ...(Array.isArray(generated?.artigos) ? generated.artigos.map((article) => article?.url) : []),
  ].map(safeUrl).filter(Boolean));
  const matched = (Array.isArray(citations) ? citations : []).filter((source) => generatedUrls.has(safeUrl(source?.url)));
  return { ...evidence, sources: normalizeSources([...(evidence?.sources || []), ...matched]) };
}

export async function processCatalogEnrichment(batchId, {
  searchEvidence = collectCatalogEvidence,
  generate = generateStructured,
  enforceBudget = true,
  now = new Date(),
  timeoutMs = PROCESS_TIMEOUT_MS,
} = {}) {
  const batch = catalogStore.getPending(batchId);
  if (!batch || batch.kind !== 'enrichment') throw new Error('enrichment_batch_not_found');
  const targets = selectedTargets(batch);
  if (!targets.length) return catalogEnrichmentBatchSummary(batch);
  if (enforceBudget && !canUseAi('catalog-enrichment')) throw new Error('budget_exceeded');
  const usesConfiguredSearch = searchEvidence === collectCatalogEvidence;
  const hostedWebSearch = usesConfiguredSearch && !process.env.TAVILY_API_KEY && Boolean(process.env.OPENROUTER_API_KEY);
  if (usesConfiguredSearch && !process.env.TAVILY_API_KEY && !hostedWebSearch) throw new Error('catalog_search_not_configured');
  const requestedTimeout = Number(timeoutMs);
  const signal = AbortSignal.timeout(Number.isFinite(requestedTimeout)
    ? Math.max(1, Math.min(PROCESS_TIMEOUT_MS, Math.round(requestedTimeout)))
    : PROCESS_TIMEOUT_MS);
  let evidence;
  let generated;
  try {
    evidence = await Promise.all(targets.map((target) => searchEvidence(target, { signal })));
    generated = await generate({
      task: `catalog_enrichment_${targets[0].category}`,
      schema: generationSchema(targets[0].category, targets[0].researchProfile, targets.length),
      messages: generationMessages(targets, evidence, hostedWebSearch),
      model: hostedWebSearch ? (process.env.CATALOG_ENRICHMENT_MODEL || 'openai/gpt-4.1-mini') : undefined,
      // O modelo está fixado e o schema continua estrito. O pré-filtro do
      // roteador, porém, rejeita a combinação com a ferramenta hospedada antes
      // de encaminhá-la a endpoints que declaram suporte aos parâmetros.
      requireParameters: !hostedWebSearch,
      maxOutputTokens: hostedWebSearch ? 2600 : 4000,
      temperature: 0.1,
      costQualityTradeoff: 8,
      webSearch: hostedWebSearch ? { engine: 'native', maxResults: 5, maxTotalResults: 8, searchContextSize: 'medium' } : undefined,
      signal,
    });
  } catch (error) {
    if (signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      if (enforceBudget) await recordAiUsageAtomic('catalog-enrichment', null);
      return recordSelectedTargetError(batch, targets, new Error('provider_timeout'));
    }
    if (isRecoverableTargetError(error)) {
      if (enforceBudget) await recordAiUsageAtomic('catalog-enrichment', null);
      return recordSelectedTargetError(batch, targets, error);
    }
    throw error;
  }
  if (enforceBudget) await recordAiUsageAtomic('catalog-enrichment', generated.trace?.usage || null, generated.trace?.model);
  const items = new Map((generated.data?.items || []).map((item) => [item.targetKey, item]));
  for (let index = 0; index < targets.length; index += 1) {
    const target = batch.targets.find((entry) => entry.key === targets[index].key);
    target.attempts += 1;
    try {
      const item = items.get(target.key);
      if (!item) throw new Error('enrichment_item_missing');
      const verifiedEvidence = hostedWebSearch
        ? evidenceWithHostedCitations(evidence[index], item, generated.trace?.webSearchSources)
        : evidence[index];
      const merged = mergeCatalogEnrichment(target, item, verifiedEvidence, now);
      const quality = auditCatalogRecord(merged, target.category);
      target.quality = quality;
      target.result = quality.pass ? merged : null;
      target.status = quality.pass ? 'passed' : (target.attempts < MAX_ATTEMPTS ? 'pending' : 'failed');
      target.error = quality.pass ? '' : 'quality_gate_failed';
    } catch (error) {
      target.status = target.attempts < MAX_ATTEMPTS ? 'pending' : 'failed';
      target.error = errorCode(error);
      target.result = null;
    }
  }
  catalogStore.setPending(batch);
  return catalogEnrichmentBatchSummary(batch);
}

export function retryCatalogEnrichment(batchId) {
  const batch = catalogStore.getPending(batchId);
  if (!batch || batch.kind !== 'enrichment') throw new Error('enrichment_batch_not_found');
  for (const target of batch.targets || []) {
    if (target.status !== 'failed') continue;
    target.status = 'pending';
    target.attempts = 0;
    target.error = '';
    target.result = null;
  }
  catalogStore.setPending(batch);
  return catalogEnrichmentBatchSummary(batch);
}

export function skipCatalogEnrichmentTarget(batchId, targetKey) {
  const batch = catalogStore.getPending(batchId);
  if (!batch || batch.kind !== 'enrichment') throw new Error('enrichment_batch_not_found');
  const current = (batch.targets || []).find((target) => target.status === 'pending');
  if (!current || current.key !== String(targetKey || '')) throw new Error('enrichment_target_not_current');
  current.status = 'skipped';
  current.result = null;
  current.error = '';
  const summary = catalogEnrichmentBatchSummary(batch);
  const actionable = (batch.targets || []).some((target) => ['pending', 'passed', 'failed'].includes(target.status));
  if (actionable) catalogStore.setPending(batch);
  else catalogStore.deletePending(batchId);
  return summary;
}

function findCurrentTarget(catalog, target) {
  return (catalog[target.category] || []).find((record) => String(record.id) === target.lookupId);
}

function upsert(records, record) {
  const next = [...records];
  const index = next.findIndex((candidate) => String(candidate.id) === String(record.id));
  if (index < 0) next.push(record);
  else next[index] = record;
  return { records: next, action: index < 0 ? 'created' : 'updated' };
}

export function commitCatalogEnrichment(batchId, { provideCatalog = catalogProvider, now = new Date() } = {}) {
  const batch = catalogStore.getPending(batchId);
  if (!batch || batch.kind !== 'enrichment') throw new Error('enrichment_batch_not_found');
  const ready = (batch.targets || []).filter((target) => target.status === 'passed');
  if (!ready.length) throw new Error('enrichment_batch_incomplete');
  const currentCatalog = provideCatalog();
  const drift = ready.filter((target) => {
    const current = findCurrentTarget(currentCatalog, target);
    return !current || fingerprint(storageRecord(current, target.category)) !== target.sourceFingerprint;
  });
  if (drift.length) throw new Error('enrichment_source_changed');

  const beforeByCategory = Object.fromEntries(CATEGORIES.map((category) => [category, catalogStore.snapshot(category)]));
  const nextByCategory = Object.fromEntries(CATEGORIES.map((category) => [category, beforeByCategory[category].records]));
  const applied = [];
  const appliedRecords = [];
  const committedAt = now.toISOString();
  for (const target of ready) {
    const recordHash = fingerprint(target.result);
    const record = {
      ...target.result,
      id: target.storageId,
      enrichmentBatchId: batchId,
      enrichmentInputHash: target.sourceFingerprint,
      enrichmentRecordHash: recordHash,
      enrichedAt: committedAt,
      catalogQualityVersion: batch.qualityVersion,
    };
    const updated = upsert(nextByCategory[target.category], record);
    nextByCategory[target.category] = updated.records;
    applied.push({ category: target.category, id: record.id, action: updated.action, rowHash: recordHash });
    appliedRecords.push(record);
  }
  for (const category of CATEGORIES) catalogStore.replaceCategory(category, nextByCategory[category], beforeByCategory[category].rowHashes);

  // A conferência final vale sobre os cards que este commit gravou, lidos de
  // volta pelo catálogo derivado — é ali que uma gravação endereçada ao card
  // errado apareceria. Auditar o catálogo inteiro exigiria que nenhum outro
  // card estivesse fora do padrão, o que reprovaria toda gravação parcial e
  // desfaria trabalho já aprovado.
  const derived = provideCatalog();
  const rejected = ready.filter((target) => {
    const stored = findCurrentTarget(derived, target);
    return !stored || !auditCatalogRecord(stored, target.category).pass;
  });
  if (rejected.length) {
    for (const category of CATEGORIES) catalogStore.restore(category, beforeByCategory[category]);
    throw new Error('enrichment_commit_quality_failed');
  }

  const committedKeys = new Set(ready.map((target) => target.key));
  for (const target of batch.targets) {
    if (!committedKeys.has(target.key)) continue;
    target.status = 'committed';
    target.result = null;
  }
  const remaining = batch.targets.some((target) => ['pending', 'passed', 'failed'].includes(target.status));
  if (remaining) catalogStore.setPending(batch);
  else catalogStore.deletePending(batchId);

  // O desfazer continua sendo por lote, mesmo com o lote gravado aos poucos: o
  // estado anterior guardado é sempre o da primeira gravação, e as seguintes
  // apenas acrescentam as suas mudanças.
  const previous = catalogStore.getCommitted(batchId);
  const committed = {
    ...batch,
    beforeByCategory: previous?.beforeByCategory || beforeByCategory,
    applied: [...(previous?.applied || []), ...applied],
    appliedRecords: [...(previous?.appliedRecords || []), ...appliedRecords],
    committedAt,
    counts: counts(batch),
  };
  catalogStore.setCommitted(committed);
  return {
    ...catalogEnrichmentBatchSummary(batch),
    committedAt,
    applied,
    records: appliedRecords,
    audit: publicAudit(auditCatalogQuality(derived)),
  };
}

export function rollbackCatalogEnrichment(batch) {
  const applied = Array.isArray(batch?.applied) ? batch.applied.map((change) => ({
    ...change,
    category: normalizeCatalogRequest(change.category || batch.category).category,
  })) : [];
  const byCategory = new Map(CATEGORIES.map((category) => [category, catalogStore.snapshot(category)]));
  const conflicts = [];
  for (const change of applied) {
    const snapshot = byCategory.get(change.category);
    const current = snapshot?.records.find((record) => String(record.id) === String(change.id));
    if (!current || current.enrichmentBatchId !== batch.batchId || current.enrichmentRecordHash !== change.rowHash) {
      conflicts.push({ category: change.category, id: change.id, reason: 'record_changed_after_batch' });
    }
  }
  if (conflicts.length) {
    const error = new Error('rollback_conflict');
    error.conflicts = conflicts;
    throw error;
  }
  for (const change of applied) {
    const currentSnapshot = byCategory.get(change.category);
    const records = currentSnapshot.records;
    const index = records.findIndex((record) => String(record.id) === String(change.id));
    let previous;
    for (const [sourceCategory, beforeSnapshot] of Object.entries(batch.beforeByCategory || {})) {
      const request = normalizeCatalogRequest(sourceCategory);
      if (request.category !== change.category) continue;
      const found = (beforeSnapshot?.records || []).find((record) => String(record.id) === String(change.id));
      if (found) {
        previous = withCatalogClassification(request.subtype && !found.subtipo ? { ...found, subtipo: request.subtype } : found, request.category);
        break;
      }
    }
    if (previous && index >= 0) records[index] = previous;
    else if (previous) records.push(previous);
    else if (index >= 0) records.splice(index, 1);
  }
  for (const [category, snapshot] of byCategory) catalogStore.replaceCategory(category, snapshot.records, snapshot.rowHashes);
  catalogStore.deleteCommitted(batch.batchId);
  return { batchId: batch.batchId, rolledBack: true, restored: applied.length, kind: 'enrichment' };
}
