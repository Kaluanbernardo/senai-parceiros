import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_RESEARCH_BATCH_SIZE,
  CATALOG_RESEARCH_QUANTITIES,
  catalogResearchOutputSchema,
  normalizeCatalogResearchRequest,
  researchCatalogCandidates,
} from './catalogResearch.js';
import { getCatalogColumns } from '../../src/domain/catalogImportSchema.js';

function candidate(overrides = {}) {
  return {
    nome: 'Instituto Técnico Exemplo',
    pais: 'Brasil',
    cidade_estado: 'São Paulo, SP',
    resumo: 'Instituição de educação profissional com atuação pública documentada em formação técnica industrial e aprendizagem.',
    descricao: 'O Instituto Técnico Exemplo oferece programas públicos de formação profissional voltados à indústria, mantém cooperação com empresas e publica informações institucionais sobre cursos, escala e resultados. As fontes consultadas confirmam sua identidade, sua localização e a relação dos programas com necessidades de qualificação profissional e desenvolvimento produtivo regional.',
    areas_temas: ['educação profissional', 'manufatura', 'aprendizagem'],
    aderencia_contexto: 'Pode apoiar comparação de modelos de aprendizagem industrial.',
    relacao_publica: 'Atua com empresas industriais em programas publicados.',
    evidencias_publicas: ['Programa institucional | https://example.org/programa', 'Perfil público | https://example.edu/perfil'],
    riscos_sinais: [],
    website_oficial: 'https://example.edu/',
    contato_publico: '',
    fontes: ['https://example.edu/', 'https://example.org/programa', 'https://example.net/evidencia'],
    confianca: 86,
    dados_nao_localizados: [],
    tipo_instituicao: 'Instituto técnico',
    nivel_rede: 'regional',
    areas_formacao: ['mecatrônica', 'automação'],
    niveis_oferta: ['técnico'],
    relacao_industria: 'Conselho industrial e aprendizagem em empresas.',
    escala: 'Três unidades públicas.',
    acreditacoes: [],
    dominio_oficial: 'example.edu',
    identificador_publico: '',
    ...overrides,
  };
}

describe('catalog research module', () => {
  it('accepts only the deep-research quantities and closed geography options', () => {
    for (const quantity of CATALOG_RESEARCH_QUANTITIES) {
      expect(normalizeCatalogResearchRequest({ category: 'school', context: 'Formação dual', quantity, geography: 'brasil' })).toMatchObject({
        category: 'school', context: 'Formação dual', quantity, geography: 'brasil', batchSize: CATALOG_RESEARCH_BATCH_SIZE,
      });
    }
    expect(normalizeCatalogResearchRequest({
      category: 'person', context: 'IA industrial', quantity: 20, geography: 'internacional', sourcePreferences: 'academic',
      prioritizationFactors: 'experiência industrial', exclusionFactors: 'consultorias sem projetos públicos',
      batchIndex: 2, excludeCandidates: ['Pessoa já localizada'],
    })).toMatchObject({
      sourcePreferences: 'academic', geography: 'internacional', prioritizationFactors: 'experiência industrial',
      exclusionFactors: 'consultorias sem projetos públicos', batchIndex: 2, excludeCandidates: ['Pessoa já localizada'],
    });
    expect(() => normalizeCatalogResearchRequest({ category: 'school', context: 'x', quantity: 3, geography: 'brasil' })).toThrow('invalid_research_quantity');
    expect(() => normalizeCatalogResearchRequest({ category: 'other', context: 'x', quantity: 5, geography: 'brasil' })).toThrow('invalid_research_category');
    expect(() => normalizeCatalogResearchRequest({ category: 'person', context: 'x', quantity: 5, geography: 'mundo' })).toThrow('invalid_research_geography');
    expect(() => normalizeCatalogResearchRequest({ category: 'person', context: 'x', quantity: 5, geography: 'brasil', sourcePreferences: 'qualquer site' })).toThrow('invalid_research_source_preference');
  });

  it('builds a strict output contract with every importable field for the selected category', () => {
    const schema = catalogResearchOutputSchema('organization', CATALOG_RESEARCH_BATCH_SIZE);
    const item = schema.properties.candidates.items;
    const systemManaged = new Set(['schema_version', 'tipo_registro', 'data_consulta']);
    const expectedFields = getCatalogColumns('organization').map((column) => column.name).filter((name) => !systemManaged.has(name));
    expect(schema.properties.candidates.maxItems).toBe(CATALOG_RESEARCH_BATCH_SIZE);
    expect(item.required).toEqual(expectedFields);
    expect(item.required).toContain('programas_relevantes');
    expect(item.required).not.toContain('h_index');
    expect(item.additionalProperties).toBe(false);
  });

  it('turns researched JSON into the same canonical rows consumed by catalog preview', async () => {
    const generate = vi.fn(async (options) => ({
      data: { candidates: [candidate()] },
      trace: { provider: 'openrouter', model: 'test/model', usage: { total_tokens: 90 }, webSearchRequests: 2 },
    }));
    const result = await researchCatalogCandidates(
      {
        category: 'school', context: 'Comparar aprendizagem industrial', quantity: 20, geography: 'internacional', sourcePreferences: 'official',
        prioritizationFactors: 'programas com escala comprovada', exclusionFactors: 'instituições sem fonte oficial',
        batchIndex: 1, excludeCandidates: ['Instituto já encontrado'],
      },
      { generate, now: () => new Date('2026-08-14T12:00:00Z') },
    );

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      task: 'catalog_research_school_batch_2',
      model: 'openai/gpt-5.6-luna',
      strictOutput: true,
      requireParameters: false,
      maxOutputTokens: 16000,
      webSearch: expect.objectContaining({ engine: 'native', maxResults: 10, maxTotalResults: 20, searchContextSize: 'high' }),
    }));
    expect(generate.mock.calls[0][0].messages[1].content).toContain('Não produza CSV');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('sites oficiais e fontes governamentais');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('programas com escala comprovada');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('instituições sem fonte oficial');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('Instituto já encontrado');
    expect(result.parsed.metadata).toMatchObject({ origin: 'catalog_research', provider: 'openrouter', webSearchRequests: 2, batchIndex: 1, requestedQuantity: 20 });
    expect(result.parsed.rows[0]).toMatchObject({ valid: true, rowNumber: 1 });
    expect(result.parsed.rows[0].record.areas_formacao).toEqual(['mecatrônica', 'automação']);
    expect(result.parsed.rows[0].record.fontes).toHaveLength(3);
    expect(result.parsed.rows[0].row.data_consulta).toBe('2026-08-14');
  });

  it('keeps weakly sourced output visible but invalid for approval', async () => {
    const result = await researchCatalogCandidates(
      { category: 'school', context: 'Comparar aprendizagem industrial', quantity: 5, geography: 'brasil' },
      {
        generate: async () => ({ data: { candidates: [candidate({ fontes: ['https://example.edu/'] })] }, trace: { provider: 'openrouter', model: 'test/model' } }),
        now: () => new Date('2026-08-14T12:00:00Z'),
      },
    );

    expect(result.parsed.rows[0].valid).toBe(false);
    expect(result.parsed.rows[0].errors.join(' ')).toMatch(/três fontes públicas/i);
  });
});
