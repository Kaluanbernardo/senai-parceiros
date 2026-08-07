import { describe, expect, it } from 'vitest';
import { CATALOG_SCHEMA_VERSION, LEGACY_CATALOG_SCHEMA_VERSION, getCatalogHeaders, getRequiredHeaders, rowToCanonical, validateCatalogHeaders, validateCatalogRow } from './catalogImportSchema';

describe('catalog import schema', () => {
  it('keeps category headers deterministic and validates the version/type', () => {
    const headers = getCatalogHeaders('researcher');
    expect(headers[0]).toBe('schema_version');
    expect(validateCatalogHeaders(headers, 'researcher').valid).toBe(true);
    const row = Object.fromEntries(headers.map((header) => [header, '']));
    row.schema_version = CATALOG_SCHEMA_VERSION;
    row.tipo_registro = 'researcher';
    row.nome = 'Pesquisador de teste';
    row.pais = 'Brasil';
    expect(validateCatalogRow(row, 'researcher').valid).toBe(true);
  });

  describe('cabeçalho parcial', () => {
    it('accepts a subset that keeps the required columns', () => {
      // O recorte que o gerador de prompt passa a permitir: seis colunas em vez
      // de vinte e seis. Antes era recusado por contagem.
      const subset = ['schema_version', 'tipo_registro', 'nome', 'pais', 'resumo', 'website_oficial'];
      const validation = validateCatalogHeaders(subset, 'researcher');

      expect(validation.valid).toBe(true);
      expect(validation.missing).toEqual([]);
    });

    it('does not care about column order', () => {
      const shuffled = ['nome', 'pais', 'tipo_registro', 'schema_version'];
      expect(validateCatalogHeaders(shuffled, 'school').valid).toBe(true);
    });

    it('refuses a subset that drops a required column', () => {
      const semNome = ['schema_version', 'tipo_registro', 'pais'];
      const validation = validateCatalogHeaders(semNome, 'researcher');

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('nome');
      expect(validation.errors.join(' ')).toMatch(/obrigatórias/);
    });

    it('refuses a column the category does not define', () => {
      const inventada = [...getRequiredHeaders('researcher'), 'foto_do_perfil'];
      const validation = validateCatalogHeaders(inventada, 'researcher');

      expect(validation.valid).toBe(false);
      expect(validation.unknown).toEqual(['foto_do_perfil']);
    });

    it('refuses a repeated column, which would make the row ambiguous', () => {
      const repetida = [...getRequiredHeaders('organization'), 'setor', 'setor'];
      expect(validateCatalogHeaders(repetida, 'organization').valid).toBe(false);
      expect(validateCatalogHeaders(repetida, 'organization').errors.join(' ')).toMatch(/repetidas/);
    });

    it('does not treat an absent optional column as an invalid value', () => {
      // `confianca` fora do recorte: undefined não pode reprovar a linha.
      const row = { schema_version: CATALOG_SCHEMA_VERSION, tipo_registro: 'researcher', nome: 'Especialista', pais: 'Brasil' };
      expect(validateCatalogRow(row, 'researcher').valid).toBe(true);
    });

    it('still rejects a confidence outside the range when the column is there', () => {
      const row = { schema_version: CATALOG_SCHEMA_VERSION, tipo_registro: 'researcher', nome: 'Especialista', pais: 'Brasil', confianca: '140' };
      expect(validateCatalogRow(row, 'researcher').valid).toBe(false);
    });
  });

  it('normalizes list fields and preserves the no-media contract', () => {
    const record = rowToCanonical({
      schema_version: CATALOG_SCHEMA_VERSION,
      tipo_registro: 'researcher',
      nome: 'Pesquisadora',
      pais: 'Brasil',
      instituicao_atual: 'Instituto',
      areas_temas: 'EPT; indústria',
      areas_especialidade: 'economia circular; indústria',
      relacao_publica: 'Parceria pública com indústria',
      evidencias_publicas: 'Relatório institucional; https://example.org/fato',
      riscos_sinais: 'Não localizado',
      publicacoes_relevantes: 'Título | https://doi.org/abc | 2026',
      google_scholar_url: 'https://scholar.google.com/citations?user=abc',
    });
    expect(record.areas).toEqual(['EPT', 'indústria', 'economia circular']);
    expect(record.artigos[0]).toMatchObject({ titulo: 'Título', url: 'https://doi.org/abc', ano: '2026' });
    expect(record.relacao).toContain('Parceria pública');
    expect(record.evidencias_publicas).toHaveLength(2);
    expect(record.risco).toBe('Não localizado');
    expect(record.foto).toBeUndefined();
    expect(record.image).toBeUndefined();
  });

  it('imports a non-academic professional without requiring academic fields', () => {
    const row = {
      schema_version: CATALOG_SCHEMA_VERSION,
      tipo_registro: 'person',
      nome: 'Profissional de teste',
      pais: 'Brasil',
      perfis_atuacao: 'indústria; imprensa',
      instituicao_atual: 'Veículo Teste',
      cargo: 'Jornalista',
      linkedin_url: 'https://www.linkedin.com/in/profissional-teste',
      producoes_relevantes: 'Reportagem | https://example.org/reportagem | 2026 | matéria',
    };
    expect(validateCatalogRow(row, 'person').valid).toBe(true);
    expect(rowToCanonical(row)).toMatchObject({
      perfis_atuacao: ['indústria', 'imprensa'],
      cargo: 'Jornalista',
      linkedin_url: row.linkedin_url,
      producoes_relevantes: [{ titulo: 'Reportagem', url: 'https://example.org/reportagem', ano: '2026', tipo: 'matéria' }],
    });
  });

  it('maps a legacy researcher row to a research person', () => {
    const row = { schema_version: LEGACY_CATALOG_SCHEMA_VERSION, tipo_registro: 'researcher', nome: 'Pesquisadora legada', pais: 'Brasil' };
    expect(validateCatalogRow(row, 'person').valid).toBe(true);
    expect(rowToCanonical(row).perfis_atuacao).toEqual(['pesquisa']);
  });
});
