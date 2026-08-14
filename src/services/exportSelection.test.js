import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { exportSelection, RICH_WORKSHEET_NAMES, sanitizeSpreadsheetValue, snapshotSelection } from './exportSelection';

describe('exportSelection', () => {
  it('sanitizes formula-like spreadsheet values', () => {
    expect(sanitizeSpreadsheetValue('=HYPERLINK("http://evil")')).toBe("'=HYPERLINK(\"http://evil\")");
    expect(sanitizeSpreadsheetValue('normal')).toBe('normal');
  });

  it('captures shortlist, trace, answers and full catalog in a transient snapshot', () => {
    const result = {
      shortlist: [{ candidate: { id: 1, nome: 'Pessoa', instituicao: 'Instituto', website: 'https://example.org' }, total: 82, dimensions: { alignment: 80 } }],
      candidatePool: [{ id: 1, nome: 'Pessoa' }, { id: 2, nome: 'Outra pessoa' }],
      answers: { context: 'benchmarking' },
      trace: { provider: 'local-fallback' },
    };
    const snapshot = snapshotSelection(result, { category: 'Pessoa Física', subtype: 'Pesquisador(a) ou acadêmico(a)' });
    expect(snapshot.shortlist).toHaveLength(1);
    expect(snapshot.catalog).toHaveLength(2);
    expect(snapshot.answers.context).toBe('benchmarking');
    expect(snapshot.metadata.subtype).toBe('Pesquisador(a) ou acadêmico(a)');
    expect(RICH_WORKSHEET_NAMES).toHaveLength(9);
  });

  it('produces an XLSX that reopens with all nine audit worksheets', async () => {
    const result = {
      shortlist: [{
        candidate: { id: 1, nome: 'Pessoa', instituicao: 'Instituto', website: 'https://example.org' },
        total: 82,
        strategicValue: 84,
        viability: 79,
        dimensions: { impact: 80, alignment: 85, credibility: 82, collaboration: 78, feasibility: 76, risk: 90 },
        evidence: ['website'],
        gaps: [],
      }],
      candidatePool: [{ candidate: { id: 1, nome: 'Pessoa', instituicao: 'Instituto', website: 'https://example.org' }, total: 82 }],
      answers: { context: 'benchmarking' },
      trace: { provider: 'local-fallback', formula: 'valor estratégico × 0,58 + viabilidade × 0,42' },
    };

    const artifact = await exportSelection(result, 'xlsx', { category: 'Pessoa Jurídica', subtype: 'Instituição de ensino' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await artifact.blob.arrayBuffer());

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(RICH_WORKSHEET_NAMES);
    expect(workbook.getWorksheet('Shortlist').rowCount).toBeGreaterThan(1);
    expect(workbook.getWorksheet('Contexto').getColumn(1).values).toContain('Subtipo');
    expect(workbook.getWorksheet('Contexto').getColumn(2).values).toContain('Instituição de ensino');
    expect(artifact.filename).toMatch(/\.xlsx$/);
  });
});
