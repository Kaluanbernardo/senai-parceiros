import { describe, expect, it } from 'vitest';
import { buildInterview, ExampleResolver, getExampleCoverage } from './interview';

describe('buildInterview', () => {
  it('creates a bounded and contextual interview for every category', () => {
    for (const category of ['person', 'organization']) {
      const questions = buildInterview({ category, objective: 'speaker' });

      expect(questions.length).toBeGreaterThanOrEqual(8);
      expect(questions.length).toBeLessThanOrEqual(12);
      expect(questions[0].id).toBe('context');
      expect(questions.some((question) => question.id === 'audience')).toBe(true);
      expect(questions.every((question) => question.example)).toBe(true);
    }
  });

  it('adapts questions to the objective', () => {
    const speaker = buildInterview({ category: 'person', objective: 'speaker' });
    const partner = buildInterview({ category: 'person', objective: 'project_partner' });

    expect(speaker.some((question) => question.id === 'communication_style')).toBe(true);
    expect(partner.some((question) => question.id === 'partnership_model')).toBe(true);
  });

  it('gives researcher speakers a format and audience example', () => {
    const questions = buildInterview({ category: 'person', objective: 'speaker' });
    const communication = questions.find((question) => question.id === 'communication_style');

    expect(communication.example).toMatch(/palestra|mesa-redonda|formato/i);
    expect(communication.example).toMatch(/público|publico/i);
    expect(communication.exampleCoverage.specializedQuestionIds).toContain('communication_style');
  });

  it('keeps legal-entity benchmarking focused on comparison, not an AI event', () => {
    const questions = buildInterview({ category: 'organization', objective: 'benchmark' });
    const examples = questions.map((question) => question.example).join(' ');

    expect(examples).not.toMatch(/evento/i);
    expect(examples).not.toMatch(/\bIA\b|inteligência artificial/i);
    expect(questions.find((question) => question.id === 'benchmark_focus').example).toMatch(/práticas|resultados|comparar|analisar/i);
  });

  it('resolves contextual examples deterministically and reports coverage', () => {
    const first = ExampleResolver.resolve({ questionId: 'communication_style', category: 'person', objective: 'speaker', context: 'IA aplicada à indústria' });
    const second = ExampleResolver.resolve({ questionId: 'communication_style', category: 'person', objective: 'speaker', context: 'IA aplicada à indústria' });
    const coverage = getExampleCoverage({ category: 'person', objective: 'speaker', context: 'IA aplicada à indústria' });

    expect(first).toBe(second);
    expect(first).toMatch(/IA aplicada à indústria|palestra|público/i);
    expect(coverage.version).toBe('contextual-examples-v1');
    expect(coverage.contextSignal).toBe('industrial_ai');
  });
});
