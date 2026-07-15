import { describe, expect, it } from 'vitest';
import { RICH_WORKSHEET_NAMES, sanitizeSpreadsheetValue, snapshotSelection } from './exportSelection';

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
    const snapshot = snapshotSelection(result, { category: 'researcher' });
    expect(snapshot.shortlist).toHaveLength(1);
    expect(snapshot.catalog).toHaveLength(2);
    expect(snapshot.answers.context).toBe('benchmarking');
    expect(RICH_WORKSHEET_NAMES).toHaveLength(9);
  });
});
