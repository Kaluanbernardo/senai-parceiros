import { describe, expect, it } from 'vitest';
import { formatEntityAddedAt, hasEntityAddedAt } from './entityDate';

describe('entity date', () => {
  it('formats the stored addition date and supports normalized card records', () => {
    expect(formatEntityAddedAt({ _original: { adicionadoEm: '2026-08-07T12:00:00.000Z' } })).toMatch(/7 de ago\. de 2026/);
    expect(formatEntityAddedAt({})).toBe('Data não registrada');
  });

  it('reconhece quando não há data para exibir', () => {
    expect(hasEntityAddedAt({ adicionadoEm: '2026-08-07T12:00:00.000Z' })).toBe(true);
    expect(hasEntityAddedAt({ _original: { adicionadoEm: '2026-08-07T12:00:00.000Z' } })).toBe(true);
    expect(hasEntityAddedAt({})).toBe(false);
    expect(hasEntityAddedAt({ adicionadoEm: 'não localizado' })).toBe(false);
  });
});
