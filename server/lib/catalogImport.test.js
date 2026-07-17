import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, getCatalogHeaders } from '../../src/domain/catalogImportSchema.js';
import { commitCatalogImport, parseCatalogWorkbook, previewCatalogImport, rollbackCatalogImport } from './catalogImport.js';
import { catalogStore } from './catalogStore.js';

async function workbookBase64(category, row) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
  sheet.addRow(getCatalogHeaders(category));
  sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

describe('catalog XLSX import', () => {
  afterEach(() => catalogStore.configure({ driver: 'memory' }));
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

  it('is idempotent when the same file is previewed again after commit', async () => {
    const category = 'organization';
    const headers = getCatalogHeaders(category);
    const values = Object.fromEntries(headers.map((header) => [header, '']));
    values.schema_version = CATALOG_SCHEMA_VERSION;
    values.tipo_registro = category;
    values.nome = 'Organização Idempotente';
    values.pais = 'Brasil';
    const contentBase64 = await workbookBase64(category, headers.map((header) => values[header]));
    const parsed = await parseCatalogWorkbook({ filename: 'idempotente.xlsx', contentBase64 });
    const first = previewCatalogImport(parsed, []);
    commitCatalogImport(first.batchId);
    const second = previewCatalogImport(parsed, [{ id: 'o-imported', ...parsed.rows[0].record }]);
    expect(second.counts.alreadyImported).toBe(1);
    expect(commitCatalogImport(second.batchId).ignored[0].reason).toBe('idempotent_replay');
  });

  it('requires an explicit decision before replacing a seed match', async () => {
    const category = 'organization';
    const headers = getCatalogHeaders(category);
    const values = Object.fromEntries(headers.map((header) => [header, '']));
    values.schema_version = CATALOG_SCHEMA_VERSION;
    values.tipo_registro = category;
    values.nome = 'Instituição Seed';
    values.pais = 'Brasil';
    const parsed = await parseCatalogWorkbook({ filename: 'seed.xlsx', contentBase64: await workbookBase64(category, headers.map((header) => values[header])) });
    const preview = previewCatalogImport(parsed, [{ id: 42, nome: values.nome, pais: values.pais }]);
    expect(preview.rows[0].status).toBe('possible_duplicate');
    expect(commitCatalogImport(preview.batchId).ignored[0].reason).toBe('keep_existing');
  });

  it('can persist the catalog store through the file adapter', () => {
    const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'senai-catalog-')), 'store.json');
    catalogStore.configure({ driver: 'file', filePath });
    catalogStore.replaceCategory('organization', [{ id: 'o-1', nome: 'Persistido' }], ['row-hash']);
    catalogStore.configure({ driver: 'file', filePath });
    expect(catalogStore.getRecords('organization')).toEqual([{ id: 'o-1', nome: 'Persistido' }]);
    expect(catalogStore.hasRowHash('organization', 'row-hash')).toBe(true);
    catalogStore.configure({ driver: 'memory' });
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  });
});
