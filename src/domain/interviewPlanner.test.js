import { describe, expect, it } from 'vitest';
import { InterviewPlanner, MAX_QUESTIONS, MIN_QUESTIONS, finalize, start } from './interviewPlanner';

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

  it('uses the meaning of the answer to choose and phrase the next question', () => {
    let benchmarking = start({ category: 'school', objective: 'benchmark' });
    benchmarking = answerAndNext(benchmarking, 'Quero comparar gestão curricular e integração das escolas com empresas industriais.');

    let event = start({ category: 'researcher', objective: 'speaker' });
    event = answerAndNext(event, 'Será um evento sobre economia circular para instrutores do SENAI-SP.');

    expect(benchmarking.currentQuestion.id).toBe('benchmark_focus');
    expect(benchmarking.currentQuestion.prompt).toMatch(/gestão curricular|integração/i);
    expect(event.currentQuestion.prompt).toMatch(/economia circular|instrutores/i);
    expect(event.currentQuestion.prompt).not.toBe(benchmarking.currentQuestion.prompt);
  });

  it('opens with a question written for the chosen category and objective', () => {
    const benchmarking = start({ category: 'school', objective: 'benchmark' });
    const partnership = start({ category: 'organization', objective: 'project_partner' });

    expect(benchmarking.currentQuestion.prompt).not.toBe(partnership.currentQuestion.prompt);
    expect(benchmarking.currentQuestion.prompt).toMatch(/institui/i);
    expect(partnership.currentQuestion.prompt).toMatch(/iniciativa|organiza/i);
  });

  it('does not ask again what the answer already covered', () => {
    let state = start({ category: 'researcher', objective: 'speaker' });
    state = answerAndNext(state, 'Será um evento sobre economia circular para instrutores e gestores do SENAI-SP em São Paulo, ainda este mês.');

    // Público, tema, geografia e prazo saíram de uma única resposta: repetir
    // essas perguntas é o que fazia a entrevista parecer um formulário.
    expect(state.coveredFields).toEqual(expect.arrayContaining(['themes', 'audience', 'geography', 'timeframe']));
    expect(state.validation.missing).not.toContain('audience');
    const ids = [];
    while (state.currentQuestion && ids.length < MAX_QUESTIONS) {
      ids.push(state.currentQuestion.id);
      state = answerAndNext(state, 'Resposta suficiente');
    }
    expect(ids).not.toContain('audience');
    expect(ids).not.toContain('themes');
  });

  it('ends as soon as the required information is covered instead of filling a quota', () => {
    let rich = start({ category: 'organization', objective: 'project_partner' });
    rich = answerAndNext(rich, 'Precisamos de um projeto piloto de economia circular com empresas de São Paulo, para instrutores, ainda este mês; não podemos custear viagens e o resultado esperado é um indicador de reaproveitamento de resíduos.');
    let asked = rich.askedIds.length;
    while (rich.currentQuestion && asked < MAX_QUESTIONS) {
      rich = answerAndNext(rich, 'Queremos construir um laboratório conjunto com evidência pública de resultados.');
      asked = rich.askedIds.length;
    }

    expect(rich.status).toBe('ready');
    expect(rich.askedIds.length).toBeLessThan(MAX_QUESTIONS);
    expect(rich.askedIds.length).toBeGreaterThanOrEqual(MIN_QUESTIONS);
  });

  it('asks where the activity happens instead of assuming a SENAI-SP unit', () => {
    let state = start({ category: 'organization', objective: 'speaker' });
    const prompts = [];
    while (state.currentQuestion && prompts.length < MAX_QUESTIONS) {
      prompts.push(`${state.currentQuestion.prompt} ${state.currentQuestion.helper}`);
      state = answerAndNext(state, 'Resposta suficiente');
    }
    const geography = prompts.find((prompt) => /idioma/i.test(prompt));

    expect(geography).toMatch(/onde/i);
    // O local é uma pergunta, não um pressuposto: pode ser a sede do parceiro,
    // outro espaço, outra cidade ou online.
    expect(geography).toMatch(/sede do parceiro|outro espaço|online/i);
  });

  it('does not presume that the audience is made of industry workers', () => {
    let state = start({ category: 'researcher', objective: 'speaker' });
    const texts = [];
    while (state.currentQuestion && texts.length < MAX_QUESTIONS) {
      texts.push(`${state.currentQuestion.prompt} ${state.currentQuestion.helper} ${state.currentQuestion.example}`);
      state = answerAndNext(state, 'Resposta suficiente');
    }
    const audience = texts.find((text) => /público ou beneficiário/i.test(text));

    expect(audience).toMatch(/estudantes|gestão pública|comunidade|convidados externos/i);
    expect(audience).not.toMatch(/representantes da indústria/i);
  });

  it('varies the wording between consecutive questions instead of cycling prefixes', () => {
    let state = start({ category: 'organization', objective: 'project_partner' });
    const openings = [];
    state = answerAndNext(state, 'Queremos um projeto piloto de economia circular com um parceiro.');
    while (state.currentQuestion && openings.length < 6) {
      openings.push(state.currentQuestion.prompt.slice(0, 18));
      state = answerAndNext(state, 'Ainda estamos definindo, mas o foco é reaproveitamento de resíduos.');
    }

    for (let index = 1; index < openings.length; index += 1) {
      expect(openings[index]).not.toBe(openings[index - 1]);
    }
    expect(new Set(openings).size).toBeGreaterThan(2);
  });

  it('reopens the previous question with its answer and recomputes coverage', () => {
    let state = start({ category: 'researcher', objective: 'speaker' });
    const firstPrompt = state.currentQuestion.prompt;
    state = answerAndNext(state, 'Evento sobre economia circular para instrutores em São Paulo, ainda este mês.');
    const second = state.currentQuestion.id;
    expect(state.coveredFields).toContain('themes');

    const rewound = InterviewPlanner.back(state);

    expect(rewound.currentQuestion.id).toBe('context');
    expect(rewound.currentQuestion.prompt).toBe(firstPrompt);
    expect(rewound.answers.context).toMatch(/economia circular/);
    expect(rewound.askedIds).not.toContain(second);
    expect(rewound.status).toBe('active');
    // A resposta voltou a ser editável, então o que ela cobria sai da cobertura.
    expect(rewound.coveredFields).not.toContain('themes');
    expect(rewound.validation.missing).toContain('themes');
  });

  it('has nothing to go back to on the first question', () => {
    const state = start({ category: 'school', objective: 'benchmark' });
    expect(InterviewPlanner.back(state)).toBe(state);
    expect(InterviewPlanner.back(null)).toBe(null);
  });

  it('re-asks the reopened question and moves on normally after a new answer', () => {
    let state = start({ category: 'organization', objective: 'project_partner' });
    state = answerAndNext(state, 'Projeto piloto com empresas do interior.');
    state = InterviewPlanner.back(state);
    state = answerAndNext(state, 'Na verdade é uma comparação de currículos com escolas técnicas.');

    expect(state.status).toBe('active');
    expect(state.currentQuestion).toBeTruthy();
    expect(state.history.filter((turn) => turn.questionId === 'context')).toHaveLength(1);
    expect(state.answers.context).toMatch(/comparação de currículos/);
  });

  it('keeps the displayed transcript and maps an adaptive turn to a canonical brief field', () => {
    let state = start({ category: 'school', objective: 'benchmark' });
    state = answerAndNext(state, 'Quero comparar currÃ­culos e gestÃ£o com empresas.');
    const dynamicId = 'adaptive_2_benchmark_focus';
    const dynamicQuestion = { id: dynamicId, targetField: 'benchmark_focus', prompt: 'Que prÃ¡tica deseja comparar?', label: 'Que prÃ¡tica deseja comparar?', reasonTag: 'aprofundar_benchmark', dimensions: ['alignment'] };
    state = { ...state, askedIds: [...state.askedIds, dynamicId], questionDefinitions: { ...state.questionDefinitions, [dynamicId]: dynamicQuestion }, currentQuestion: dynamicQuestion };
    state = InterviewPlanner.answer(state, 'integraÃ§Ã£o entre escola e indÃºstria', dynamicId);
    expect(state.transcript.at(-1)).toMatchObject({ displayedQuestion: dynamicQuestion.prompt, targetField: 'benchmark_focus' });
    expect(InterviewPlanner.finalize(state).answers.benchmark_focus).toContain('integraÃ§Ã£o');
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
