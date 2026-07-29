import { describe, expect, it } from 'vitest';
import stakeholders from '../data/stakeholders.json';
import { buildLocalEvaluation, mergeAiEvaluation, rankProviderCandidates, selectShortlist } from './selectionEngine';

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

  it('returns up to ten candidates and keeps at least five when the catalog allows it', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      candidate: { id: index + 1, nome: `Candidato ${index + 1}`, instituicao: `Instituto ${index + 1}` },
      dimensions: { impact: 80, alignment: 80, credibility: 80, collaboration: 80, feasibility: 80, risk: 80 },
      strategicValue: 80,
      viability: 80,
      total: 80 - index,
    }));
    const shortlist = selectShortlist(many);
    expect(shortlist).toHaveLength(10);
    expect(new Set(shortlist.map((entry) => entry.candidate.id)).size).toBe(10);
  });

  it('fills the minimum with the best available records below the threshold', () => {
    const few = Array.from({ length: 6 }, (_, index) => ({
      candidate: { id: index + 1, nome: `Candidato ${index + 1}`, instituicao: `Instituto ${index + 1}` },
      strategicValue: 20,
      viability: 20,
      total: 20 - index,
    }));
    expect(selectShortlist(few)).toHaveLength(6);
    expect(selectShortlist(few).length).toBeGreaterThanOrEqual(5);
  });

  it('keeps institutions diverse before filling by score and excludes confirmed severe risk', () => {
    const entries = [
      { candidate: { id: 1, instituicao: 'A' }, total: 99, strategicValue: 99 },
      { candidate: { id: 2, instituicao: 'A' }, total: 98, strategicValue: 98 },
      { candidate: { id: 3, instituicao: 'B' }, total: 97, strategicValue: 97 },
      { candidate: { id: 4, instituicao: 'C' }, total: 96, strategicValue: 96 },
      { candidate: { id: 5, instituicao: 'D' }, total: 95, strategicValue: 95, severeRisk: { confirmed: true } },
      { candidate: { id: 6, instituicao: 'E' }, total: 94, strategicValue: 94 },
    ];
    const shortlist = selectShortlist(entries);
    expect(shortlist.map((entry) => entry.candidate.id)).toEqual([1, 3, 4, 6, 2]);
    expect(shortlist.some((entry) => entry.severeRisk?.confirmed)).toBe(false);
  });

  it('preselects a bounded and institution-diverse provider pool', () => {
    const entries = Array.from({ length: 40 }, (_, index) => ({
      candidate: { id: index + 1, nome: `Candidato ${index + 1}`, instituicao: `Instituto ${index % 20}` },
      total: 100 - index,
    }));
    const selected = rankProviderCandidates(entries, 30);
    expect(selected).toHaveLength(30);
    expect(new Set(selected.slice(0, 20).map((entry) => entry.candidate.instituicao)).size).toBe(20);
  });

  it('exposes a candidate-specific differential and trade-offs', () => {
    const result = buildLocalEvaluation({ ...input, brief: { context: input.answers.context, themes: ['IA', 'manufatura'], feasibility: { geography: 'Brasil' }, collaborationModel: 'palestra' }, candidates });
    const first = result.shortlist[0];
    expect(first.comparativeEdge).toContain('Diferencia-se');
    expect(first.dimensionRationale).toEqual(expect.objectContaining({ impact: expect.any(String), risk: expect.any(String) }));
    expect(Array.isArray(first.tradeoffs)).toBe(true);
  });

  it('does not treat absence of partnership evidence as a risk signal', () => {
    const neutral = { ...candidates[0], id: 10, relacao: '' };
    const partnershipUnknown = { ...candidates[0], id: 11, relacao: 'Sem evidência pública de parceria com o SENAI-SP.' };

    const result = buildLocalEvaluation({ ...input, candidates: [neutral, partnershipUnknown] });
    const neutralRisk = result.candidatePool.find((entry) => entry.candidate.id === 10).dimensions.risk;
    const unknownRisk = result.candidatePool.find((entry) => entry.candidate.id === 11).dimensions.risk;

    expect(unknownRisk).toBe(neutralRisk);
  });

  it('excludes a catalog record with a confirmed severe risk from the local shortlist', () => {
    const safe = Array.from({ length: 5 }, (_, index) => ({
      ...candidates[0],
      id: 20 + index,
      nome: `Especialista seguro ${index + 1}`,
      instituicao: `Instituto seguro ${index + 1}`,
    }));
    const sanctioned = {
      ...candidates[0],
      id: 99,
      nome: 'Organização com impedimento',
      instituicao: 'Organização com impedimento',
      riscos_sinais: 'Sanção oficial confirmada e impedimento vigente para contratação pública.',
    };

    const result = buildLocalEvaluation({ ...input, candidates: [sanctioned, ...safe] });
    const risky = result.candidatePool.find((entry) => entry.candidate.id === 99);

    expect(risky.severeRisk).toMatchObject({ confirmed: true });
    expect(risky.strategicValue).toBe(0);
    expect(result.shortlist.some((entry) => entry.candidate.id === 99)).toBe(false);
    expect(result.trace.shortlistExcluded).toContainEqual({ id: 99, reason: 'severe-risk' });
  });

  it('does not escalate an explicitly unconfirmed allegation to a severe risk', () => {
    const alleged = {
      ...candidates[0],
      id: 100,
      riscos_sinais: 'Sanção não confirmada por fonte oficial; alegação ainda sem comprovação.',
    };

    const result = buildLocalEvaluation({ ...input, candidates: [alleged, ...candidates] });
    const evaluated = result.candidatePool.find((entry) => entry.candidate.id === 100);

    expect(evaluated.severeRisk).toBeNull();
    expect(evaluated.strategicValue).toBeGreaterThan(0);
  });

  it('preserves a confirmed local severe risk when the AI evaluation omits it', () => {
    const sanctioned = {
      ...candidates[0],
      id: 101,
      riscos_sinais: 'Sanção oficial confirmada e impedimento vigente.',
    };
    const local = buildLocalEvaluation({ ...input, candidates: [sanctioned, ...candidates] });
    const merged = mergeAiEvaluation(local, {
      provider: 'openrouter',
      evaluations: [{ id: 101, dimensions: { impact: 100, alignment: 100, credibility: 100 } }],
    });
    const evaluated = merged.candidatePool.find((entry) => entry.candidate.id === 101);

    expect(evaluated.severeRisk).toMatchObject({ confirmed: true });
    expect(evaluated.strategicValue).toBe(0);
    expect(merged.shortlist.some((entry) => entry.candidate.id === 101)).toBe(false);
  });

  it('calibrates an advanced-manufacturing partnership case with real catalog records', () => {
    const catalogIds = new Set([25, 37, 49, 70]);
    const realCandidates = stakeholders.filter((candidate) => catalogIds.has(Number(candidate.id)));
    const result = buildLocalEvaluation({
      category: 'organization',
      objective: 'project_partner',
      answers: {
        context: 'Projeto aplicado de manufatura avançada e inteligência artificial para a indústria paulista',
        themes: 'manufatura avançada; inovação industrial; inteligência artificial',
        geography: 'Brasil ou parceria internacional remota',
        constraints: 'evidência pública de colaboração',
      },
      brief: {
        context: 'Projeto aplicado de manufatura avançada e inteligência artificial',
        themes: ['manufatura avançada', 'inovação industrial', 'inteligência artificial'],
        desiredOutcomes: ['projeto aplicado'],
        collaborationModel: 'projeto conjunto',
        feasibility: { geography: 'Brasil' },
      },
      candidates: realCandidates,
    });
    const byId = new Map(result.candidatePool.map((entry) => [Number(entry.candidate.id), entry]));

    expect(byId.get(25).total).toBeGreaterThan(byId.get(37).total);
    expect(byId.get(25).dimensions.collaboration).toBeGreaterThan(byId.get(37).dimensions.collaboration);
    expect(result.shortlist[0].candidate.nome).not.toBe('Ivy Tech Community College');
  });
});
