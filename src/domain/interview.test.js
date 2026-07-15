import { describe, expect, it } from 'vitest';
import { buildInterview } from './interview';

describe('buildInterview', () => {
  it('creates a bounded and contextual interview for every category', () => {
    for (const category of ['researcher', 'school', 'organization']) {
      const questions = buildInterview({ category, objective: 'speaker' });

      expect(questions.length).toBeGreaterThanOrEqual(8);
      expect(questions.length).toBeLessThanOrEqual(12);
      expect(questions[0].id).toBe('context');
      expect(questions.some((question) => question.id === 'audience')).toBe(true);
      expect(questions.every((question) => question.example)).toBe(true);
    }
  });

  it('adapts questions to the objective', () => {
    const speaker = buildInterview({ category: 'researcher', objective: 'speaker' });
    const partner = buildInterview({ category: 'researcher', objective: 'project_partner' });

    expect(speaker.some((question) => question.id === 'communication_style')).toBe(true);
    expect(partner.some((question) => question.id === 'partnership_model')).toBe(true);
  });
});
