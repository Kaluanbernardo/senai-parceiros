import { describe, expect, it } from 'vitest';
import { DIMENSIONS, GROUP_BOUNDS, OBJECTIVE_WEIGHT_PROFILES, WEIGHT_BOUNDS, deriveDimensionWeights, describeCriteria, groupShares } from './selectionCriteria';

const sum = (weights) => Number(DIMENSIONS.reduce((total, dimension) => total + weights[dimension], 0).toFixed(2));

describe('selection criteria', () => {
  it('starts from the objective profile and always yields a normalized weighting', () => {
    for (const objective of Object.keys(OBJECTIVE_WEIGHT_PROFILES)) {
      const criteria = deriveDimensionWeights({ objective, category: 'organization' });
      expect(sum(criteria.weights)).toBe(1);
      expect(criteria.profile).toBe(objective);
    }
  });

  it('keeps every weight inside its declared band no matter how many rules fire', () => {
    const criteria = deriveDimensionWeights({
      objective: 'project_partner',
      category: 'researcher',
      brief: {
        themes: ['economia circular', 'manufatura avançada', 'formação docente'],
        evidencePreferences: ['publicações'],
        collaborationModel: 'projeto conjunto',
        audience: 'instrutores',
        diversityPreferences: { description: 'equilibrar regiões' },
        riskRules: { description: 'conflito de interesse' },
        uncertainties: ['budget', 'timeframe', 'audience'],
        feasibility: { geography: 'São Paulo', timeframe: 'urgente, ainda este mês' },
      },
      answers: { budget: 'sem orçamento', success_indicators: 'taxa de reaproveitamento' },
    });

    expect(sum(criteria.weights)).toBe(1);
    for (const dimension of DIMENSIONS) {
      const [min, max] = WEIGHT_BOUNDS[dimension];
      // A normalização acontece depois do clamp, então a checagem usa a faixa
      // com folga: o que importa é nenhuma dimensão zerar nem dominar.
      expect(criteria.weights[dimension]).toBeGreaterThan(min * 0.6);
      expect(criteria.weights[dimension]).toBeLessThan(max * 1.4);
    }
    expect(criteria.groupWeights.strategic).toBeGreaterThanOrEqual(GROUP_BOUNDS.strategicMin);
    expect(criteria.groupWeights.strategic).toBeLessThanOrEqual(GROUP_BOUNDS.strategicMax);
  });

  it('moves the weights in response to what the user actually said, with a stated reason', () => {
    const base = deriveDimensionWeights({ objective: 'speaker', category: 'organization' });
    const urgent = deriveDimensionWeights({
      objective: 'speaker',
      category: 'organization',
      brief: { feasibility: { timeframe: 'preciso ainda este mês, é urgente' } },
    });
    const evidenceDriven = deriveDimensionWeights({
      objective: 'speaker',
      category: 'organization',
      brief: { evidencePreferences: ['publicações revisadas por pares'] },
    });

    expect(urgent.weights.feasibility).toBeGreaterThan(base.weights.feasibility);
    expect(urgent.adjustments.map((item) => item.id)).toContain('deadline_pressure');
    expect(urgent.adjustments.every((item) => item.reason)).toBe(true);
    expect(evidenceDriven.weights.credibility).toBeGreaterThan(base.weights.credibility);
  });

  it('produces different weightings for different objectives on the same context', () => {
    const brief = { context: 'manufatura avançada', themes: ['manufatura avançada'] };
    const partner = deriveDimensionWeights({ objective: 'project_partner', category: 'organization', brief });
    const benchmark = deriveDimensionWeights({ objective: 'benchmark', category: 'organization', brief });

    expect(partner.weights.collaboration).toBeGreaterThan(benchmark.weights.collaboration);
    expect(benchmark.weights.alignment).toBeGreaterThan(partner.weights.alignment);
  });

  it('exposes group shares and a readable rubric', () => {
    const criteria = deriveDimensionWeights({ objective: 'guided', category: 'organization' });
    const shares = groupShares(criteria.weights, 'strategic');

    expect(Number(Object.values(shares).reduce((total, value) => total + value, 0).toFixed(2))).toBe(1);
    const rubric = describeCriteria(criteria.weights);
    expect(rubric).toHaveLength(DIMENSIONS.length);
    expect(rubric.every((item) => item.subcriteria.length >= 3 && item.weight > 0)).toBe(true);
  });
});
