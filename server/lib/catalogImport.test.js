import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, getCatalogHeaders } from '../../src/domain/catalogImportSchema.js';
import { commitCatalogImport, parseCatalogWorkbook, previewCatalogImport, rollbackCatalogImport } from './catalogImport.js';

async function workbookBase64(category, row) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
  sheet.addRow(getCatalogHeaders(category));
  sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

describe('catalog XLSX import', () => {
  it('round-trips a structured workbook through preview and commit', async () => {
    const category = 'organization';
    const headers = getCatalogHeaders(category);
    const values = Object.fromEntries(headers.map((header) => [header, '']));
    values.schema_version = CATALOG_SCHEMA_VERSION;
    values.tipo_registro = category;
    values.nome = 'Instituto de Teste XLSX';
    values.pais = 'Brasil';
    values.areas_temas = 'EPT; indústria 4.0';
    values.website_oficial = 'https://example.org/instituto-xlsx';
    const parsed = await parseCatalogWorkbook({ filename: 'pesquisa.xlsx', contentBase64: await workbookBase64(category, headers.map((header) => values[header])) });
    expect(parsed.errors).toEqual([]);
    const preview = previewCatalogImport(parsed, []);
    expect(preview.counts).toMatchObject({ total: 1, new: 1, invalid: 0 });
    const committed = commitCatalogImport(preview.batchId);
    expect(committed.applied).toHaveLength(1);
    expect(committed.applied[0].action).toBe('created');
    expect(rollbackCatalogImport(preview.batchId).rolledBack).toBe(true);
  });

  it('rejects a workbook with headers from another schema', async () => {
    const category = 'organization';
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
    sheet.addRow(['nome', 'pais']);
    sheet.addRow(['Inválido', 'Brasil']);
    const contentBase64 = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');
    await expect(parseCatalogWorkbook({ filename: 'invalido.xlsx', contentBase64, category })).rejects.toThrow('invalid_headers');
  });
});
