import { describe, expect, it } from 'vitest';
import { formatEntityAddedAt } from './entityDate';

describe('entity date', () => {
  it('formats the stored addition date and supports normalized card records', () => {
    expect(formatEntityAddedAt({ _original: { adicionadoEm: '2026-08-07T12:00:00.000Z' } })).toMatch(/7 de ago\. de 2026/);
    expect(formatEntityAddedAt({})).toBe('Data não registrada');
  });
});
