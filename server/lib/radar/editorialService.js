import crypto from 'node:crypto';
import { normalizeRadarItem } from '../../../src/domain/radar.js';
import { EDITORIAL_RULES_VERSION, isLikelyEnglish, isOfficialAct, needsEditorialTreatment, stripEvidencePrefix } from '../../../src/domain/radarEditorial.js';
import { generateStructured } from '../structuredGeneration.js';
import { canUseAi, recordAiUsageAtomic } from '../usageBudget.js';

/**
 * Editorial rewriting for Radar items.
 *
 * An official act arrives titled "PORTARIA Nº 1.234, DE 15 DE JULHO DE 2026"
 * and summarised by the clause that matched our thematic filter. Both are
 * faithful to the source and neither tells a reader what changed, for whom.
 * This pass produces a plain-language headline and a two-to-three sentence
 * explanation, and translates whatever the source published in English.
 *
 * It is an enrichment, like the research summaries: budgeted, cached across
 * runs, and always degrading to the deterministic presentation layer in
 * src/domain/radarEditorial.js rather than to the raw source text.
 */

const EDITORIAL_BATCH_SIZE = 6;
const DEFAULT_MAX_ITEMS_PER_RUN = 48;
const DEFAULT_DEADLINE_MS = 25_000;
const MAX_SOURCE_TEXT = 900;

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
  const text = stripEvidencePrefix(item?.summaryPt) || String(item?.abstractText || '');
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_SOURCE_TEXT);
}

export function editorialInputHash(item) {
  return crypto.createHash('sha256')
    .update([EDITORIAL_RULES_VERSION, itemId(item), String(item?.title || ''), sourceTextFor(item), (item?.topics || []).join('|')].join('\n'))
    .digest('hex');
}

/**
 * Serves the queue a section at a time instead of draining it in priority
 * order.
 *
 * Strict priority starved whole sections. Production accumulated hundreds of
 * state-gazette acts, all of them priority 0; they filled the per-run quota on
 * every single run, so the research tab — where every item is in English and the
 * need is most visible — was never reached at all. 481 rewrites had happened and
 * not one of them was a paper.
 *
 * Priority still decides the order *within* a section, which is what it is good
 * for. Across sections the quota is shared round-robin, so every tab advances on
 * every run.
 */
function interleaveBySection(items) {
  const bySection = new Map();
  for (const item of items) {
    const section = item.section || 'other';
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section).push(item);
  }
  const queues = [...bySection.values()];
  const ordered = [];
  for (let position = 0; queues.some((queue) => position < queue.length); position += 1) {
    for (const queue of queues) if (position < queue.length) ordered.push(queue[position]);
  }
  return ordered;
}

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
  // A paper's title is its citation. Translating it keeps the item readable
  // without inventing a headline the literature cannot be searched by.
  return item?.section === 'research' ? 'traducao' : 'editorial';
}

function editorialMessages(items) {
  return [
    {
      role: 'system',
      content: [
        'Você escreve o Radar EPT do SENAI-SP para gestores que não são especialistas em legislação nem em pesquisa acadêmica.',
        'Responda sempre em português do Brasil, mesmo quando o texto recebido estiver em inglês.',
        'Para modo "editorial": escreva um título de até 110 caracteres dizendo o que o documento faz e para quem, sem começar por número de ato, e um resumo de duas a três frases explicando em linguagem simples o que muda na prática.',
        'Para modo "traducao": traduza o título fielmente, sem reescrevê-lo, e escreva um resumo de duas a três frases em linguagem simples sobre o que o trabalho investiga e o que encontrou.',
        'Não use jargão jurídico ou acadêmico; se um termo técnico for indispensável, explique-o na mesma frase.',
        'Use somente as informações recebidas. Nunca invente prazos, valores, números, vagas ou efeitos.',
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

export function validateEditorialTitle(value, item = {}) {
  const title = cleanText(value, 200);
  if (title.length < 12 || title.length > 140) return false;
  if (ACT_REFERENCE_OPENING.test(title)) return false;
  if (folded(title) === folded(item.title)) return false;
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
    const title = validateEditorialTitle(entry.title, item) ? cleanText(entry.title, 140) : null;
    const summary = validateEditorialSummary(entry.summary, item) ? cleanText(entry.summary, 1000) : null;
    if (!title && !summary) return item;
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
      editorialProvenance: { provider: generated.trace.provider, model: generated.trace.model, rulesVersion: EDITORIAL_RULES_VERSION },
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
    .filter((item) => item.editorialStatus === 'ai' && item.editorialInputHash)
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
  return { pending: 0, candidates: 0, reused: 0, batches: 0, rewritten: 0, rejected: 0, failedBatches: 0, deadlineReached: false, errors: [] };
}

export async function editorializeRadarItems(items = [], { previousItems = [], deadlineAt: runDeadlineAt = null } = {}) {
  const result = reuseStoredEditorials(Array.isArray(items) ? items : [], previousItems);
  const stats = emptyStats();
  stats.reused = result.filter((item) => item.editorialStatus === 'ai').length;
  if (!providerEnabled()) return { items: result, stats: { ...stats, enabled: false } };
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
    .filter((item) => item.editorialStatus !== 'ai' && needsEditorialTreatment(item) && (item.title || item.summaryPt))
    .sort((left, right) => String(right.publishedAt || '').localeCompare(String(left.publishedAt || ''))
      || editorialPriority(left) - editorialPriority(right)));
  const candidates = pending.slice(0, maxItems);
  stats.pending = pending.length;
  stats.candidates = candidates.length;
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

  for (let index = 0; index < candidates.length && canUseAi('radar-editorial'); index += EDITORIAL_BATCH_SIZE) {
    if (Date.now() >= deadlineAt) {
      stats.deadlineReached = true;
      break;
    }
    const batch = candidates.slice(index, index + EDITORIAL_BATCH_SIZE);
    stats.batches += 1;
    try {
      const generated = await generateStructured({
        task: 'radar_editorial_items',
        schema: EDITORIAL_SCHEMA,
        messages: editorialMessages(batch),
        maxOutputTokens: 1200,
      });
      await recordAiUsageAtomic('radar-editorial', generated.trace.usage);
      for (const rewritten of applyGenerated(batch, generated)) {
        const position = byId.get(itemId(rewritten));
        if (position !== undefined) result[position] = rewritten;
        if (rewritten.editorialStatus === 'ai') stats.rewritten += 1;
        else stats.rejected += 1;
      }
      stats.model = `${generated.trace.provider}:${generated.trace.model}`;
    } catch (error) {
      // The deterministic presentation layer already applies to every item, so
      // a failed batch costs readability, never an item.
      stats.failedBatches += 1;
      stats.rejected += batch.length;
      const code = String(error?.message || 'provider_error').slice(0, 60);
      if (!stats.errors.includes(code)) stats.errors.push(code);
    }
  }
  return { items: result, stats: { ...stats, enabled: true } };
}

export { EDITORIAL_BATCH_SIZE };
