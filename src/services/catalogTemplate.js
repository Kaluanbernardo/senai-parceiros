import { CATALOG_METADATA_SHEET_NAME, CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, normalizeCatalogCategory, resolveCatalogColumns } from '../domain/catalogImportSchema';

/**
 * @param {string[]} [columns] mesmo recorte passado ao prompt. O template tem
 *   de trazer exatamente as colunas que o prompt pediu, senão o usuário recebe
 *   duas definições diferentes do mesmo arquivo.
 */
export async function buildCatalogTemplate(category, columns) {
  category = normalizeCatalogCategory(category);
  const exceljs = await import('exceljs');
  const Workbook = exceljs.Workbook || exceljs.default?.Workbook;
  if (!Workbook) throw new Error('ExcelJS indisponível.');
  const workbook = new Workbook();
  workbook.creator = 'SENAI-SP Farol de Parcerias';
  const sheet = workbook.addWorksheet(CATALOG_SHEET_NAME);
  const selected = resolveCatalogColumns(category, columns);
  const headers = selected.map((column) => column.name);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns = selected.map((column) => ({ header: column.name, width: Math.min(Math.max(column.name.length + 4, 16), 34) }));
  sheet.addRow(headers.map((header) => header === 'schema_version' ? CATALOG_SCHEMA_VERSION : header === 'tipo_registro' ? category : ''));
  const metadata = workbook.addWorksheet(CATALOG_METADATA_SHEET_NAME);
  metadata.addRows([
    ['Campo', 'Valor'],
    ['schema_version', CATALOG_SCHEMA_VERSION],
    ['categoria', category],
    ['instrução', 'Preencha apenas a aba Stakeholders. Use uma linha por entidade e informações públicas.'],
    ['listas', 'Separe itens por ponto e vírgula.'],
  ]);
  metadata.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  metadata.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
  metadata.columns = [{ width: 24 }, { width: 110 }];
  return workbook.xlsx.writeBuffer();
}

export function downloadTemplateBuffer(buffer, category) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `template-stakeholders-${category}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
