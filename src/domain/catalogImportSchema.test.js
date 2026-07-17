import { describe, expect, it } from 'vitest';
import { CATALOG_SCHEMA_VERSION, getCatalogHeaders, rowToCanonical, validateCatalogHeaders, validateCatalogRow } from './catalogImportSchema';

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

  it('normalizes list fields and preserves the no-media contract', () => {
    const record = rowToCanonical({
      schema_version: CATALOG_SCHEMA_VERSION,
      tipo_registro: 'researcher',
      nome: 'Pesquisadora',
      pais: 'Brasil',
      instituicao_atual: 'Instituto',
      areas_temas: 'EPT; indústria',
      publicacoes_relevantes: 'Título | https://doi.org/abc | 2026',
      google_scholar_url: 'https://scholar.google.com/citations?user=abc',
    });
    expect(record.areas).toEqual(['EPT', 'indústria']);
    expect(record.artigos[0]).toMatchObject({ titulo: 'Título', url: 'https://doi.org/abc', ano: '2026' });
    expect(record.foto).toBeUndefined();
    expect(record.image).toBeUndefined();
  });
});
