/**
 * Comparação dentro da shortlist.
 *
 * Numa lista já filtrada, o nível não informa: todos são bons, foi por isso
 * que entraram. O que ajuda a decidir é a diferença — e ela estava sendo
 * destruída de duas formas.
 *
 * A primeira é a agregação. Num caso real do catálogo de pesquisadores, o
 * impacto variava de 73 a 91 e o alinhamento de 42 a 61, mas o valor
 * estratégico (a média dos dois com credibilidade) variava só de 65 a 71:
 * quem tem impacto alto e alinhamento baixo cai no mesmo ponto de quem tem o
 * perfil oposto. A matriz plotava justamente essas duas médias.
 *
 * A segunda é a escala. Uma dimensão que varia entre 42 e 61 desenhada num
 * eixo de 0 a 100 parece constante. Aqui cada dimensão é normalizada pelo
 * intervalo que ela realmente ocupa nesta shortlist.
 *
 * Dimensões que não variam são declaradas como tal, em vez de ocuparem um
 * eixo do gráfico fingindo informação.
 */

import { sentenceList } from './candidateExplanation.js';
import { DIMENSION_LABELS } from './selectionEngine.js';

export const SHORTLIST_COMPARISON_VERSION = 'shortlist-comparison-v1';

/** Abaixo desta amplitude a dimensão não separa ninguém de forma acionável. */
export const DISCRIMINATION_THRESHOLD = 5;

const DIMENSIONS = Object.keys(DIMENSION_LABELS);

/** Como nomear o perfil de quem se destaca em cada dimensão. */
const PROFILE_LABELS = Object.freeze({
  impact: { label: 'Maior alcance e escala', hint: 'chega a mais gente ou a um público mais amplo' },
  alignment: { label: 'Mais aderente ao tema', hint: 'trata exatamente o assunto que você descreveu' },
  credibility: { label: 'Evidência pública mais forte', hint: 'tem mais material verificável sustentando a indicação' },
  collaboration: { label: 'Mais fácil de engajar', hint: 'já há relação ou canal de contato estabelecido' },
  feasibility: { label: 'Mais viável no prazo e no formato', hint: 'encaixa melhor na geografia, no idioma e no prazo' },
  risk: { label: 'Menos incerteza', hint: 'menos lacunas e nenhum sinal em aberto' },
});

function nameOf(entry) {
  return String(entry?.candidate?.nome || entry?.candidate?.instituicao || entry?.candidate?.id || '').trim();
}

function valueOf(entry, dimension) {
  const value = Number(entry?.dimensions?.[dimension]);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Por que uma dimensão não separa ninguém. Quando todos compartilham a mesma
 * evidência num subcritério, ela é a explicação mais concreta possível.
 */
function flatReason(entries, dimension, value) {
  const total = entries.length;
  const subscores = entries.map((entry) => entry?.criteria?.[dimension]?.subscores || []);
  if (subscores.every((list) => list.length)) {
    // A evidência só explica o empate quando é a mesma para todos. Igualdade
    // de nota não basta: "país do perfil: Austrália" é verdade para um
    // candidato e viraria uma justificativa falsa para os outros nove.
    const shared = subscores[0].find((sub) => subscores.every((list) => {
      const match = list.find((item) => item.id === sub.id);
      return match && match.score === sub.score && String(match.evidence) === String(sub.evidence);
    }));
    if (shared?.evidence?.length) return `${total === 1 ? 'O candidato tem' : `Os ${total} têm`} a mesma situação: ${shared.evidence[0]}.`;
  }
  return `${total === 1 ? 'Nota' : `Todos os ${total} tiraram`} ${value} de 100 aqui.`;
}

/**
 * Faixa ocupada por cada dimensão dentro da shortlist, com a posição relativa
 * de cada candidato nessa faixa.
 */
export function buildDimensionRanges(entries = [], { threshold = DISCRIMINATION_THRESHOLD } = {}) {
  if (!entries.length) return [];
  return DIMENSIONS.map((dimension) => {
    const values = entries.map((entry) => valueOf(entry, dimension));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    const discriminates = amplitude >= threshold;
    return {
      dimension,
      label: DIMENSION_LABELS[dimension],
      min,
      max,
      amplitude,
      discriminates,
      reason: discriminates ? '' : flatReason(entries, dimension, min),
      // Quem está em cada ponta, por nome: um número solto não diz nada a quem
      // está lendo, e era o principal motivo de a comparação continuar confusa.
      leaderName: nameOf(entries[values.indexOf(max)]),
      leaderRank: values.indexOf(max) + 1,
      trailerName: nameOf(entries[values.indexOf(min)]),
      trailerRank: values.indexOf(min) + 1,
      points: entries.map((entry, index) => ({
        rank: index + 1,
        id: entry.candidate?.id,
        name: nameOf(entry),
        value: values[index],
        // Posição dentro do intervalo real desta shortlist, não de 0 a 100.
        position: amplitude ? (values[index] - min) / amplitude : 0.5,
        leader: values[index] === max,
      })),
    };
  }).sort((left, right) => right.amplitude - left.amplitude);
}

/**
 * Uma linha da tabela de comparação: quem lidera, quem empata e como dizer isso
 * sem afirmar mais do que os números sustentam.
 *
 * A tabela usava `indexOf(max)` para achar o líder, o que devolve o primeiro de
 * vários empatados e o apresenta como vencedor único. No catálogo real isso
 * aparecia já na primeira shortlist: dois candidatos com 36 em alinhamento
 * recebiam ambos o selo "melhor" enquanto a frase abaixo dizia que só um deles
 * liderava. É o mesmo defeito que o gate de relevância corrigiu na pontuação —
 * a interface afirmando o que o dado não mostra.
 */
export function describeRow(values = [], names = []) {
  if (!values.length) return null;
  const best = Math.max(...values);
  const worst = Math.min(...values);
  const leaders = names.filter((_, index) => values[index] === best);
  const trailer = names[values.indexOf(worst)];
  const gap = best - worst;
  const points = `${gap} ${gap === 1 ? 'ponto' : 'pontos'}`;

  if (best === worst) {
    return { best, worst, gap: 0, leaders, tied: true, soleLeader: null, sentence: 'Empatados entre os selecionados.' };
  }
  if (leaders.length === 1) {
    return { best, worst, gap, leaders, tied: false, soleLeader: leaders[0], sentence: `${leaders[0]} lidera por ${points}.` };
  }
  // Empate no topo com alguém abaixo: nomeia todos os empatados em vez de
  // eleger um deles por acidente de ordenação.
  return {
    best,
    worst,
    gap,
    leaders,
    tied: false,
    soleLeader: null,
    sentence: `${sentenceList(leaders)} empatam no topo, ${points} à frente de ${trailer}.`,
  };
}

/**
 * Em que cada candidato ganha e perde do vizinho imediato no ranking — a
 * pergunta que a pessoa realmente faz ao olhar dois nomes seguidos.
 */
export function compareWithNeighbor(entries = [], { threshold = DISCRIMINATION_THRESHOLD } = {}) {
  if (entries.length < 2) return new Map();
  const ranges = buildDimensionRanges(entries, { threshold });
  const useful = ranges.filter((range) => range.discriminates);
  const result = new Map();

  entries.forEach((entry, index) => {
    // O último da lista se compara com quem está imediatamente acima.
    const neighborIndex = index === entries.length - 1 ? index - 1 : index + 1;
    const neighbor = entries[neighborIndex];
    const deltas = useful
      .map((range) => {
        const delta = valueOf(entry, range.dimension) - valueOf(neighbor, range.dimension);
        // A ordenação usa a fração da amplitude: cinco pontos numa dimensão
        // que varia seis valem mais do que cinco numa que varia vinte. O texto
        // mostra a diferença bruta, que é o que a pessoa lê nas notas.
        return { dimension: range.dimension, label: range.label, delta, weight: Math.abs(delta) / (range.amplitude || 1) };
      })
      .filter((item) => item.delta !== 0)
      .sort((left, right) => right.weight - left.weight);
    const gain = deltas.find((item) => item.delta > 0);
    const loss = deltas.find((item) => item.delta < 0);
    const neighborName = nameOf(neighbor);
    const reference = index === entries.length - 1 ? `#${neighborIndex + 1} ${neighborName}` : `#${neighborIndex + 1} ${neighborName}`;

    let sentence;
    if (!gain && !loss) sentence = `Empata com ${reference} em todas as dimensões que variam nesta shortlist.`;
    else if (gain && loss) sentence = `Frente a ${reference}: ganha em ${gain.label} (${gain.delta > 0 ? '+' : ''}${gain.delta}) e perde em ${loss.label} (${loss.delta}).`;
    else if (gain) sentence = `Frente a ${reference}: ganha em ${gain.label} (+${gain.delta}) sem perder em nenhuma outra.`;
    else sentence = `Frente a ${reference}: perde em ${loss.label} (${loss.delta}) sem ganhar em nenhuma outra.`;

    result.set(entry.candidate?.id, { sentence, neighborRank: neighborIndex + 1, gain: gain || null, loss: loss || null });
  });
  return result;
}

/**
 * Agrupa a shortlist pela forma das notas: cada candidato entra no grupo da
 * dimensão em que mais se destaca em relação à média da própria shortlist.
 * Escolher entre dois ou três perfis é mais simples do que comparar dez linhas.
 */
export function groupByProfile(entries = [], { threshold = DISCRIMINATION_THRESHOLD } = {}) {
  if (!entries.length) return [];
  const ranges = buildDimensionRanges(entries, { threshold });
  const useful = ranges.filter((range) => range.discriminates);
  if (!useful.length) {
    return [{ dimension: null, label: 'Perfis equivalentes', hint: 'nenhuma dimensão separa os candidatos desta shortlist', members: entries.map((entry, index) => ({ rank: index + 1, id: entry.candidate?.id, name: nameOf(entry) })) }];
  }
  const averages = Object.fromEntries(useful.map((range) => [range.dimension, entries.reduce((sum, entry) => sum + valueOf(entry, range.dimension), 0) / entries.length]));
  const groups = new Map();

  entries.forEach((entry, index) => {
    // O destaque é medido em fração da amplitude, para que uma dimensão com
    // faixa estreita não seja sempre vencida por uma de faixa larga.
    const leading = useful
      .map((range) => ({ dimension: range.dimension, score: (valueOf(entry, range.dimension) - averages[range.dimension]) / (range.amplitude || 1) }))
      .sort((left, right) => right.score - left.score)[0];
    const key = leading.dimension;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ rank: index + 1, id: entry.candidate?.id, name: nameOf(entry), edge: Math.round(leading.score * 100) / 100 });
  });

  return [...groups.entries()]
    .map(([dimension, members]) => ({ dimension, label: PROFILE_LABELS[dimension]?.label || DIMENSION_LABELS[dimension], hint: PROFILE_LABELS[dimension]?.hint || '', members }))
    .sort((left, right) => left.members[0].rank - right.members[0].rank);
}

/**
 * Combinação que cobre mais dimensões junta, para quem vai convidar mais de um.
 * Escolha gulosa: começa pelo primeiro do ranking e acrescenta quem mais eleva
 * o melhor resultado do conjunto nas dimensões que variam — em vez de repetir
 * três perfis parecidos.
 */
export function suggestCombination(entries = [], { size = 3, threshold = DISCRIMINATION_THRESHOLD } = {}) {
  const target = Math.min(size, entries.length);
  if (target < 2) return null;
  const ranges = buildDimensionRanges(entries, { threshold });
  const useful = ranges.filter((range) => range.discriminates);
  if (!useful.length) return null;

  const selected = [entries[0]];
  const best = Object.fromEntries(useful.map((range) => [range.dimension, valueOf(entries[0], range.dimension)]));
  const contributions = [{ entry: entries[0], rank: 1, adds: [] }];

  while (selected.length < target) {
    let winner = null;
    for (let index = 1; index < entries.length; index += 1) {
      const entry = entries[index];
      if (selected.includes(entry)) continue;
      const adds = useful
        .map((range) => ({ dimension: range.dimension, label: range.label, gain: valueOf(entry, range.dimension) - best[range.dimension] }))
        .filter((item) => item.gain > 0);
      const total = adds.reduce((sum, item) => sum + item.gain, 0);
      if (!winner || total > winner.total) winner = { entry, rank: index + 1, adds, total };
    }
    if (!winner || winner.total <= 0) break;
    selected.push(winner.entry);
    winner.adds.forEach((item) => { best[item.dimension] = valueOf(winner.entry, item.dimension); });
    contributions.push({ entry: winner.entry, rank: winner.rank, adds: winner.adds.sort((left, right) => right.gain - left.gain) });
  }

  if (contributions.length < 2) return null;
  return {
    members: contributions.map((item) => ({
      rank: item.rank,
      id: item.entry.candidate?.id,
      name: nameOf(item.entry),
      adds: item.adds.slice(0, 2).map((add) => ({ label: add.label, gain: add.gain })),
    })),
    dimensions: useful.map((range) => range.label),
  };
}

export function buildShortlistComparison(entries = [], options = {}) {
  return {
    version: SHORTLIST_COMPARISON_VERSION,
    ranges: buildDimensionRanges(entries, options),
    neighbors: compareWithNeighbor(entries, options),
    profiles: groupByProfile(entries, options),
    combination: suggestCombination(entries, options),
  };
}
