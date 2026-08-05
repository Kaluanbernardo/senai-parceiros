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
    values.relacao_publica = 'Parceria pública com a indústria';
    values.evidencias_publicas = 'Relatório institucional; https://example.org/evidencia';
    values.riscos_sinais = 'não localizado';
    values.website_oficial = 'https://example.org/instituto-xlsx';
    const parsed = await parseCatalogWorkbook({ filename: 'pesquisa.xlsx', contentBase64: await workbookBase64(category, headers.map((header) => values[header])) });
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].record).toMatchObject({
      relacao: 'Parceria pública com a indústria',
      evidencias_publicas: ['Relatório institucional', 'https://example.org/evidencia'],
      risco: 'não localizado',
    });
    const preview = previewCatalogImport(parsed, []);
    expect(preview.counts).toMatchObject({ total: 1, new: 1, invalid: 0 });
    const committed = commitCatalogImport(preview.batchId);
    expect(committed.applied).toHaveLength(1);
    expect(committed.applied[0].action).toBe('created');
    expect(rollbackCatalogImport(preview.batchId).rolledBack).toBe(true);
  });

  it('imports a workbook that carries only the columns the search needed', async () => {
    // O arquivo que o gerador de prompt passa a produzir quando o usuário pede
    // um recorte: seis colunas em vez das vinte e seis da categoria.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
    sheet.addRow(['schema_version', 'tipo_registro', 'nome', 'pais', 'resumo', 'website_oficial']);
    sheet.addRow([CATALOG_SCHEMA_VERSION, 'school', 'Centro de Formação Teste', 'Brasil', 'Rede pública de EPT.', 'https://example.org/centro']);
    const contentBase64 = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');

    const parsed = await parseCatalogWorkbook({ filename: 'recorte.xlsx', contentBase64 });

    expect(parsed.errors).toEqual([]);
    // A categoria vem de tipo_registro: só com colunas comuns o cabeçalho
    // serviria para as três.
    expect(parsed.category).toBe('school');
    expect(parsed.rows[0].record).toMatchObject({ nome: 'Centro de Formação Teste', pais: 'Brasil' });
    expect(previewCatalogImport(parsed, []).counts).toMatchObject({ total: 1, new: 1, invalid: 0 });
  });

  it('imports CSV directly using the same catalog contract', async () => {
    const csv = [
      'schema_version,tipo_registro,nome,pais,resumo,areas_temas,website_oficial',
      `${CATALOG_SCHEMA_VERSION},organization,Instituto CSV,Brasil,Organização de teste,EPT; indústria,https://example.org/csv`,
    ].join('\n');

    const parsed = await parseCatalogWorkbook({
      filename: 'pesquisa.csv',
      category: 'organization',
      contentBase64: Buffer.from(csv).toString('base64'),
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].record).toMatchObject({ nome: 'Instituto CSV', areas: ['EPT', 'indústria'] });
    expect(previewCatalogImport(parsed, []).counts.new).toBe(1);
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

  it('rolls back only its own rows and preserves a later independent batch', async () => {
    const category = 'organization';
    const headers = getCatalogHeaders(category);
    const makeContent = async (name) => {
      const values = Object.fromEntries(headers.map((header) => [header, '']));
      values.schema_version = CATALOG_SCHEMA_VERSION;
      values.tipo_registro = category;
      values.nome = name;
      values.pais = 'Brasil';
      return workbookBase64(category, headers.map((header) => values[header]));
    };
    const first = previewCatalogImport(await parseCatalogWorkbook({ filename: 'first.xlsx', contentBase64: await makeContent('Primeira') }), []);
    commitCatalogImport(first.batchId);
    const second = previewCatalogImport(await parseCatalogWorkbook({ filename: 'second.xlsx', contentBase64: await makeContent('Segunda') }), []);
    commitCatalogImport(second.batchId);
    expect(rollbackCatalogImport(first.batchId).rolledBack).toBe(true);
    expect(catalogStore.getRecords(category).map((record) => record.nome)).toEqual(['Segunda']);
  });

  it('blocks rollback when a later batch changed the same record', async () => {
    const category = 'organization';
    const headers = getCatalogHeaders(category);
    const values = Object.fromEntries(headers.map((header) => [header, '']));
    values.schema_version = CATALOG_SCHEMA_VERSION;
    values.tipo_registro = category;
    values.nome = 'Registro Mutável';
    values.pais = 'Brasil';
    const contentBase64 = await workbookBase64(category, headers.map((header) => values[header]));
    const first = previewCatalogImport(await parseCatalogWorkbook({ filename: 'first.xlsx', contentBase64 }), []);
    const firstCommit = commitCatalogImport(first.batchId);
    const updated = { ...values, descricao: 'Atualização posterior' };
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
    sheet.addRow(headers);
    sheet.addRow(headers.map((header) => updated[header] || ''));
    const second = previewCatalogImport(await parseCatalogWorkbook({ filename: 'second.xlsx', contentBase64: Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64') }), []);
    commitCatalogImport(second.batchId, { '2': 'merge' });
    expect(() => rollbackCatalogImport(firstCommit.batchId)).toThrow('rollback_conflict');
  });
});
