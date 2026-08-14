import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_RESEARCH_MAX_CANDIDATES,
  catalogResearchOutputSchema,
  normalizeCatalogResearchRequest,
  researchCatalogCandidates,
} from './catalogResearch.js';

function candidate(overrides = {}) {
  return {
    nome: 'Instituto Técnico Exemplo',
    subtipo: 'Instituição de ensino',
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
  it('keeps the MVP request bounded and category-aware', () => {
    expect(normalizeCatalogResearchRequest({ category: 'school', context: 'Formação dual', quantity: 2, subtype: 'Instituição de ensino' })).toMatchObject({
      category: 'organization', subtype: 'Instituição de ensino', context: 'Formação dual', quantity: 2, sourcePreferences: 'auto',
    });
    expect(normalizeCatalogResearchRequest({ category: 'person', context: 'IA industrial', quantity: 1, sourcePreferences: 'academic' })).toMatchObject({
      sourcePreferences: 'academic',
    });
    expect(() => normalizeCatalogResearchRequest({ category: 'school', context: 'x', quantity: CATALOG_RESEARCH_MAX_CANDIDATES + 1 })).toThrow('invalid_research_quantity');
    expect(() => normalizeCatalogResearchRequest({ category: 'other', context: 'x', quantity: 1 })).toThrow('invalid_research_category');
    expect(() => normalizeCatalogResearchRequest({ category: 'person', context: 'x', quantity: 1, sourcePreferences: 'qualquer site' })).toThrow('invalid_research_source_preference');
  });

  it('builds a strict output contract with only the selected category fields', () => {
    const schema = catalogResearchOutputSchema('organization', 2);
    const item = schema.properties.candidates.items;
    expect(schema.properties.candidates.maxItems).toBe(2);
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
      { category: 'organization', subtype: 'Instituição de ensino', context: 'Comparar aprendizagem industrial', quantity: 1, sourcePreferences: 'official' },
      { generate, now: () => new Date('2026-08-14T12:00:00Z') },
    );

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      task: 'catalog_research_organization',
      model: 'x-ai/grok-4.3',
      includeReasoning: false,
      strictOutput: true,
      webSearch: expect.objectContaining({ engine: 'native', maxResults: 3, maxTotalResults: 3, searchContextSize: 'low' }),
    }));
    expect(generate.mock.calls[0][0].messages[1].content).toContain('Não produza CSV');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('sites oficiais e fontes governamentais');
    expect(generate.mock.calls[0][0].messages[1].content).toContain('Subtipo desejado: Instituição de ensino');
    expect(result.parsed.metadata).toMatchObject({ origin: 'catalog_research', provider: 'openrouter', webSearchRequests: 2 });
    expect(result.parsed.rows[0]).toMatchObject({ valid: true, rowNumber: 1 });
    expect(result.parsed.rows[0].record.areas_formacao).toEqual(['mecatrônica', 'automação']);
    expect(result.parsed.rows[0].record.fontes).toHaveLength(3);
    expect(result.parsed.rows[0].row.data_consulta).toBe('2026-08-14');
  });

  it('keeps weakly sourced output visible but invalid for approval', async () => {
    const result = await researchCatalogCandidates(
      { category: 'organization', subtype: 'Instituição de ensino', context: 'Comparar aprendizagem industrial', quantity: 1 },
      {
        generate: async () => ({ data: { candidates: [candidate({ fontes: ['https://example.edu/'] })] }, trace: { provider: 'openrouter', model: 'test/model' } }),
        now: () => new Date('2026-08-14T12:00:00Z'),
      },
    );

    expect(result.parsed.rows[0].valid).toBe(false);
    expect(result.parsed.rows[0].errors.join(' ')).toMatch(/três fontes públicas/i);
  });
});
