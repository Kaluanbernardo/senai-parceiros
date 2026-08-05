/**
 * Justificativa em linguagem natural de por que um candidato foi indicado.
 *
 * O texto anterior era montado com fragmentos normalizados dos termos que
 * casaram — "Aderência sustentada por docente, trabalho, formacao,
 * profissional" — e por isso soava aleatório: aquilo é a saída interna do
 * algoritmo, não uma explicação. Pior, ignorava os campos que descrevem o que
 * a pessoa de fato faz (áreas, pesquisa, instituição, citações, artigos).
 *
 * Aqui cada frase nasce de um fato verificável do cadastro e é escrita como
 * alguém explicaria a um colega. Quando não há fato que sustente, a frase diz
 * isso — em vez de inventar aderência.
 */

import { fold } from './senaiContext.js';

export const CANDIDATE_EXPLANATION_VERSION = 'candidate-explanation-v1';

const OBJECTIVE_FIT = Object.freeze({
  speaker: { need: 'levar o assunto a um público', good: 'produção pública para sustentar uma fala' },
  project_partner: { need: 'construir algo em conjunto', good: 'experiência aplicada para tocar um projeto' },
  benchmark: { need: 'servir de referência comparável', good: 'prática documentada que dá para comparar' },
  research_support: { need: 'apoiar uma pesquisa', good: 'produção acadêmica verificável' },
  guided: { need: 'contribuir com a iniciativa', good: 'perfil compatível com o que você descreveu' },
});

/** "a", "a e b", "a, b e c" */
export function sentenceList(items = [], conjunction = 'e') {
  const list = items.filter(Boolean).map(String);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${list.at(-1)}`;
}

function firstClause(text, max = 160) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const clause = value.split(/(?<=\.)\s/)[0] || value;
  return clause.length > max ? `${clause.slice(0, max - 1).trim()}…` : clause;
}

function lower(text) {
  const value = String(text || '');
  return value ? value[0].toLocaleLowerCase('pt-BR') + value.slice(1) : value;
}

/** Frases do usuário que aparecem literalmente no perfil público. */
export function matchedPhrases(candidateText, phrases = []) {
  const haystack = fold(candidateText);
  return phrases
    .map((phrase) => String(phrase || '').trim())
    .filter((phrase) => phrase.length > 3)
    .filter((phrase) => {
      const words = fold(phrase).split(/[^a-z0-9]+/).filter((word) => word.length > 3);
      // A frase conta como presente quando as palavras que a caracterizam
      // aparecem no perfil — "educação profissional" casa "educacao
      // profissional" mesmo escrito de outra forma.
      return words.length > 0 && words.every((word) => haystack.includes(word.slice(0, Math.max(5, word.length - 2))));
    });
}

/**
 * O que o cadastro diz que a pessoa ou instituição faz.
 *
 * `areas` costuma ser uma lista de palavras-chave ("Professores de VET,
 * Qualidade") e precisa de uma introdução para virar frase; `pesquisa` e
 * `descricao` já são texto corrido e entram como estão.
 */
function headlineFor(candidate) {
  const where = [candidate.instituicao, candidate.pais].filter(Boolean).join(' · ');
  const areas = firstClause(candidate.areas, 110);
  const prose = firstClause(candidate.pesquisa || candidate.diferencial || candidate.descricao, 130);
  const what = areas ? `Atua em ${lower(areas)}` : prose;
  if (what && where) return `${what} — ${where}.`;
  if (what) return `${what}.`;
  if (where) return `${where}.`;
  return 'O cadastro não descreve a área de atuação.';
}

function numericCitations(value) {
  const match = String(value || '').replace(/\./g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/**
 * Monta a justificativa.
 *
 * @param {object} input
 * @param {object} input.candidate registro do catálogo
 * @param {object} input.profile contexto interpretado da entrevista
 * @param {object} input.matches taxonomias em comum já calculadas na pontuação
 * @param {object} input.dimensions notas finais por dimensão
 * @param {object} input.partnership situação da relação com o SENAI
 */
export function explainCandidate({ candidate, profile, matches, dimensions, partnership, text }) {
  const objective = OBJECTIVE_FIT[profile.objective] || OBJECTIVE_FIT.guided;
  const phrases = matchedPhrases(text, profile.themePhrases || []);
  const priorities = (matches.priorities || []).map((item) => item.short || item.label);
  const audiences = (matches.audiences || []).map((item) => item.short || item.label);
  const contributions = (matches.contributions || []).map((item) => item.short || item.label);
  const citations = numericCitations(candidate.citacoes);
  const articles = Array.isArray(candidate.artigos) ? candidate.artigos.length : 0;
  const why = [];
  const against = [];

  // 1. O tema — o motivo principal de alguém entrar numa shortlist.
  //
  // Só afirma aderência ao pedido quando ela existe. Antes, se o usuário não
  // nomeasse nenhuma prioridade, o código usava o baseline institucional e
  // dizia "agenda que o seu pedido toca de perto" mesmo para uma resposta sem
  // sentido — inventando uma relação que nunca foi pedida.
  if (phrases.length) {
    why.push(`O perfil público trata de ${sentenceList(phrases.slice(0, 3))}, exatamente ${phrases.length > 1 ? 'os temas que' : 'o tema que'} você pediu.`);
  } else if (priorities.length && profile.prioritiesFromUser) {
    why.push(`Atua em ${sentenceList(priorities.slice(0, 2))}, que é o que você pediu.`);
  } else if (matches.themeMatches > 0) {
    why.push('O perfil público usa parte dos termos que você escreveu, ainda que não trate exatamente do mesmo recorte.');
  } else {
    why.push('Nada no perfil público liga esta pessoa ao que você descreveu: não há base para indicá-la para este pedido.');
  }

  // 2. A evidência que sustenta a indicação.
  const evidence = [];
  if (citations) evidence.push(`${citations.toLocaleString('pt-BR')} citações`);
  if (articles) evidence.push(`${articles} ${articles === 1 ? 'artigo listado' : 'artigos listados'}`);
  if (candidate.scholar) evidence.push('perfil acadêmico público');
  if (candidate.website) evidence.push('site institucional');
  if (evidence.length) why.push(`A indicação se apoia em ${sentenceList(evidence)} — dá para conferir antes de falar com a pessoa.`);
  else against.push('Não há fonte pública ligada ao registro: confirme os dados antes de usar esta indicação.');

  // 3. Adequação ao que você quer fazer.
  if (partnership?.confirmed) {
    why.push(`Já existe relação com o SENAI, o que encurta o caminho para ${objective.need}.`);
  } else if (dimensions.alignment >= 60 || dimensions.impact >= 75) {
    why.push(`Tem ${objective.good}, que é o que este objetivo exige.`);
  }

  // 4. Público, quando o usuário nomeou um.
  if (audiences.length && (profile.audiences || []).length) {
    why.push(`O trabalho dialoga com ${sentenceList(audiences.slice(0, 2))}, o público que você indicou.`);
  }

  // O que pesa contra — dito sem rodeio, porque é o que evita um convite ruim.
  const geographyScore = matches.geographyScore;
  if (Number.isFinite(geographyScore) && geographyScore < 65 && candidate.pais) {
    // Evita a preposição ("está em Austrália"): o país entra entre parênteses.
    against.push(`Fica fora da preferência geográfica que você indicou (${candidate.pais}) — verifique se a participação remota resolve.`);
  }
  if (!partnership?.confirmed) {
    against.push('Não há parceria registrada com o SENAI: o primeiro contato precisa ser construído do zero.');
  }
  if (!phrases.length && priorities.length && profile.prioritiesFromUser) {
    against.push('A aderência vem do tema geral, não das palavras exatas que você usou — vale confirmar se o recorte é o mesmo.');
  }
  if (!profile.prioritiesFromUser && !phrases.length) {
    against.push('Suas respostas não indicaram temas reconhecíveis, então esta indicação não pôde ser checada contra o que você pediu.');
  }
  if (!contributions.length && (profile.contributions || []).length) {
    against.push('O cadastro não diz se a pessoa oferece o tipo de contribuição que você procura.');
  }

  return {
    version: CANDIDATE_EXPLANATION_VERSION,
    headline: headlineFor(candidate),
    why: why.slice(0, 4),
    against: against.slice(0, 3),
  };
}
