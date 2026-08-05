import { describe, expect, it } from 'vitest';
import { COVERAGE_CONFIDENCE_THRESHOLD, deriveFieldCoverage, extractSignals, focusTermFor, isUnknownAnswer } from './answerSignals';

describe('answer signals', () => {
  it('reads several canonical fields out of a single free-text answer', () => {
    const coverage = deriveFieldCoverage(
      'Vamos fazer um evento sobre economia circular para instrutores e gestores em São Paulo, ainda este mês, sem orçamento para viagens.',
      { field: 'context' },
    );

    expect(Object.keys(coverage)).toEqual(expect.arrayContaining(['themes', 'audience', 'geography', 'timeframe', 'budget']));
    expect(Object.values(coverage).every((item) => item.confidence >= COVERAGE_CONFIDENCE_THRESHOLD)).toBe(true);
    expect(coverage.themes.evidence.join(' ')).toMatch(/circular/i);
  });

  it('never marks the field that was being asked as derived', () => {
    const coverage = deriveFieldCoverage('Instrutores e docentes da rede', { field: 'audience' });
    expect(coverage).not.toHaveProperty('audience');
  });

  it('recognizes inflected forms without matching unrelated words', () => {
    expect(extractSignals('convidamos instrutores').audiences.map((item) => item.id)).toContain('instructors');
    expect(extractSignals('empresas parceiras').audiences.map((item) => item.id)).toContain('industry');
    expect(extractSignals('compramos um acessório novo').contributions.map((item) => item.id)).not.toContain('network');
  });

  it('treats a bare uncertainty as unknown but keeps a qualified one', () => {
    expect(isUnknownAnswer('não sei ainda')).toBe(true);
    expect(isUnknownAnswer('   ')).toBe(true);
    expect(isUnknownAnswer('Não sei ainda, mas provavelmente algo sobre robótica industrial')).toBe(false);
    expect(deriveFieldCoverage('não sei ainda')).toEqual({});
  });

  it('quotes the user without the opening verbs and without internal labels', () => {
    expect(focusTermFor('Quero comparar gestão curricular e integração com empresas.')).toBe('gestão curricular e integração com empresas');
    expect(focusTermFor('Será um evento sobre economia circular.')).toBe('evento sobre economia circular');
    expect(focusTermFor('não sei')).toBe('');
    expect(focusTermFor('a'.repeat(200)).endsWith('…')).toBe(true);
  });
});
