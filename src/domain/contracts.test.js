import { describe, expect, it } from 'vitest';
import { createSelectionBrief, validateInterviewQuestion, validateInterviewState, validateRadarItem, validateSelectionBrief, validateSelectionResult } from './contracts';

describe('domain contracts', () => {
  it('normalizes a transient selection brief and validates its required context', () => {
    const brief = createSelectionBrief({ category: 'researcher', objective: 'speaker', answers: { context: 'IA na indústria' } });
    expect(brief.context).toBe('IA na indústria');
    expect(validateSelectionBrief(brief)).toEqual({ valid: true, errors: [] });
    expect(validateSelectionBrief({ ...brief, context: '' }).valid).toBe(false);
  });

  it('keeps the selection contract compatible with the current MVP while reserving the 5–10 policy', () => {
    expect(validateSelectionResult({ shortlist: [], candidatePool: [], trace: {} }).valid).toBe(true);
    expect(validateSelectionResult({ shortlist: new Array(11).fill({}), candidatePool: [], trace: {} }).valid).toBe(false);
  });

  it('validates radar provenance fields', () => {
    const valid = validateRadarItem({ section: 'government', title: 'Atualização', sourceName: 'MEC', sourceUrl: 'https://www.gov.br/mec', publishedAt: null, provider: 'feed', externalId: 'mec-1', provenance: { source: 'mec' }, status: 'published', contentHash: 'abc123' });
    expect(valid).toEqual({ valid: true, errors: [] });
    expect(validateRadarItem({ section: 'unknown', title: '', sourceName: '' }).valid).toBe(false);
    expect(validateRadarItem({ section: 'government', title: 'x', sourceName: 'MEC', sourceUrl: 'https://www.gov.br', publishedAt: '2026-99-99', provider: 'feed', externalId: 'x', provenance: {}, status: 'published', contentHash: 'x' }).valid).toBe(false);
  });

  it('validates transient adaptive interview contracts and their limits', () => {
    const question = { id: 'context', prompt: 'Qual é o contexto?', helper: 'Uma frase basta.', example: 'Ex.: benchmarking de formação dual.', reasonTag: 'estabelecer_contexto', kind: 'textarea', dimensions: ['impact', 'alignment'] };
    const state = { category: 'school', objective: 'benchmark', answers: {}, askedIds: ['context'], currentQuestion: question, status: 'active' };
    expect(validateInterviewQuestion(question)).toEqual({ valid: true, errors: [] });
    expect(validateInterviewState(state)).toEqual({ valid: true, errors: [] });
    expect(validateInterviewState({ ...state, askedIds: new Array(21).fill('context') }).valid).toBe(false);
  });
});
