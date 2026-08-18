import crypto from 'node:crypto';
import { normalizeRadarItem } from '../../../src/domain/radar.js';
import { EDITORIAL_RULES_VERSION, editorialIsGrounded, hasPortugueseMarkers, isLikelyEnglish, isOfficialAct, needsEditorialTreatment, stripEvidencePrefix } from '../../../src/domain/radarEditorial.js';
import { generateStructured } from '../structuredGeneration.js';
import { sanitizeProviderError } from './contracts.js';
import { canUseAi, getUsageBudget, recordAiUsageAtomic } from '../usageBudget.js';

/**
 * Editorial rewriting for Radar items.
 *
 * An official act arrives titled "PORTARIA Nº 1.234, DE 15 DE JULHO DE 2026"
 * and summarised by the clause that matched our thematic filter. Both are
 * faithful to the source and neither tells a reader what changed, for whom.
 * This pass produces a plain-language headline and a two-to-three sentence
 * explanation, and translates whatever the source published in English.
 *
 * It is not an enrichment: an item that reaches a reader in the source's own
 * wording is indistinguishable from an item that needed no rewrite, so the
 * degradation is invisible. Any failure here fails the run instead, and items
 * this run did not reach are held back from the snapshot by the caller.
 */

const EDITORIAL_BATCH_SIZE = 6;
const DEFAULT_MAX_ITEMS_PER_RUN = 48;
// Six translated titles plus explanatory summaries can legitimately exceed the
// old 1,200-token ceiling. This is only a maximum: a complete shorter response
// stops normally and is billed for what it actually used.
const EDITORIAL_MAX_OUTPUT_TOKENS = 4000;
/**
 * Bumped whenever the acceptance rules change. An item whose stored editorial is
 * missing one of its two halves was refused by the rules of its day, and without
 * this it would never be offered again: `editorialStatus` is already 'ai', so it
 * had left the queue for good — half translated, permanently. Kept out of the
 * input hash on purpose, so relaxing a rule retries only what was refused
 * instead of re-running the hundreds of items that already came out whole.
 */
const EDITORIAL_VALIDATION_VERSION = 5;
const DEFAULT_DEADLINE_MS = 25_000;
// A provider request needs its own ceiling. Checking the run deadline only
// before `fetch` cannot help once an upstream model stalls, and Vercel then
// terminates the function before completed batches reach durable storage.
const DEFAULT_BATCH_TIMEOUT_MS = 20_000;
const DEFAULT_DEADLINE_BUFFER_MS = 5_000;
const MAX_SOURCE_TEXT = 900;
const MAX_OFFICIAL_SOURCE_TEXT = 2200;

const EDITORIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      minItems: 1,
      maxItems: EDITORIAL_BATCH_SIZE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'summary', 'topics'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const itemId = (item) => String(item?.externalId || item?.id || '');

function sourceTextFor(item) {
  const contextual = isOfficialAct(item) ? String(item?.sourceContext || '') : '';
  const text = contextual || stripEvidencePrefix(item?.summaryPt) || String(item?.abstractText || '');
  const limit = isOfficialAct(item) ? MAX_OFFICIAL_SOURCE_TEXT : MAX_SOURCE_TEXT;
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function editorialInputHash(item) {
  return crypto.createHash('sha256')
    .update([EDITORIAL_RULES_VERSION, itemId(item), String(item?.title || ''), sourceTextFor(item), (item?.topics || []).join('|')].join('\n'))
    .digest('hex');
}

/**
 * Serves the queue a section at a time instead of draining it in priority order.
 *
 * Strict priority starved whole sections: production accumulated hundreds of
 * state-gazette acts, they filled the quota on every single run, and the
 * research tab was never reached at all.
 *
 * Shares of the per-run quota. Research carries the heaviest backlog by far —
 * every OpenAlex and Crossref item is published in English, while government
 * sources are already in Portuguese and only need the act rewritten — so it
 * takes half the quota instead of a third.
 */
const SECTION_SHARE = { research: 2, government: 1, international: 1 };

function interleaveBySection(items) {
  const bySection = new Map();
  for (const item of items) {
    const section = item.section || 'other';
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section).push(item);
  }
  const queues = [...bySection.entries()]
    .map(([section, queue]) => ({ queue, share: SECTION_SHARE[section] || 1, cursor: 0 }))
    .sort((left, right) => right.share - left.share);
  const ordered = [];
  for (let advanced = true; advanced;) {
    advanced = false;
    for (const entry of queues) {
      for (let taken = 0; taken < entry.share && entry.cursor < entry.queue.length; taken += 1) {
        ordered.push(entry.queue[entry.cursor]);
        entry.cursor += 1;
        advanced = true;
      }
    }
  }
  return ordered;
}

function needsAnotherAttempt(item) {
  if (item?.editorialStatus !== 'ai') return true;
  if (safeEditorial(item.editorialTitle) && safeEditorial(item.editorialSummary)) return false;
  return Number(item?.editorialProvenance?.validationVersion || 0) < EDITORIAL_VALIDATION_VERSION;
}

const safeEditorial = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * An official act is the case this pass exists for, and the budget is finite,
 * so gazettes are rewritten before anything else and English-language items
 * before Portuguese ones — within their own section.
 */
export function editorialPriority(item) {
  if (isOfficialAct(item)) return 0;
  if (isLikelyEnglish(item?.title) || isLikelyEnglish(sourceTextFor(item))) return 1;
  return 2;
}

function editorialMode(item) {
  if (isOfficialAct(item)) return 'dou';
  // A paper's title is its citation. Translating it keeps the item readable
  // without inventing a headline the literature cannot be searched by.
  return item?.section === 'research' ? 'traducao' : 'editorial';
}

function editorialMessages(items) {
  return [
    {
      role: 'system',
      content: [
        'Você reescreve itens do Radar de educação profissional para leitores que não são especialistas em legislação nem em pesquisa acadêmica.',
        'Responda sempre em português do Brasil, mesmo quando o texto recebido estiver em inglês.',
        'Para modo "dou": troque a referência legal por um título de até 110 caracteres que diga qual decisão foi tomada. Depois explique o ato em duas a quatro frases: o que ele determina, quem é afetado, quais condições ou prazos são informados e qual é o efeito prático. Omita qualquer parte que a fonte não permita responder.',
        'Para modo "editorial": escreva um título de até 110 caracteres dizendo o que o documento faz e para quem, sem começar por número de ato, e um resumo de duas a três frases explicando em linguagem simples o que muda na prática.',
        'Para modo "traducao": traduza fielmente o título completo do estudo, sem abreviar nem transformá-lo em manchete, e escreva um resumo de duas a três frases em linguagem simples sobre o que o trabalho investiga e o que encontrou.',
        'Não use jargão jurídico ou acadêmico; se um termo técnico for indispensável, explique-o na mesma frase.',
        'Use somente as informações recebidas. Nunca invente prazos, valores, números, vagas ou efeitos.',
        'O SENAI-SP é o público do produto, não uma informação da fonte: nunca diga que um ato é do, para, voltado a, conveniado com ou recomendado ao SENAI-SP ou ao SESI sem que isso esteja explicitamente no texto recebido.',
        'Se o texto recebido não permitir dizer o que muda, diga o que o documento é e sobre o que trata, sem especular.',
        'Em "topics", devolva os temas recebidos traduzidos para o português, na mesma ordem e na mesma quantidade, sem acrescentar nem remover temas.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(items.map((item) => ({
        id: itemId(item),
        modo: editorialMode(item),
        tipo: item.contentType || 'publicação',
        fonte: item.sourceName,
        data: item.publishedAt || 'sem data informada',
        titulo: item.title,
        texto: sourceTextFor(item),
        temas: item.topics || [],
      }))),
    },
  ];
}

function cleanText(value, max) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function folded(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * A generated headline that opens with the act's own reference reproduces the
 * problem this pass was added to solve, so it is rejected rather than stored.
 */
const ACT_REFERENCE_OPENING = /^\S{2,24}\s+n[ºo°]?\s*[\d.]+/i;

const HEADLINE_TITLE_MAX = 140;
const TRANSLATED_TITLE_MAX = 300;

/**
 * A paper's title is translated, not rewritten into a headline, and academic
 * titles routinely run past the length a headline should ever have. Judging both
 * by the same cap silently discarded correct translations — which is how the
 * summaries came back in Portuguese while the titles above them did not.
 */
export function editorialTitleLimit(item) {
  return item?.section === 'research' ? TRANSLATED_TITLE_MAX : HEADLINE_TITLE_MAX;
}

export function validateEditorialTitle(value, item = {}) {
  const limit = editorialTitleLimit(item);
  const title = cleanText(value, limit + 40);
  if (title.length < 12 || title.length > limit) return false;
  const unchanged = folded(title) === folded(item.title);
  // A Portuguese paper may enter the pass because only its abstract needs a
  // rewrite. Keeping its already-Portuguese title is a valid faithful
  // translation; official acts and foreign titles must still change.
  if (unchanged && !(item?.section === 'research' && hasPortugueseMarkers(item.title))) return false;
  if (item?.section === 'research') {
    // Translated titles keep the field's canonical English terms, so demanding
    // that the whole string not read as English rejected the very translations
    // this pass exists to produce. What must hold is that it is no longer the
    // source's own title and that it came back carrying Portuguese.
    return hasPortugueseMarkers(title);
  }
  if (ACT_REFERENCE_OPENING.test(title)) return false;
  return !isLikelyEnglish(title);
}

export function validateEditorialSummary(value, item = {}) {
  const summary = cleanText(value, 1200);
  if (summary.length > 1000) return false;
  if (summary.split(/\s+/).filter(Boolean).length < 12) return false;
  if (folded(summary) === folded(item.title)) return false;
  return !isLikelyEnglish(summary);
}

function applyGenerated(items, generated) {
  const byId = new Map((generated.data?.items || []).map((entry) => [String(entry.id), entry]));
  return items.map((item) => {
    const entry = byId.get(itemId(item));
    if (!entry) return item;
    const title = validateEditorialTitle(entry.title, item) && editorialIsGrounded(item, entry.title, '') ? cleanText(entry.title, editorialTitleLimit(item)) : null;
    const summary = validateEditorialSummary(entry.summary, item) && editorialIsGrounded(item, '', entry.summary) ? cleanText(entry.summary, 1000) : null;
    // A card is only finished when both halves are safe. Accepting just the
    // summary permanently left some studies with an English title because the
    // item was already marked as AI-processed and left the queue.
    if (!title || !summary) return item;
    // Topics are replaced only when the model returned exactly the list it was
    // given, translated. A different length means it added or dropped a theme,
    // and a theme is also a filter option.
    const translatedTopics = Array.isArray(entry.topics) ? entry.topics.map((topic) => cleanText(topic, 80)).filter(Boolean) : [];
    const topics = translatedTopics.length === (item.topics || []).length ? translatedTopics : item.topics;
    return normalizeRadarItem({
      ...item,
      topics,
      originalTitle: item.originalTitle || item.title,
      editorialTitle: title,
      editorialSummary: summary,
      editorialStatus: 'ai',
      editorialInputHash: editorialInputHash(item),
      editorialUpdatedAt: new Date().toISOString(),
      editorialProvenance: { provider: generated.trace.provider, model: generated.trace.model, rulesVersion: EDITORIAL_RULES_VERSION, validationVersion: EDITORIAL_VALIDATION_VERSION },
    });
  });
}

/**
 * Rewriting is expensive and the source text of an item does not change between
 * runs, so a stored editorial is reused whenever the input that produced it is
 * still the input we would send today.
 */
function reuseStoredEditorials(items, previousItems) {
  const stored = new Map((Array.isArray(previousItems) ? previousItems : [])
    .filter((item) => item.editorialStatus === 'ai' && item.editorialInputHash && editorialIsGrounded(item))
    .map((item) => [itemId(item), item]));
  // Every item leaves this pass normalized, rewritten or not: the display
  // fields the interface reads are derived there, and a caller must never have
  // to know which items the model happened to reach.
  return items.map((item) => {
    const previous = stored.get(itemId(item));
    if (!previous || previous.editorialInputHash !== editorialInputHash(item)) return normalizeRadarItem(item);
    return normalizeRadarItem({
      ...item,
      topics: previous.topics?.length ? previous.topics : item.topics,
      originalTitle: item.originalTitle || item.title,
      editorialTitle: previous.editorialTitle,
      editorialSummary: previous.editorialSummary,
      editorialStatus: 'ai',
      editorialInputHash: previous.editorialInputHash,
      editorialUpdatedAt: previous.editorialUpdatedAt,
      editorialProvenance: previous.editorialProvenance,
    });
  });
}

function providerEnabled() {
  const configured = String(process.env.RADAR_EDITORIAL_PROVIDER ?? process.env.RADAR_SUMMARY_PROVIDER ?? '').trim().toLowerCase();
  return Boolean(configured) && !['false', 'off', '0', 'none'].includes(configured);
}

/**
 * A model that ignores the strict schema, or whose output fails validation,
 * produces exactly the same visible result as a run with nothing to rewrite:
 * every item keeps the source's wording. Counting both outcomes is what lets an
 * operator tell "the model is not honouring the contract" from "there was
 * nothing to do" — the two have very different fixes.
 */
function emptyStats() {
  return { pending: 0, candidates: 0, reused: 0, batches: 0, rewritten: 0, rejected: 0, failedBatches: 0, deadlineReached: false, budgetExceeded: false, errors: [] };
}

export async function editorializeRadarItems(items = [], { previousItems = [], deadlineAt: runDeadlineAt = null } = {}) {
  const result = reuseStoredEditorials(Array.isArray(items) ? items : [], previousItems);
  const stats = emptyStats();
  stats.reused = result.filter((item) => item.editorialStatus === 'ai').length;
  const maxItems = Math.max(0, Number(process.env.RADAR_EDITORIAL_MAX_ITEMS || DEFAULT_MAX_ITEMS_PER_RUN));
  // The whole backlog, before the per-run cap. Reporting only the capped slice
  // made a run that filled its quota look like a run that finished the queue:
  // the caller saw nothing left to do and stopped, leaving every item beyond the
  // cap with the source's own wording. Official acts sort first, so on a
  // snapshot with hundreds of them the research items were never reached.
  // Served in the order a reader meets them: the interface sorts by publication
  // date descending, so the top of every tab is what a person actually sees, and
  // it must be the first thing fixed. Ordering by kind instead fought that —
  // state-gazette acts from March were rewritten ahead of an August paper, and
  // the visible top of the list stayed in the source's wording through run after
  // run. Kind now only breaks ties between items published the same day.
  const pending = interleaveBySection(result
    .filter((item) => needsAnotherAttempt(item) && needsEditorialTreatment(item) && (item.title || item.summaryPt))
    .sort((left, right) => String(right.publishedAt || '').localeCompare(String(left.publishedAt || ''))
      || editorialPriority(left) - editorialPriority(right)));
  const candidates = pending.slice(0, maxItems);
  stats.pending = pending.length;
  stats.candidates = candidates.length;
  // Um run sem nada a reescrever e um run bem-sucedido: nenhum item chegaria ao
  // leitor com o texto cru da fonte. Só quando ha fila e que a ausencia de
  // provedor deixa de ser irrelevante e passa a ser falha.
  if (!pending.length) return { items: result, stats: { ...stats, enabled: providerEnabled(), pendingBeyondRun: 0 } };
  if (!providerEnabled()) throw new Error('radar_editorial_provider_disabled');
  if (!canUseAi('radar-editorial')) {
    const error = new Error('radar_editorial_budget_exceeded');
    error.budget = getUsageBudget('radar-editorial');
    throw error;
  }
  const byId = new Map(result.map((item, index) => [itemId(item), index]));
  // This pass runs after every collector and before the snapshot is written, so
  // time spent here is time the write may not get. A serverless function killed
  // mid-rewrite loses the whole run — every source collected, not just the
  // rewrites — so the pass stops starting batches well before that, and the
  // items it did not reach simply keep the source's wording until next time.
  //
  // The caller's deadline is what the platform actually enforces, so it wins
  // outright when supplied. Taking the tighter of the two capped the standalone
  // rewrite — which has no collection ahead of it and the whole budget to spend
  // — at the 25s meant for the tail of a collection, cutting its throughput in
  // half for no reason. The own budget remains the default for callers that pass
  // no deadline at all.
  const deadlineAt = Number(runDeadlineAt)
    || Date.now() + Math.max(1000, Number(process.env.RADAR_EDITORIAL_DEADLINE_MS || DEFAULT_DEADLINE_MS));
  const configuredBufferMs = Math.max(0, Number(process.env.RADAR_EDITORIAL_DEADLINE_BUFFER_MS || DEFAULT_DEADLINE_BUFFER_MS));
  const availableAtStart = Math.max(0, deadlineAt - Date.now());
  // Tiny test/local budgets should still get a chance to run; the production
  // buffer applies when the caller actually granted enough time to preserve it.
  const deadlineBufferMs = availableAtStart > configuredBufferMs ? configuredBufferMs : 0;
  const configuredBatchTimeoutMs = Math.max(1, Number(process.env.RADAR_EDITORIAL_BATCH_TIMEOUT_MS || DEFAULT_BATCH_TIMEOUT_MS));

  for (let index = 0; index < candidates.length; index += EDITORIAL_BATCH_SIZE) {
    if (!canUseAi('radar-editorial')) {
      stats.budgetExceeded = true;
      break;
    }
    const remainingMs = deadlineAt - Date.now() - deadlineBufferMs;
    if (remainingMs <= 0) {
      stats.deadlineReached = true;
      break;
    }
    const batch = candidates.slice(index, index + EDITORIAL_BATCH_SIZE);
    stats.batches += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(configuredBatchTimeoutMs, remainingMs)));
    try {
      const generated = await generateStructured({
        task: 'radar_editorial_items',
        schema: EDITORIAL_SCHEMA,
        messages: editorialMessages(batch),
        maxOutputTokens: EDITORIAL_MAX_OUTPUT_TOKENS,
        // A global reasoning preference is useful for selection, not for a
        // schema-bound translation task. Letting it share the completion budget
        // is how production exhausted 1,200 tokens before producing valid JSON.
        disableReasoning: true,
        signal: controller.signal,
      });
      await recordAiUsageAtomic('radar-editorial', generated.trace.usage, generated.trace.model);
      for (const rewritten of applyGenerated(batch, generated)) {
        const position = byId.get(itemId(rewritten));
        if (position !== undefined) result[position] = rewritten;
        if (rewritten.editorialStatus === 'ai') stats.rewritten += 1;
        else stats.rejected += 1;
      }
      stats.model = `${generated.trace.provider}:${generated.trace.model}`;
    } catch (error) {
      const reason = sanitizeProviderError(error, 'radar_editorial_unavailable');
      if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError' || ['provider_timeout', 'timeout'].includes(reason)) {
        // A request that reached the provider consumes the daily request budget
        // even when no usage payload comes back. Otherwise repeated timeouts can
        // bypass the guard and keep retrying indefinitely.
        await recordAiUsageAtomic('radar-editorial', null);
        stats.failedBatches += 1;
        if (!stats.errors.includes('provider_timeout')) stats.errors.push('provider_timeout');
        // A timed-out batch remains pending. Continue with the next one while
        // there is room: any success will be persisted and the skipped batch
        // naturally returns to the front of the next run.
        if (Date.now() >= deadlineAt - deadlineBufferMs) {
          stats.deadlineReached = true;
          break;
        }
        continue;
      }
      // Um lote que falha deixaria os itens dele com o texto da fonte, e um
      // item com texto de fonte e indistinguivel de um item que nao precisava
      // de reescrita. A falha sobe para que o run inteiro falhe visivelmente.
      const failure = new Error(reason);
      // O código genérico (`provider_4xx`) agrupa causas com correções muito
      // diferentes: chave revogada (401/403), crédito esgotado (402) ou um
      // payload que o provedor recusou (400/422). O status HTTP não expõe corpo
      // nem credencial, então sobrevive até o operador sem o cuidado reservado à
      // mensagem do provedor.
      if (Number.isFinite(Number(error?.status))) failure.status = Number(error.status);
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
  // A rejected item stays visibly pending, but it must not erase valid work
  // from the same request. The caller persists the accepted items and reports
  // this partial result; the rejected item naturally returns on the next pass.
  if (stats.rejected && !stats.errors.includes('radar_editorial_rejected')) stats.errors.push('radar_editorial_rejected');
  return { items: result, stats: { ...stats, enabled: true, pendingBeyondRun: stats.pending - stats.rewritten, budget: getUsageBudget('radar-editorial') } };
}

export { EDITORIAL_BATCH_SIZE };
