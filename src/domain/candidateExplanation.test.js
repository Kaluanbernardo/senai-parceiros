import { describe, expect, it } from 'vitest';
import { explainCandidate } from './candidateExplanation';

describe('candidate explanation copy', () => {
  it('expands VET into plain Portuguese in the visible headline', () => {
    const explanation = explainCandidate({
      candidate: { areas: 'Design instrução VET', instituicao: 'Universidade', pais: 'EUA' },
      profile: { objective: 'speaker', themePhrases: [], prioritiesFromUser: false, audiences: [], contributions: [] },
      matches: { priorities: [], audiences: [], contributions: [], themeMatches: 1, geographyScore: 100 },
      dimensions: { alignment: 0, impact: 0 },
      partnership: { confirmed: false },
      text: 'educação profissional',
    });

    expect(explanation.headline).toBe('Atua em design instrucional em educação profissional. Universidade · EUA.');
  });
});
