import { describe, expect, it } from 'vitest';
import {
  displaySummaryFor,
  displayTitleFor,
  isLikelyEnglish,
  isOfficialAct,
  needsEditorialTreatment,
  readableTitleCase,
  stripEvidencePrefix,
  translateContentType,
  translateTopic,
  translateTopics,
} from './radarEditorial.js';

describe('isLikelyEnglish', () => {
  it('recognises an English headline from an international source', () => {
    expect(isLikelyEnglish('New apprenticeship policy for advanced manufacturing')).toBe(true);
    expect(isLikelyEnglish('Vocational skills expand youth employment')).toBe(true);
  });

  it('does not flag Portuguese that happens to carry a technical term', () => {
    expect(isLikelyEnglish('Portaria institui itinerário formativo de educação profissional')).toBe(false);
    expect(isLikelyEnglish('Cedefop publica relatório sobre competências digitais na indústria')).toBe(false);
  });

  it('stays silent on fragments too short to decide', () => {
    expect(isLikelyEnglish('Skills')).toBe(false);
    expect(isLikelyEnglish('')).toBe(false);
  });
});

describe('translateContentType', () => {
  it('translates the closed vocabulary Crossref and OpenAlex report', () => {
    expect(translateContentType('journal-article')).toBe('artigo científico');
    expect(translateContentType('posted-content')).toBe('preprint');
    expect(translateContentType('book-chapter')).toBe('capítulo de livro');
  });

  it('leaves an unknown or already translated value untouched', () => {
    expect(translateContentType('ato oficial')).toBe('ato oficial');
    expect(translateContentType('artigo científico')).toBe('artigo científico');
  });
});

describe('translateTopic', () => {
  it('translates English topic names into the vocabulary of the radar', () => {
    expect(translateTopic('Vocational Education and Training')).toBe('educação profissional e tecnológica');
    expect(translateTopic('TVET')).toBe('educação profissional (TVET)');
    expect(translateTopic('work-based learning')).toBe('aprendizagem no trabalho');
  });

  it('collapses topics that translate to the same Portuguese term', () => {
    expect(translateTopics(['apprenticeship', 'apprenticeships', 'EPT'])).toEqual(['aprendizagem profissional', 'EPT']);
  });
});

describe('readableTitleCase', () => {
  it('rewrites a shouted gazette title without losing its acronyms', () => {
    expect(readableTitleCase('PORTARIA SETEC/MEC Nº 1.234, DE 15 DE JULHO DE 2026'))
      .toBe('Portaria SETEC/MEC nº 1.234, de 15 de julho de 2026');
  });

  it('leaves a title the source already published in mixed case exactly as it is', () => {
    const title = 'Cedefop divulga estudo sobre competências verdes';
    expect(readableTitleCase(title)).toBe(title);
  });

  it('rewrites the act reference even when an excerpt is appended to it', () => {
    // The DOU composes "<act reference> — <evidence excerpt>" whenever the act's
    // own title does not carry the theme, which is the common case. Judging the
    // whole string let the excerpt dilute the reference below the threshold, so
    // the act stayed shouted exactly where this rule was needed.
    expect(readableTitleCase('PORTARIA SETEC/MEC Nº 1.234, DE 15 DE JULHO DE 2026 — Institui o programa de apoio à oferta de cursos técnicos.'))
      .toBe('Portaria SETEC/MEC nº 1.234, de 15 de julho de 2026 — Institui o programa de apoio à oferta de cursos técnicos.');
  });

  it('rewrites both segments when the excerpt is shouted too', () => {
    expect(readableTitleCase('RESOLUÇÃO CNE/CP Nº 1, DE 5 DE JANEIRO DE 2026 — DISPÕE SOBRE AS DIRETRIZES CURRICULARES'))
      .toBe('Resolução CNE/CP nº 1, de 5 de janeiro de 2026 — Dispõe sobre as diretrizes curriculares');
  });
});

describe('display fields', () => {
  it('prefers the editorial rewrite and falls back to the readable source title', () => {
    expect(displayTitleFor({ title: 'RESOLUÇÃO Nº 2, DE 3 DE MARÇO DE 2026', editorialTitle: 'Novas regras para cursos técnicos na rede federal' }))
      .toBe('Novas regras para cursos técnicos na rede federal');
    expect(displayTitleFor({ title: 'RESOLUÇÃO Nº 2, DE 3 DE MARÇO DE 2026' }))
      .toBe('Resolução nº 2, de 3 de março de 2026');
  });

  it('falls back to the collected summary when no editorial summary exists', () => {
    expect(displaySummaryFor({ summaryPt: 'Relação com educação profissional: institui o curso.' }))
      .toBe('Relação com educação profissional: institui o curso.');
    expect(displaySummaryFor({ summaryPt: 'texto da fonte', editorialSummary: 'A portaria cria vagas em cursos técnicos.' }))
      .toBe('A portaria cria vagas em cursos técnicos.');
  });
});

describe('stripEvidencePrefix', () => {
  it('removes the label the collector prepends to the evidence excerpt', () => {
    expect(stripEvidencePrefix('Relação com educação profissional: institui o programa.')).toBe('institui o programa.');
    expect(stripEvidencePrefix('Institui o programa.')).toBe('Institui o programa.');
  });
});

describe('needsEditorialTreatment', () => {
  const act = { sourceName: 'Diário Oficial da União', contentType: 'ato oficial', title: 'PORTARIA Nº 1, DE 2 DE JANEIRO DE 2026', summaryPt: 'Relação com educação profissional: institui.' };

  it('marks an official act that still shows the source wording', () => {
    expect(isOfficialAct(act)).toBe(true);
    expect(needsEditorialTreatment(act)).toBe(true);
  });

  it('clears an act once it carries both editorial fields', () => {
    expect(needsEditorialTreatment({ ...act, editorialTitle: 'Novas vagas em cursos técnicos', editorialSummary: 'A portaria autoriza a oferta de cursos técnicos em três institutos federais.' })).toBe(false);
  });

  it('marks any item whose visible text is English', () => {
    expect(needsEditorialTreatment({ sourceName: 'Cedefop', title: 'Skills forecast for the green transition', summaryPt: 'Report on skills and training in Europe.' })).toBe(true);
  });

  it('leaves a Portuguese institutional item alone', () => {
    expect(needsEditorialTreatment({ sourceName: 'MEC / SETEC', title: 'MEC amplia oferta de cursos técnicos', summaryPt: 'Relação com educação profissional: o ministério amplia a oferta de cursos técnicos.' })).toBe(false);
  });
});
