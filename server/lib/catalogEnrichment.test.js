import { afterEach, describe, expect, it } from 'vitest';
import {
  catalogEnrichmentBatchSummary,
  commitCatalogEnrichment,
  createCatalogEnrichmentBatch,
  mergeCatalogEnrichment,
  processCatalogEnrichment,
  rollbackCatalogEnrichment,
} from './catalogEnrichment.js';
import { catalogStore } from './catalogStore.js';

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
    expect(catalogEnrichmentBatchSummary(batch).counts).toEqual({ total: 1, pending: 1, passed: 0, failed: 0 });
  });

  it('uses a collision-safe overlay id for schools projected from organizations', () => {
    const school = {
      id: 'school:stakeholders:6', _source: 'stakeholders', _sourceId: 6,
      nome: 'Escola projetada', pais: 'Brasil', descricao: longDescription,
      subtipo: 'Instituição de ensino',
      relevancia: 'Formação profissional aplicada', website: 'https://example.org', areas: '',
      _original: { id: 6, nome: 'Escola projetada', categoria: 'Escola' },
    };

    const batch = createCatalogEnrichmentBatch({ organization: [school], person: [] });

    expect(batch.targets[0].storageId).toBe('organization-stakeholders-6');
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
    expect(catalogStore.getRecords('organization')[0]).toMatchObject({
      id: 'o-test',
      descricao: expect.stringContaining('Perfil factual'),
      enrichmentBatchId: batch.batchId,
    });

    const storedBatch = catalogStore.getCommitted(batch.batchId);
    expect(rollbackCatalogEnrichment(storedBatch)).toMatchObject({ rolledBack: true, restored: 1 });
    expect(catalogStore.getRecords('organization')).toEqual([expect.objectContaining(shallow)]);
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
