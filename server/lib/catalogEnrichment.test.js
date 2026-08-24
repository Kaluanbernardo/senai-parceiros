import { afterEach, describe, expect, it } from 'vitest';
import {
  catalogEnrichmentBatchSummary,
  catalogEnrichmentChanges,
  catalogEnrichmentCapabilities,
  commitCatalogEnrichment,
  createCatalogEnrichmentBatch,
  getCatalogEnrichmentOverview,
  mergeCatalogEnrichment,
  processCatalogEnrichment,
  rollbackCatalogEnrichment,
  skipCatalogEnrichmentTarget,
  startCatalogEnrichment,
} from './catalogEnrichment.js';
import { catalogStore } from './catalogStore.js';
import { getCatalog } from './catalog.js';

const longDescription = 'Perfil factual sustentado pelas fontes públicas fornecidas. '.repeat(11);

function completeOrganization(targetKey) {
  return {
    targetKey,
    subtipo: 'Instituto ou fundação',
    pais: 'Brasil',
    descricao: longDescription,
    resumo: 'Instituição com atuação técnica comprovada e cooperação pública com a indústria.',
    areas: ['Educação profissional'],
    website: 'https://example.org',
    fontes: ['https://example.org'],
    evidencias_publicas: ['Programa institucional publicado'],
    dados_nao_localizados: [],
    natureza: 'Terceiro setor',
    setor: 'Educação profissional',
    atuacao: 'Formação técnica aplicada',
    relacao: 'Cooperação pública com a indústria',
    programas_relevantes: ['Programa técnico'],
    parcerias_industriais: ['Rede industrial'],
    alcance_geografico: 'Brasil',
  };
}

function providerFromStore() {
  return {
    organization: catalogStore.getRecords('organization'),
    person: catalogStore.getRecords('person'),
  };
}

afterEach(() => catalogStore.configure({ driver: 'memory' }));

describe('catalog enrichment batches', () => {
  it('targets only cards below the measurable quality contract', () => {
    const complete = { ...completeOrganization('unused'), nome: 'Completa' };
    delete complete.targetKey;
    const shallow = { id: 'o-2', nome: 'Rasa', pais: 'Brasil' };

    const batch = createCatalogEnrichmentBatch({ organization: [complete, shallow], person: [] }, new Date('2026-08-14T12:00:00Z'));

    expect(batch.targets).toHaveLength(1);
    expect(batch.targets[0]).toMatchObject({ name: 'Rasa', category: 'organization', status: 'pending' });
    expect(catalogEnrichmentBatchSummary(batch)).toMatchObject({
      counts: { total: 1, pending: 1, passed: 0, failed: 0 },
      next: { name: 'Rasa', category: 'organization', attempt: 1, maxAttempts: 2 },
    });
  });

  it('grava a escola projetada pela mesma identidade com que o catálogo a lê', () => {
    const school = {
      id: 'school:stakeholders:6', _source: 'stakeholders', _sourceId: 6,
      nome: 'Escola projetada', pais: 'Brasil', descricao: longDescription,
      subtipo: 'Instituição de ensino',
      relevancia: 'Formação profissional aplicada', website: 'https://example.org', areas: '',
      _original: { id: 6, nome: 'Escola projetada', categoria: 'Escola' },
    };

    const batch = createCatalogEnrichmentBatch({ organization: [school], person: [] });

    expect(batch.targets[0].storageId).toBe('school:stakeholders:6');
    expect(batch.targets[0].storageId).toBe(batch.targets[0].lookupId);
  });

  it('nunca endereça a gravação a um card diferente do que foi auditado', () => {
    const organizations = getCatalog('organization');
    const batch = createCatalogEnrichmentBatch({ organization: organizations, person: getCatalog('person') });

    // Um id de gravação que pertence a outro registro sobrescreve uma
    // organização alheia; um id que não existe cria um órfão e deixa o card
    // auditado reprovado. Os dois casos já ocorreram no catálogo real.
    const collisions = batch.targets.filter((target) => {
      const holder = organizations.find((record) => String(record.id) === String(target.storageId));
      return holder && String(holder.id) !== String(target.lookupId);
    });

    expect(collisions.map((target) => target.name)).toEqual([]);
    expect(batch.targets.filter((target) => String(target.storageId) !== String(target.lookupId))).toEqual([]);
  });

  it('researches, validates and commits a complete batch before changing the catalog', async () => {
    const shallow = { id: 'o-test', nome: 'Instituto Teste', pais: 'Brasil' };
    catalogStore.replaceCategory('organization', [shallow], []);
    const batch = createCatalogEnrichmentBatch(providerFromStore(), new Date('2026-08-14T12:00:00Z'));
    catalogStore.setPending(batch);
    const searchEvidence = async () => ({
      sources: [{ title: 'Site institucional', url: 'https://example.org', content: 'Atuação técnica e parceria industrial.' }],
      openAlex: null,
    });
    const generate = async () => ({
      data: { items: [completeOrganization(batch.targets[0].key)] },
      trace: { usage: { total_tokens: 500 } },
    });

    const processed = await processCatalogEnrichment(batch.batchId, { searchEvidence, generate, enforceBudget: false, now: new Date('2026-08-14T12:10:00Z') });
    expect(processed.readyToCommit).toBe(true);
    expect(catalogStore.getRecords('organization')).toEqual([expect.objectContaining(shallow)]);

    const committed = commitCatalogEnrichment(batch.batchId, { provideCatalog: providerFromStore, now: new Date('2026-08-14T12:11:00Z') });
    expect(committed.audit.needsEnrichment).toBe(0);
    expect(committed.enriched).toEqual([expect.objectContaining({
      name: 'Instituto Teste',
      fields: expect.arrayContaining([
        expect.objectContaining({ field: 'descricao', before: '', after: expect.stringContaining('Perfil factual') }),
        expect.objectContaining({ field: 'website' }),
      ]),
    })]);
    expect(catalogStore.getRecords('organization')[0]).toMatchObject({
      id: 'o-test',
      descricao: expect.stringContaining('Perfil factual'),
      enrichmentBatchId: batch.batchId,
    });

    const storedBatch = catalogStore.getCommitted(batch.batchId);
    expect(rollbackCatalogEnrichment(storedBatch)).toMatchObject({ rolledBack: true, restored: 1 });
    expect(catalogStore.getRecords('organization')).toEqual([expect.objectContaining(shallow)]);
  });

  it('reports only effective public field changes', () => {
    expect(catalogEnrichmentChanges(
      { id: 'o-1', nome: 'Instituto', descricao: 'Curta', areas: ['EPT'], _source: 'fixture' },
      { id: 'o-1', nome: 'Instituto', descricao: 'Descrição ampliada', areas: ['EPT', 'Indústria'], enrichedAt: '2026-08-20' },
    )).toEqual([
      { field: 'areas', before: ['EPT'], after: ['EPT', 'Indústria'] },
      { field: 'descricao', before: 'Curta', after: 'Descrição ampliada' },
    ]);
  });

  it('grava os cards aprovados e mantém apenas os reprovados pendentes', async () => {
    const approved = { id: 'o-aprovado', nome: 'Instituto Aprovado', pais: 'Brasil' };
    const blocked = { id: 'o-bloqueado', nome: 'Instituto Sem Evidência', pais: 'Brasil' };
    catalogStore.replaceCategory('organization', [approved, blocked], []);
    const batch = createCatalogEnrichmentBatch(providerFromStore(), new Date('2026-08-18T12:00:00Z'));
    catalogStore.setPending(batch);
    const searchEvidence = async () => ({
      sources: [{ title: 'Site institucional', url: 'https://example.org', content: 'Atuação técnica.' }],
      openAlex: null,
    });
    // O primeiro card recebe um enriquecimento completo; o segundo volta sem a
    // evidência exigida e nunca chega a passar.
    const generate = async ({ messages }) => {
      const key = JSON.parse(messages[1].content)[0].targetKey;
      return key.includes('o-aprovado')
        ? { data: { items: [completeOrganization(key)] }, trace: {} }
        : { data: { items: [{ ...completeOrganization(key), descricao: 'curta', fontes: [], website: '' }] }, trace: {} };
    };

    let summary;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      summary = await processCatalogEnrichment(batch.batchId, { searchEvidence, generate, enforceBudget: false });
      if (summary.counts.passed > 0) {
        summary = commitCatalogEnrichment(batch.batchId, { provideCatalog: providerFromStore });
      }
    }

    expect(summary.counts).toMatchObject({ total: 2, committed: 1, failed: 1, pending: 0, passed: 0 });
    // O card aprovado virou catálogo mesmo com o outro bloqueado.
    expect(catalogStore.getRecords('organization').find((record) => record.id === 'o-aprovado')).toMatchObject({
      enrichmentBatchId: batch.batchId,
      descricao: expect.stringContaining('Perfil factual'),
    });
    expect(catalogStore.getRecords('organization').find((record) => record.id === 'o-bloqueado')).toEqual(expect.objectContaining(blocked));
    // O lote continua pendente para uma nova tentativa do card bloqueado.
    expect(catalogStore.getPending(batch.batchId)).not.toBeNull();
  });

  it('uses cited OpenRouter search when Tavily is unavailable', async () => {
    const previousOpenRouterKey = process.env.OPENROUTER_API_KEY;
    const previousTavilyKey = process.env.TAVILY_API_KEY;
    process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
    delete process.env.TAVILY_API_KEY;
    try {
      expect(catalogEnrichmentCapabilities()).toMatchObject({
        ai: true,
        search: true,
        searchProvider: 'openrouter',
        ready: true,
      });
      const shallow = { id: 'o-hosted-search', nome: 'Instituto com busca hospedada', pais: 'Brasil' };
      const batch = createCatalogEnrichmentBatch({ organization: [shallow], school: [], person: [] });
      catalogStore.setPending(batch);
      let generationRequest;
      const generate = async (request) => {
        generationRequest = request;
        return {
          data: { items: [completeOrganization(batch.targets[0].key)] },
          trace: {
            webSearchRequests: 1,
            webSearchSources: [{ title: 'Site institucional', url: 'https://example.org', content: 'Fonte pública citada.' }],
          },
        };
      };

      const processed = await processCatalogEnrichment(batch.batchId, { generate, enforceBudget: false });

      expect(generationRequest.model).toBe('openai/gpt-4.1-mini');
      expect(generationRequest.requireParameters).toBe(false);
      expect(generationRequest.webSearch).toEqual({ engine: 'native', maxResults: 5, maxTotalResults: 8, searchContextSize: 'medium' });
      expect(generationRequest.maxOutputTokens).toBe(2600);
      expect(generationRequest.messages[0].content).toContain('pesquisa web hospedada');
      expect(processed.readyToCommit).toBe(true);
    } finally {
      if (previousOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousOpenRouterKey;
      if (previousTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
      else process.env.TAVILY_API_KEY = previousTavilyKey;
    }
  });

  it('processes a single card per request and gives the provider an internal deadline', async () => {
    const records = [1, 2, 3].map((id) => ({ id: `o-timeout-${id}`, nome: `Instituto ${id}`, pais: 'Brasil' }));
    const batch = createCatalogEnrichmentBatch({ organization: records, school: [], person: [] });
    catalogStore.setPending(batch);
    let generationRequest;
    const searchEvidence = async () => ({
      sources: [{ title: 'Site institucional', url: 'https://example.org', content: 'Atuação técnica pública.' }],
      openAlex: null,
    });
    const generate = async (request) => {
      generationRequest = request;
      return {
        data: { items: [completeOrganization(batch.targets[0].key)] },
        trace: {},
      };
    };

    const processed = await processCatalogEnrichment(batch.batchId, { searchEvidence, generate, enforceBudget: false });
    const requestedTargets = JSON.parse(generationRequest.messages[1].content);

    expect(requestedTargets).toHaveLength(1);
    expect(generationRequest.signal).toBeInstanceOf(AbortSignal);
    expect(processed.counts).toMatchObject({ passed: 1, pending: 2 });
  });

  it('records provider deadlines per card and continues the batch after two attempts', async () => {
    const shallow = { id: 'o-provider-timeout', nome: 'Instituto demorado', pais: 'Brasil' };
    const batch = createCatalogEnrichmentBatch({ organization: [shallow], school: [], person: [] });
    catalogStore.setPending(batch);
    const searchEvidence = async () => ({ sources: [], openAlex: null });
    const generate = async ({ signal }) => new Promise((resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });

    const firstAttempt = await processCatalogEnrichment(batch.batchId, {
      searchEvidence,
      generate,
      enforceBudget: false,
      timeoutMs: 5,
    });
    expect(firstAttempt).toMatchObject({
      counts: { passed: 0, pending: 1, failed: 0 },
      next: { name: 'Instituto demorado', attempt: 2 },
    });

    const secondAttempt = await processCatalogEnrichment(batch.batchId, {
      searchEvidence,
      generate,
      enforceBudget: false,
      timeoutMs: 5,
    });
    expect(secondAttempt).toMatchObject({
      counts: { passed: 0, pending: 0, failed: 1 },
      next: null,
      failures: [{ name: 'Instituto demorado', error: 'provider_timeout' }],
    });
  });

  it('classifies runtimes that report abort only in the exception message as timeout', async () => {
    const shallow = { id: 'o-aborted-message', nome: 'Instituto interrompido', pais: 'Brasil' };
    const batch = createCatalogEnrichmentBatch({ organization: [shallow], school: [], person: [] });
    catalogStore.setPending(batch);

    const processed = await processCatalogEnrichment(batch.batchId, {
      searchEvidence: async () => ({ sources: [], openAlex: null }),
      generate: async () => { throw new Error('This operation was aborted'); },
      enforceBudget: false,
      timeoutMs: 5_000,
    });

    expect(processed.failures).toEqual([]);
    expect(processed.next).toMatchObject({ name: 'Instituto interrompido', attempt: 2 });
    expect(catalogStore.getPending(batch.batchId).targets[0].error).toBe('provider_timeout');
  });

  it('inicia somente com os cards escolhidos pela pessoa', () => {
    const first = { id: 'o-escolhido', nome: 'Instituto Escolhido', pais: 'Brasil' };
    const second = { id: 'o-nao-escolhido', nome: 'Instituto Não Escolhido', pais: 'Brasil' };
    catalogStore.replaceCategory('organization', [first, second], []);

    const summary = startCatalogEnrichment({
      provideCatalog: providerFromStore,
      targetKeys: ['organization:o-escolhido'],
      now: new Date('2026-08-20T12:00:00Z'),
    });

    expect(summary.counts).toMatchObject({ total: 1, pending: 1 });
    expect(summary.next).toMatchObject({ key: 'organization:o-escolhido', name: 'Instituto Escolhido' });
  });

  it('expõe apenas os dados necessários para a seleção inicial', () => {
    const shallow = { id: 'o-selecao', nome: 'Instituto para Seleção', pais: 'Brasil', _private: 'não expor' };
    const overview = getCatalogEnrichmentOverview({ provideCatalog: () => ({ organization: [shallow], person: [] }) });

    expect(overview.candidates).toEqual([
      expect.objectContaining({ key: 'organization:o-selecao', name: 'Instituto para Seleção', category: 'organization', missing: expect.any(Array) }),
    ]);
    expect(overview.candidates[0].record).toBeUndefined();
    expect(JSON.stringify(overview.candidates)).not.toContain('não expor');
  });

  it('recusa iniciar sem uma seleção explícita', () => {
    catalogStore.replaceCategory('organization', [{ id: 'o-1', nome: 'Instituto 1', pais: 'Brasil' }], []);

    expect(() => startCatalogEnrichment({ provideCatalog: providerFromStore, targetKeys: [] }))
      .toThrow('enrichment_selection_required');
  });

  it('não retoma um lote legado que foi criado sem seleção explícita', () => {
    const records = [1, 2].map((id) => ({ id: `o-legacy-${id}`, nome: `Instituto Legado ${id}`, pais: 'Brasil' }));
    catalogStore.replaceCategory('organization', records, []);
    const legacy = createCatalogEnrichmentBatch({ organization: records, person: [] });
    delete legacy.interactionVersion;
    catalogStore.setPending(legacy);

    const summary = startCatalogEnrichment({
      provideCatalog: providerFromStore,
      targetKeys: ['organization:o-legacy-2'],
    });

    expect(summary.batchId).not.toBe(legacy.batchId);
    expect(summary.counts).toMatchObject({ total: 1, pending: 1 });
    expect(summary.next.key).toBe('organization:o-legacy-2');
  });

  it('pula somente o card atual e apresenta o próximo sem enriquecê-lo', () => {
    const records = [1, 2].map((id) => ({ id: `o-skip-${id}`, nome: `Instituto ${id}`, pais: 'Brasil' }));
    catalogStore.replaceCategory('organization', records, []);
    const beforeSkip = catalogStore.getRecords('organization');
    const batch = createCatalogEnrichmentBatch({ organization: records, person: [] });
    catalogStore.setPending(batch);

    const skipped = skipCatalogEnrichmentTarget(batch.batchId, batch.targets[0].key);

    expect(skipped.counts).toMatchObject({ total: 2, skipped: 1, pending: 1 });
    expect(skipped.next).toMatchObject({ key: batch.targets[1].key, name: 'Instituto 2' });
    expect(catalogStore.getRecords('organization')).toEqual(beforeSkip);
    expect(() => skipCatalogEnrichmentTarget(batch.batchId, batch.targets[0].key))
      .toThrow('enrichment_target_not_current');
  });

  it('isola uma resposta JSON inválida do provedor no card atual', async () => {
    const shallow = { id: 'o-provider-json', nome: 'Instituto com resposta vazia', pais: 'Brasil' };
    const batch = createCatalogEnrichmentBatch({ organization: [shallow], person: [] });
    catalogStore.setPending(batch);
    const searchEvidence = async () => ({ sources: [], openAlex: null });
    const generate = async () => { throw new Error('provider_invalid_response'); };

    const firstAttempt = await processCatalogEnrichment(batch.batchId, {
      searchEvidence,
      generate,
      enforceBudget: false,
    });

    expect(firstAttempt).toMatchObject({
      counts: { passed: 0, pending: 1, failed: 0 },
      next: { name: 'Instituto com resposta vazia', attempt: 2 },
    });
  });

  it('keeps a generated card pending when the post-generation gate still fails', async () => {
    const shallow = { id: 'o-test', nome: 'Instituto Teste', pais: 'Brasil' };
    const batch = createCatalogEnrichmentBatch({ organization: [shallow], person: [] });
    catalogStore.setPending(batch);
    const searchEvidence = async () => ({ sources: [], openAlex: null });
    const generate = async () => ({ data: { items: [{ ...completeOrganization(batch.targets[0].key), website: '', fontes: [] }] }, trace: {} });

    const processed = await processCatalogEnrichment(batch.batchId, { searchEvidence, generate, enforceBudget: false });

    expect(processed.readyToCommit).toBe(false);
    expect(processed.counts).toMatchObject({ pending: 1, passed: 0 });
    expect(() => commitCatalogEnrichment(batch.batchId, { provideCatalog: () => ({ organization: [shallow], person: [] }) })).toThrow('enrichment_batch_incomplete');
  });

  it('drops publication URLs that were not present in the gathered evidence', () => {
    const target = {
      category: 'person', researchProfile: true,
      record: { nome: 'Pesquisadora', artigos: [{ titulo: 'Existente', url: 'https://doi.org/10.1/existing' }] },
    };
    const generated = {
      descricao: longDescription, resumo: 'Resumo', pais: 'Brasil', areas: ['EPT'], fontes: [], evidencias_publicas: [], dados_nao_localizados: [],
      instituicao: 'Universidade', cargo: 'Professora', perfis_atuacao: ['pesquisa'], perfil_principal_url: '', linkedin_url: '', scholar: '', h_index: '', orcid: '', openalex_id: '', citacoes: '',
      artigos: [{ titulo: 'Inventado', url: 'https://invented.example/paper', ano: '2026' }],
    };

    const merged = mergeCatalogEnrichment(target, generated, { sources: [], openAlex: null });

    expect(merged.artigos.map((article) => article.url)).toEqual(['https://doi.org/10.1/existing']);
  });

  it('rolls back enrichment batches created with the legacy school category', () => {
    const id = 'organization-escolas-1';
    catalogStore.replaceCategory('organization', [{
      id,
      instituicao: 'Escola Legada',
      nome: 'Escola Legada',
      subtipo: 'Instituição de ensino',
      descricao: 'Versão enriquecida',
      enrichmentBatchId: 'legacy-school-batch',
      enrichmentRecordHash: 'enriched-hash',
    }], []);
    const batch = {
      batchId: 'legacy-school-batch',
      category: 'school',
      applied: [{ category: 'school', id, rowHash: 'enriched-hash' }],
      beforeByCategory: {
        school: { records: [{ id, instituicao: 'Escola Legada', descricao: 'Versão anterior' }], rowHashes: [] },
      },
    };

    expect(rollbackCatalogEnrichment(batch)).toMatchObject({ rolledBack: true, restored: 1 });
    expect(catalogStore.getRecords('organization')).toEqual([expect.objectContaining({
      id,
      descricao: 'Versão anterior',
      categoria: 'Pessoa Jurídica',
      subtipo: 'Instituição de ensino',
    })]);
  });
});
