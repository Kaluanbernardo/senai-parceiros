import { describe, expect, it } from 'vitest';
import { InterviewPlanner, MAX_QUESTIONS, finalize, start } from './interviewPlanner';

function answerAndNext(state, value = 'Resposta suficiente para esta pergunta') {
  return InterviewPlanner.next(InterviewPlanner.answer(state, value));
}

describe('InterviewPlanner', () => {
  it('starts with a contextual first question and exposes transient state', () => {
    const state = start({ category: 'researcher', objective: 'speaker' });

    expect(state.status).toBe('active');
    expect(state.currentQuestion.id).toBe('context');
    expect(state.currentQuestion.reasonTag).toBe('estabelecer_contexto');
    expect(state.progress.max).toBe(MAX_QUESTIONS);
    expect(state).not.toHaveProperty('storageKey');
  });

  it('adapts the next questions to school benchmarking and does not add speaker branches', () => {
    let state = start({ category: 'school', objective: 'benchmark' });
    const ids = [];
    for (let index = 0; index < 20 && state.currentQuestion; index += 1) {
      ids.push(state.currentQuestion.id);
      state = answerAndNext(state);
    }

    expect(ids).toContain('benchmark_focus');
    expect(ids).not.toContain('communication_style');
    expect(state.askedIds.length).toBeLessThanOrEqual(20);
  });

  it('prioritizes a discovery follow-up when a required answer is unknown', () => {
    let state = start({ category: 'researcher', objective: 'speaker' });
    state = answerAndNext(state, 'não sei ainda');

    expect(state.currentQuestion.id).toBe('context_discovery');
    expect(state.uncertainties).toContain('context');
    expect(state.currentQuestion.reasonTag).toBe('aprofundar_contexto');
  });

  it('finalizes a structured brief and keeps gaps visible', () => {
    let state = start({ category: 'researcher', objective: 'speaker', context: 'IA aplicada à indústria' });
    for (let index = 0; index < 20 && state.currentQuestion; index += 1) {
      const value = state.currentQuestion.id === 'themes' ? 'não sei ainda' : `Resposta para ${state.currentQuestion.id}`;
      state = answerAndNext(state, value);
    }

    const brief = finalize(state);
    expect(brief.category).toBe('researcher');
    expect(brief.objective).toBe('speaker');
    expect(brief.context).toBe('IA aplicada à indústria');
    expect(brief.uncertainties).toContain('themes');
    expect(brief.planner.questionsAsked).toBeLessThanOrEqual(20);
    expect(brief.dimensionWeights).toHaveProperty('alignment');
  });

  it('uses deterministic fallback ordering for equivalent sessions', () => {
    const collect = () => {
      let state = start({ category: 'organization', objective: 'project_partner' });
      const ids = [];
      while (state.currentQuestion && ids.length < MAX_QUESTIONS) {
        ids.push(state.currentQuestion.id);
        state = answerAndNext(state);
      }
      return ids;
    };

    expect(collect()).toEqual(collect());
  });

  it('marks the session ready with no current question after the final answer', () => {
    let state = start({ category: 'organization', objective: 'guided' });
    while (state.currentQuestion) state = answerAndNext(state, 'Resposta suficiente');
    expect(state.status).toBe('ready');
    expect(state.currentQuestion).toBeNull();
  });
});

describe('InterviewPlanner exports', () => {
  it('exposes the four workflow operations', () => {
    expect(InterviewPlanner).toEqual(expect.objectContaining({
      start: expect.any(Function),
      answer: expect.any(Function),
      next: expect.any(Function),
      finalize: expect.any(Function),
    }));
    expect(start).toBe(InterviewPlanner.start);
    expect(finalize).toBe(InterviewPlanner.finalize);
  });
});
