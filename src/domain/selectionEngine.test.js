import { describe, expect, it } from 'vitest';
import stakeholders from '../data/stakeholders.json';
import { buildLocalEvaluation, computeEligibilityThreshold, mergeAiEvaluation, rankProviderCandidates, selectShortlist } from './selectionEngine';

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

  it('records the derived weights, the rubric and the interpreted context in the trace', () => {
    const result = buildLocalEvaluation({
      ...input,
      brief: { context: input.answers.context, themes: ['inteligência artificial'], evidencePreferences: ['publicações'], feasibility: { geography: 'Brasil', timeframe: 'urgente' }, hardConstraints: [], riskRules: {}, diversityPreferences: {}, uncertainties: [] },
      candidates,
    });
    const { criteria, contextProfile, shortlistPolicy } = result.trace;

    expect(Number(Object.values(criteria.weights).reduce((total, value) => total + value, 0).toFixed(2))).toBe(1);
    expect(criteria.adjustments.map((item) => item.id)).toEqual(expect.arrayContaining(['deadline_pressure', 'evidence_demand']));
    expect(criteria.subcriteria.find((item) => item.dimension === 'alignment').subcriteria.length).toBeGreaterThanOrEqual(3);
    expect(contextProfile.priorities.length).toBeGreaterThan(0);
    expect(contextProfile.prioritiesFromUser).toBe(true);
    expect(shortlistPolicy.threshold).toBeGreaterThanOrEqual(shortlistPolicy.absoluteFloor);
  });

  it('opens every dimension into weighted subcriteria that carry their own evidence', () => {
    const result = buildLocalEvaluation({ ...input, candidates });
    const { criteria } = result.shortlist[0];

    for (const dimension of ['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk']) {
      const detail = criteria[dimension];
      expect(detail.subscores.length).toBeGreaterThanOrEqual(3);
      expect(Number(detail.subscores.reduce((total, item) => total + item.weight, 0).toFixed(2))).toBe(1);
      expect(detail.subscores.every((item) => item.evidence.length > 0)).toBe(true);
      const recomposed = Math.round(detail.subscores.reduce((total, item) => total + item.score * item.weight, 0));
      expect(Math.abs(recomposed - detail.score)).toBeLessThanOrEqual(1);
    }
  });

  it('ranks the same catalog differently when the objective changes the weights', () => {
    const pool = [
      { id: 'partner', nome: 'Rede com parceria', instituicao: 'Rede A', pais: 'Brasil', areas: 'manufatura avançada', descricao: 'Projeto conjunto de manufatura avançada com o SENAI.', relacao: '✅ Parceria entre SENAI e a rede formalizada em 2019.', website: 'https://a.example' },
      { id: 'scholar', nome: 'Pesquisadora sem parceria', instituicao: 'Universidade B', pais: 'Brasil', areas: 'manufatura avançada', pesquisa: 'Publicações e artigos sobre manufatura avançada.', citacoes: '9000', scholar: 'https://scholar.example' },
    ];
    const answers = { context: 'manufatura avançada', themes: 'manufatura avançada' };
    const brief = { context: 'manufatura avançada', themes: ['manufatura avançada'], collaborationModel: 'projeto conjunto', evidencePreferences: [], feasibility: {}, hardConstraints: [], riskRules: {}, diversityPreferences: {}, uncertainties: [] };

    const partnership = buildLocalEvaluation({ category: 'organization', objective: 'project_partner', answers, brief, candidates: pool });
    const research = buildLocalEvaluation({ category: 'researcher', objective: 'research_support', answers, brief: { ...brief, collaborationModel: '', evidencePreferences: ['publicações'] }, candidates: pool });

    expect(partnership.shortlist[0].candidate.id).toBe('partner');
    expect(research.shortlist[0].candidate.id).toBe('scholar');
  });

  it('discounts terms that every catalog record repeats', () => {
    const generic = Array.from({ length: 8 }, (_, index) => ({
      id: `generic-${index}`,
      nome: `Instituição ${index}`,
      instituicao: `Instituição ${index}`,
      pais: 'Brasil',
      descricao: 'Atuação em educação profissional para a indústria paulista.',
    }));
    const specific = { id: 'specific', nome: 'Centro de Economia Circular', instituicao: 'Centro Circular', pais: 'Brasil', descricao: 'Atuação em educação profissional para a indústria paulista com foco em economia circular e descarbonização.' };
    const answers = { context: 'educação profissional para a indústria paulista com economia circular', themes: 'economia circular' };

    const result = buildLocalEvaluation({
      category: 'organization',
      objective: 'guided',
      answers,
      brief: { context: answers.context, themes: ['economia circular'], evidencePreferences: [], feasibility: {}, hardConstraints: [], riskRules: {}, diversityPreferences: {}, uncertainties: [] },
      candidates: [...generic, specific],
    });
    const byId = new Map(result.candidatePool.map((entry) => [entry.candidate.id, entry]));

    // Todos repetem "educação profissional" e "indústria paulista"; só um traz
    // o termo que realmente distingue o pedido.
    expect(byId.get('specific').dimensions.alignment).toBeGreaterThan(byId.get('generic-0').dimensions.alignment + 10);
    expect(result.shortlist[0].candidate.id).toBe('specific');
  });

  it('raises the eligibility cut when one candidate stands far above the catalog', () => {
    const entries = [
      { candidate: { id: 1, instituicao: 'A' }, total: 90, strategicValue: 90 },
      { candidate: { id: 2, instituicao: 'B' }, total: 30, strategicValue: 30 },
    ];
    expect(computeEligibilityThreshold(entries)).toBe(50);
    expect(computeEligibilityThreshold([{ candidate: { id: 3 }, total: 20, strategicValue: 20 }])).toBe(28);
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
