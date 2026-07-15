import { describe, expect, it } from 'vitest';
import { buildLocalEvaluation, mergeAiEvaluation } from './selectionEngine';

const candidates = [
  {
    id: 1,
    nome: 'Especialista em IA Industrial',
    instituicao: 'Instituto A',
    pais: 'Brasil',
    areas: 'Inteligência artificial; manufatura avançada',
    pesquisa: 'Aplicações de IA na indústria e formação profissional.',
    citacoes: '1200',
  },
  {
    id: 2,
    nome: 'Especialista em História',
    instituicao: 'Instituto B',
    pais: 'Brasil',
    areas: 'História da educação',
    pesquisa: 'História e arquivos escolares.',
    citacoes: '800',
  },
];

const input = {
  category: 'researcher',
  objective: 'speaker',
  answers: {
    context: 'Evento sobre inteligência artificial aplicada à indústria paulista',
    themes: 'IA; manufatura avançada; educação profissional',
    geography: 'Brasil ou internacional',
    constraints: 'Participação remota é aceita',
  },
};

describe('selection engine', () => {
  it('ranks catalog candidates and limits the shortlist to five', () => {
    const result = buildLocalEvaluation({ ...input, candidates });

    expect(result.shortlist).toHaveLength(2);
    expect(result.shortlist[0].candidate.id).toBe(1);
    expect(result.shortlist[0].dimensions).toEqual(
      expect.objectContaining({
        impact: expect.any(Number),
        alignment: expect.any(Number),
        credibility: expect.any(Number),
        collaboration: expect.any(Number),
        feasibility: expect.any(Number),
        risk: expect.any(Number),
      }),
    );
    expect(result.trace.formula).toBeTruthy();
  });

  it('recomputes totals and zeroes strategic value for confirmed severe risk', () => {
    const local = buildLocalEvaluation({ ...input, candidates });
    const merged = mergeAiEvaluation(local, {
      model: 'test/model',
      evaluations: [
        {
          id: 1,
          dimensions: local.shortlist[0].dimensions,
          confidence: 80,
          summary: 'Teste',
          gaps: [],
          severeRisk: { confirmed: true, evidence: 'Sanção oficial confirmada' },
        },
      ],
    });

    const risky = merged.candidatePool.find((entry) => entry.candidate.id === 1);
    expect(risky.strategicValue).toBe(0);
    expect(risky.total).toBeLessThanOrEqual(50);
    expect(merged.trace.model).toBe('test/model');
  });
});
