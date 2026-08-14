import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { getEssentialHeaders, CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME } from './catalogImportSchema.js';
import { buildCatalogTemplate } from '../services/catalogTemplate.js';
import { parseCatalogWorkbook, previewCatalogImport } from '../../server/lib/catalogImport.js';

/**
 * O ciclo que o gerador de prompt passa a permitir: recorte de colunas ->
 * template XLSX -> importação. Cada ponta é testada em separado; este teste
 * garante que elas continuam concordando entre si, que é onde um recorte
 * quebraria sem ninguém perceber.
 */
describe('recorte de colunas: template e importação concordam', () => {
  it('o template do recorte essencial é aceito pelo importador', async () => {
    for (const category of ['person', 'school', 'organization']) {
      const columns = getEssentialHeaders(category);
      const buffer = await buildCatalogTemplate(category, columns);

      // Preenche a linha de exemplo como um usuário faria.
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet(CATALOG_SHEET_NAME);
      const headers = sheet.getRow(1).values.slice(1).map(String);
      expect(headers).toEqual(columns);
      const row = sheet.getRow(2);
      headers.forEach((header, index) => {
        if (header === 'schema_version') row.getCell(index + 1).value = CATALOG_SCHEMA_VERSION;
        else if (header === 'tipo_registro') row.getCell(index + 1).value = category;
        else if (header === 'nome') row.getCell(index + 1).value = `Registro ${category}`;
        else if (header === 'pais') row.getCell(index + 1).value = 'Brasil';
        else if (/url|website|scholar/.test(header)) row.getCell(index + 1).value = 'https://example.org/registro';
        else row.getCell(index + 1).value = 'informação pública';
      });
      const filled = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');

      const parsed = await parseCatalogWorkbook({ filename: 'recorte.xlsx', contentBase64: filled });
      expect(parsed.errors, `categoria ${category}`).toEqual([]);
      expect(parsed.category).toBe(category);
      expect(previewCatalogImport(parsed, []).counts).toMatchObject({ total: 1, new: 1, invalid: 0 });
    }
  });
});
