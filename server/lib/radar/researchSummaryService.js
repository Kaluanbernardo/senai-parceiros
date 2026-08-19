import { generateStructured } from '../structuredGeneration.js';
import { canUseAi, recordAiUsageAtomic } from '../usageBudget.js';
import { buildSummaryMetadata, normalizeAbstractText, validateResearchSummary } from './summaries.js';
import { sanitizeProviderError } from './contracts.js';

const SUMMARY_BATCH_SIZE = 8;

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summaries'],
  properties: {
    summaries: {
      type: 'array',
      minItems: 1,
      maxItems: SUMMARY_BATCH_SIZE,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'summaryPt'],
        properties: {
          id: { type: 'string' },
          summaryPt: { type: 'string' },
        },
      },
    },
  },
};

function summaryMessages(items) {
  return [
    {
      role: 'system',
      content: [
        'Resuma evidências acadêmicas em português brasileiro.',
        'Use somente o abstract fornecido. Não invente método, resultado, impacto ou vínculo institucional.',
        'Produza de duas a três frases informativas, sem repetir título, autores ou data.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(items.map((item) => ({
        id: String(item.externalId || item.id),
        abstract: normalizeAbstractText(item.abstractText),
      }))),
    },
  ];
}

function applyGeneratedSummaries(items, generated) {
  const byId = new Map((generated.data?.summaries || []).map((summary) => [String(summary.id), summary.summaryPt]));
  return items.map((item) => {
    const summaryPt = byId.get(String(item.externalId || item.id));
    if (!validateResearchSummary(summaryPt, item)) return item;
    return {
      ...item,
      ...buildSummaryMetadata({
        id: item.externalId || item.id,
        title: item.title,
        sourceText: item.abstractText,
        summary: summaryPt,
        status: 'ai',
        source: item.sourceName || item.provider || 'unknown',
        provider: generated.trace.provider,
        model: generated.trace.model,
      }),
    };
  });
}

const itemId = (item) => String(item?.externalId || item?.id || '');

function reuseCachedSummaries(items, previousItems) {
  const cached = new Map((Array.isArray(previousItems) ? previousItems : [])
    .filter((item) => item.summaryStatus === 'ai' && item.summaryInputHash)
    .map((item) => [itemId(item), item]));
  return items.map((item) => {
    const previous = cached.get(itemId(item));
    if (!previous || previous.summaryInputHash !== item.summaryInputHash) return item;
    return {
      ...item,
      summaryPt: previous.summaryPt,
      summaryStatus: previous.summaryStatus,
      summaryUpdatedAt: previous.summaryUpdatedAt,
      summaryProvenance: previous.summaryProvenance,
    };
  });
}

/**
 * Resumo por IA e obrigatorio: um item que chega ao leitor com o texto da
 * fonte e uma degradacao invisivel — parece igual a um item que nao tinha o
 * que resumir. Por isso a falha sobe e derruba o run inteiro, em vez de virar
 * um resumo extractive silencioso.
 */
export async function summarizeResearchItems(items = [], { previousItems = [] } = {}) {
  const result = reuseCachedSummaries(Array.isArray(items) ? items : [], previousItems);
  const candidates = result.filter((item) => item.summaryStatus !== 'ai' && normalizeAbstractText(item.abstractText));
  // Nada a resumir e run valido; havendo fila, a ausencia de provedor deixaria
  // itens com o texto da fonte e por isso derruba o run.
  if (!candidates.length) return result;
  const enabled = String(process.env.RADAR_SUMMARY_PROVIDER || '').trim().toLowerCase();
  if (!enabled || enabled === 'false' || enabled === 'off') throw new Error('radar_summary_provider_disabled');

  for (let index = 0; index < candidates.length && canUseAi('radar-summary'); index += SUMMARY_BATCH_SIZE) {
    const batch = candidates.slice(index, index + SUMMARY_BATCH_SIZE);
    try {
      const generated = await generateStructured({
        task: 'radar_research_summaries',
        schema: SUMMARY_SCHEMA,
        messages: summaryMessages(batch),
        maxOutputTokens: 900,
      });
      await recordAiUsageAtomic('radar-summary', generated.trace.usage, generated.trace.model);
      const summarized = new Map(applyGeneratedSummaries(batch, generated).map((item) => [itemId(item), item]));
      for (let itemIndex = 0; itemIndex < result.length; itemIndex += 1) {
        result[itemIndex] = summarized.get(itemId(result[itemIndex])) || result[itemIndex];
      }
    } catch (error) {
      throw new Error(sanitizeProviderError(error, 'radar_summary_unavailable'));
    }
  }
  // Orcamento esgotado no meio da fila deixa item sem resumo de IA, e item sem
  // resumo de IA nao pode ser exibido: e falha de run, nao entrega parcial.
  const missing = result.filter((item) => item.summaryStatus !== 'ai' && normalizeAbstractText(item.abstractText));
  if (missing.length) throw new Error('radar_summary_incomplete');
  return result;
}

export { SUMMARY_BATCH_SIZE };
