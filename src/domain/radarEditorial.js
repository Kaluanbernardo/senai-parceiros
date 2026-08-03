/**
 * Portuguese presentation layer for Radar items.
 *
 * Two things stand between a collected item and a reader: official gazettes
 * title their acts with a legal reference ("PORTARIA Nº 1.234, DE 15 DE JULHO
 * DE 2026"), which says nothing about what changed, and international sources
 * publish in English.
 *
 * Everything here is deterministic and runs on every read, so an item stored
 * before the editorial pass existed — or collected while the model was
 * unavailable — still reaches the interface in readable Portuguese. The
 * editorial pass in server/lib/radar/editorialService.js improves on this
 * baseline; it never replaces it.
 */

export const EDITORIAL_RULES_VERSION = 1;

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fold(value) {
  return safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldedKey(value) {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Function words carry the language of a sentence far more reliably than its
 * content words, which are frequently international ("marketing", "software")
 * or proper nouns. Both lists are folded, so they match text with or without
 * diacritics.
 */
const ENGLISH_MARKERS = new Set(['the', 'of', 'and', 'for', 'in', 'to', 'with', 'on', 'that', 'this', 'from', 'by', 'are', 'is', 'as', 'at', 'be', 'has', 'have', 'their', 'its', 'new', 'skills', 'training', 'education', 'labour', 'labor', 'work', 'workers', 'workforce', 'policy', 'policies', 'report', 'learning', 'development', 'european', 'national', 'youth', 'young', 'system', 'systems', 'support', 'between', 'how', 'why', 'what', 'which', 'will', 'can', 'should', 'about', 'across', 'through', 'toward', 'towards', 'countries', 'country', 'jobs', 'employment', 'vocational', 'apprenticeship', 'apprenticeships', 'framework', 'frameworks']);
const PORTUGUESE_MARKERS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para', 'com', 'que', 'uma', 'um', 'no', 'na', 'nos', 'nas', 'em', 'por', 'ao', 'aos', 'as', 'pelo', 'pela', 'sobre', 'como', 'entre', 'nao', 'sao', 'foi', 'sera', 'seu', 'sua', 'educacao', 'profissional', 'profissionais', 'formacao', 'trabalho', 'ensino', 'tecnico', 'tecnica', 'competencias', 'politica', 'publica', 'estadual', 'federal', 'aprendizagem', 'curso', 'cursos', 'escola', 'escolas']);

/**
 * Whether a fragment reads as English. Deliberately conservative: a single
 * English marker in a Portuguese sentence must not flip the verdict, because
 * the answer decides whether an item is sent for translation and whether a
 * generated text is accepted.
 */
/**
 * Whether a fragment carries Portuguese at all.
 *
 * Weaker than `isLikelyEnglish` and deliberately so: a translated academic title
 * keeps the field's canonical English term — "Vocational Education and Training
 * in Brazil: uma análise das políticas públicas" — and reads as English by
 * majority, even though it plainly was translated. When the question is "did
 * this come back in Portuguese", presence is the right test, not dominance.
 */
export function hasPortugueseMarkers(value) {
  return foldedKey(value).split(' ').filter(Boolean).some((word) => PORTUGUESE_MARKERS.has(word));
}

export function isLikelyEnglish(value) {
  const words = foldedKey(value).split(' ').filter(Boolean);
  if (words.length < 2) return false;
  const english = words.filter((word) => ENGLISH_MARKERS.has(word)).length;
  const portuguese = words.filter((word) => PORTUGUESE_MARKERS.has(word)).length;
  return english > 0 && english > portuguese;
}

/**
 * Crossref and OpenAlex report a work's type in their own controlled
 * vocabulary, which is English and closed. A glossary covers it exactly; an
 * unknown value is returned untouched rather than guessed at, since the value
 * is also a filter option.
 */
const CONTENT_TYPE_PT = {
  'journal-article': 'artigo científico',
  article: 'artigo',
  'posted-content': 'preprint',
  preprint: 'preprint',
  'book-chapter': 'capítulo de livro',
  book: 'livro',
  'book-part': 'parte de livro',
  'book-section': 'seção de livro',
  'edited-book': 'livro organizado',
  'reference-book': 'obra de referência',
  monograph: 'monografia',
  'proceedings-article': 'trabalho em congresso',
  proceedings: 'anais de congresso',
  dissertation: 'tese ou dissertação',
  thesis: 'tese ou dissertação',
  report: 'relatório',
  'report-component': 'parte de relatório',
  dataset: 'base de dados',
  review: 'revisão',
  'peer-review': 'parecer de revisão',
  'reference-entry': 'verbete de referência',
  standard: 'norma técnica',
  component: 'material complementar',
  paratext: 'material editorial',
  editorial: 'texto editorial',
  letter: 'carta científica',
  erratum: 'errata',
  grant: 'financiamento de pesquisa',
  other: 'outra publicação',
  news: 'notícia',
  'news-article': 'notícia',
  'press-release': 'comunicado à imprensa',
  publication: 'publicação',
  'working-paper': 'documento de trabalho',
  'policy-brief': 'nota de política pública',
  brief: 'nota técnica',
  blog: 'artigo de blog',
  event: 'evento',
};

export function translateContentType(value) {
  const source = safeText(value);
  if (!source) return source;
  return CONTENT_TYPE_PT[fold(source).replace(/\s+/g, '-')] || CONTENT_TYPE_PT[fold(source)] || source;
}

/**
 * Topics reach the radar from two places: the thematic markers this codebase
 * assigns, and OpenAlex topic names, which are open-ended English. The glossary
 * covers the recurring ones; the rest are left for the editorial pass, which
 * translates them in the same call that rewrites the item.
 */
const TOPIC_PT = {
  'vocational education and training': 'educação profissional e tecnológica',
  'vocational education': 'educação profissional',
  'vocational training': 'formação profissional',
  'vocational learning': 'aprendizagem profissional',
  'vocational skills': 'competências profissionais',
  'vocational excellence': 'excelência em educação profissional',
  'technical and vocational education': 'educação técnica e profissional',
  'technical and vocational education and training': 'educação profissional e tecnológica',
  'career and technical education': 'educação técnica e profissional',
  tvet: 'educação profissional (TVET)',
  vet: 'educação profissional (VET)',
  apprenticeship: 'aprendizagem profissional',
  apprenticeships: 'aprendizagem profissional',
  'work based learning': 'aprendizagem no trabalho',
  'workforce development': 'desenvolvimento da força de trabalho',
  'qualification frameworks': 'marcos nacionais de qualificação',
  'qualifications frameworks': 'marcos nacionais de qualificação',
  'skills development': 'desenvolvimento de competências',
  'skills policy': 'política de competências',
  'skills policies': 'política de competências',
  'skills system': 'sistema de competências',
  'skills systems': 'sistema de competências',
  'skills training': 'formação de competências',
  'lifelong learning': 'educação ao longo da vida',
  'continuing education': 'educação continuada',
  'higher education': 'ensino superior',
  'adult education': 'educação de adultos',
  'labour market': 'mercado de trabalho',
  'labor market': 'mercado de trabalho',
  employment: 'emprego',
  'youth employment': 'emprego juvenil',
  'artificial intelligence': 'inteligência artificial',
  'digital skills': 'competências digitais',
  digitalisation: 'digitalização',
  digitalization: 'digitalização',
  'green skills': 'competências verdes',
  'green transition': 'transição verde',
  sustainability: 'sustentabilidade',
  manufacturing: 'indústria de transformação',
  industry: 'indústria',
  innovation: 'inovação',
  curriculum: 'currículo',
  training: 'formação',
  education: 'educação',
  skills: 'competências',
  certification: 'certificação',
  'recognition of prior learning': 'reconhecimento de saberes',
};

export function translateTopic(value) {
  const source = safeText(value);
  if (!source) return source;
  return TOPIC_PT[foldedKey(source)] || source;
}

export function translateTopics(values) {
  const translated = (Array.isArray(values) ? values : [])
    .map((value) => translateTopic(value))
    .filter(Boolean);
  return [...new Set(translated)];
}

/**
 * Acronyms that must survive the case rewrite below; every other word in a
 * shouted title is prose that reads better in lower case.
 */
const ACRONYMS = new Set(['mec', 'setec', 'inep', 'cne', 'cp', 'ceb', 'ces', 'senai', 'senac', 'sesi', 'sesc', 'senar', 'senat', 'sest', 'sebrae', 'if', 'ifsp', 'cefet', 'ept', 'vet', 'tvet', 'sp', 'dou', 'doe', 'fic', 'cbo', 'enem', 'encceja', 'pronatec', 'sisu', 'prouni', 'fies', 'cps', 'etec', 'fatec', 'ldb', 'cnpq', 'capes', 'fapesp', 'ibge', 'oit', 'ilo', 'ocde', 'oecd', 'unesco', 'unevoc', 'cedefop', 'etf', 'ue', 'mtp', 'mte']);

function restoreAcronyms(token) {
  const parts = token.split('/');
  const known = parts.every((part) => ACRONYMS.has(foldedKey(part).replace(/\s+/g, '')));
  return known && foldedKey(token) ? token.toLocaleUpperCase('pt-BR') : token;
}

function shoutedToSentenceCase(value) {
  const letters = value.match(/\p{L}/gu)?.length || 0;
  const uppercase = value.match(/\p{Lu}/gu)?.length || 0;
  if (letters < 8 || uppercase / letters < 0.6) return value;
  const lowered = value.toLocaleLowerCase('pt-BR')
    .replace(/\bn[º°o]\b\.?/g, 'nº');
  const restored = lowered.replace(/\p{L}[\p{L}\p{N}/.-]*/gu, (token) => restoreAcronyms(token));
  return restored.replace(/\p{L}/u, (first) => first.toLocaleUpperCase('pt-BR'));
}

/**
 * Gazette listings publish act titles in full upper case. Shouting is not
 * information, and it is the first thing that makes an official act look
 * unreadable next to a news headline, so a shouted title is rewritten to
 * sentence case. Text the source already published in mixed case is left
 * exactly as it is.
 *
 * Shouting is judged per segment, not over the whole string. The DOU composes a
 * title as "<referência do ato> — <trecho que o qualificou>", and the excerpt is
 * ordinary prose: measured over the whole title it diluted the reference below
 * the threshold, so the act stayed shouted in exactly the common case this rule
 * exists for.
 */
export function readableTitleCase(value) {
  const source = safeText(value);
  if (!source) return source;
  return source
    .split(/(\s+[—–-]\s+)/)
    .map((segment) => (/^\s+[—–-]\s+$/.test(segment) ? segment : shoutedToSentenceCase(segment)))
    .join('');
}

const THEME_PREFIX = /^rela[çc][ãa]o com (?:a )?(?:educa[çc][ãa]o profissional|vet|ept)\s*:\s*/i;

/**
 * The excerpt that justified an item's inclusion is evidence, not an
 * explanation. Keeping the prefix out of the model input stops the generated
 * summary from being a paraphrase of our own label.
 */
export function stripEvidencePrefix(value) {
  return safeText(value).replace(THEME_PREFIX, '').trim();
}

export function displayTitleFor(item) {
  return safeText(item?.editorialTitle) || readableTitleCase(safeText(item?.title));
}

export function displaySummaryFor(item) {
  return safeText(item?.editorialSummary) || safeText(item?.summaryPt);
}

/**
 * True when a stored item still shows the source's own wording where an
 * editorial rewrite is expected: an official act, or any text that reads as
 * English. Used both to pick what to send to the model and to tell the
 * interface that what it is showing is the raw source.
 */
export function needsEditorialTreatment(item) {
  if (!item) return false;
  if (safeText(item.editorialTitle) && safeText(item.editorialSummary)) return false;
  if (isOfficialAct(item)) return true;
  // The abstract counts as visible text. A paper whose source published no
  // usable summary falls back to a Portuguese sentence saying so, and that
  // sentence was the only thing inspected besides the title: an English paper
  // whose title alone was too short for the detector never entered the queue at
  // all, which is why Crossref and OpenAlex lagged behind every other source.
  return isLikelyEnglish(item.title)
    || isLikelyEnglish(stripEvidencePrefix(item.summaryPt))
    || isLikelyEnglish(item.abstractText);
}

const OFFICIAL_ACT_SOURCES = new Set(['diario oficial da uniao', 'diario oficial do estado de sao paulo']);

export function isOfficialAct(item) {
  return OFFICIAL_ACT_SOURCES.has(foldedKey(item?.sourceName).replace(/\s+/g, ' '))
    || /\bato oficial\b/.test(fold(item?.contentType));
}
