import { describe, expect, it } from 'vitest';
import { buildDimensionRanges, compareWithNeighbor, groupByProfile, suggestCombination } from './shortlistComparison';

function entry(id, dimensions, name = `Candidato ${id}`) {
  return { candidate: { id, nome: name }, dimensions, total: 70 };
}

// Reproduz o caso real que motivou a mudança: impacto e alinhamento variam
// muito, colaboração e risco são constantes, e as médias escondem tudo.
const shortlist = [
  entry(1, { impact: 73, alignment: 61, credibility: 77, collaboration: 74, feasibility: 81, risk: 80 }, 'Jos Akkermans'),
  entry(2, { impact: 83, alignment: 57, credibility: 78, collaboration: 74, feasibility: 72, risk: 80 }, 'Mahmut Özer'),
  entry(3, { impact: 73, alignment: 58, credibility: 78, collaboration: 74, feasibility: 81, risk: 80 }, 'Erica Smith'),
  entry(4, { impact: 81, alignment: 52, credibility: 78, collaboration: 74, feasibility: 81, risk: 80 }, 'Thomas Schröder'),
  entry(5, { impact: 91, alignment: 42, credibility: 72, collaboration: 74, feasibility: 81, risk: 80 }, 'Matthew Schmidt'),
];

describe('shortlist comparison', () => {
  it('scales each dimension to the range it actually occupies', () => {
    const ranges = buildDimensionRanges(shortlist);
    const alignment = ranges.find((range) => range.dimension === 'alignment');

    expect(alignment).toMatchObject({ min: 42, max: 61, amplitude: 19, discriminates: true });
    // O menor ocupa o início da faixa e o maior o fim, em vez de dois pontos
    // quase colados num eixo de 0 a 100.
    expect(alignment.points.find((point) => point.value === 42).position).toBe(0);
    expect(alignment.points.find((point) => point.value === 61).position).toBe(1);
    expect(alignment.points.find((point) => point.value === 61).leader).toBe(true);
  });

  it('declares the dimensions that separate nobody instead of plotting them', () => {
    const ranges = buildDimensionRanges(shortlist);
    const flat = ranges.filter((range) => !range.discriminates).map((range) => range.dimension);

    expect(flat).toEqual(expect.arrayContaining(['collaboration', 'risk']));
    const collaboration = ranges.find((range) => range.dimension === 'collaboration');
    expect(collaboration.amplitude).toBe(0);
    expect(collaboration.reason).toContain('74 de 100');
    expect(collaboration.reason).toContain('Todos os 5');
    // Quem está em cada ponta aparece por nome, não por número solto.
    const alignment = ranges.find((range) => range.dimension === 'alignment');
    expect(alignment.leaderName).toBe('Jos Akkermans');
    expect(alignment.trailerName).toBe('Matthew Schmidt');
  });

  it('only blames a shared subcriterion when the evidence is really shared', () => {
    const withCriteria = shortlist.slice(0, 3).map((item, index) => ({
      ...item,
      criteria: {
        risk: { score: 80, subscores: [
          { id: 'signal_control', label: 'Ausência de sinais de risco', score: 88, weight: 0.5, evidence: ['nenhum sinal de risco no cadastro'] },
          // A nota empata, mas a evidência é de cada candidato: usá-la como
          // explicação do empate seria falso para os outros dois.
          { id: 'information_completeness', label: 'Completude da informação', score: 70, weight: 0.5, evidence: [`país do perfil: ${['Austrália', 'Turquia', 'Brasil'][index]}`] },
        ] },
      },
    }));
    const risk = buildDimensionRanges(withCriteria).find((range) => range.dimension === 'risk');

    expect(risk.reason).toContain('nenhum sinal de risco no cadastro');
    expect(risk.reason).not.toContain('Austrália');
  });

  it('orders the dimensions by how much they actually separate the shortlist', () => {
    const ranges = buildDimensionRanges(shortlist);
    expect(ranges[0].amplitude).toBeGreaterThanOrEqual(ranges[1].amplitude);
    expect(ranges.at(-1).amplitude).toBe(0);
  });

  it('says where each candidate beats and loses to its neighbour', () => {
    const neighbors = compareWithNeighbor(shortlist);
    const first = neighbors.get(1);

    expect(first.sentence).toMatch(/Mahmut Özer/);
    expect(first.sentence).toMatch(/ganha em/i);
    // Viabilidade +9 usa toda a amplitude da dimensão (9), enquanto
    // alinhamento +4 usa só um quinto da sua (19): o ganho maior é o primeiro.
    expect(first.gain.dimension).toBe('feasibility');
    expect(first.loss.dimension).toBe('impact');
    // O último não tem sucessor, então compara com quem está acima.
    expect(neighbors.get(5).neighborRank).toBe(4);
    // Dimensões constantes nunca aparecem na comparação.
    expect([...neighbors.values()].every((item) => item.gain?.dimension !== 'risk' && item.loss?.dimension !== 'risk')).toBe(true);
  });

  it('groups the shortlist by the dimension where each candidate stands out', () => {
    const profiles = groupByProfile(shortlist);
    const byDimension = Object.fromEntries(profiles.map((group) => [group.dimension, group.members.map((member) => member.id)]));

    expect(profiles.length).toBeGreaterThan(1);
    expect(byDimension.alignment).toContain(1);
    expect(byDimension.impact).toContain(5);
    expect(profiles.every((group) => group.label && group.members.length)).toBe(true);
    expect(profiles.flatMap((group) => group.members)).toHaveLength(shortlist.length);
  });

  it('suggests a combination that covers ground instead of repeating a profile', () => {
    const combination = suggestCombination(shortlist, { size: 2 });

    expect(combination.members).toHaveLength(2);
    expect(combination.members[0].rank).toBe(1);
    // O primeiro lidera alinhamento; o complemento tem de trazer impacto.
    expect(combination.members[1].id).toBe(5);
    expect(combination.members[1].adds[0].label).toMatch(/impacto/i);
  });

  it('stays quiet when nothing separates the candidates', () => {
    const identical = [1, 2, 3].map((id) => entry(id, { impact: 70, alignment: 70, credibility: 70, collaboration: 70, feasibility: 70, risk: 70 }));

    expect(buildDimensionRanges(identical).every((range) => !range.discriminates)).toBe(true);
    expect(suggestCombination(identical)).toBeNull();
    expect(groupByProfile(identical)).toHaveLength(1);
    expect(groupByProfile(identical)[0].dimension).toBeNull();
  });

  it('handles an empty or single-entry shortlist', () => {
    expect(buildDimensionRanges([])).toEqual([]);
    expect(compareWithNeighbor([shortlist[0]]).size).toBe(0);
    expect(suggestCombination([shortlist[0]])).toBeNull();
  });
});
