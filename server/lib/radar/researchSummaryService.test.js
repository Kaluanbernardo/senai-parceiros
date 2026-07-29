import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUsageBudget, resetUsageBudgetForTests } from '../usageBudget.js';
import { abstractInputHash } from './summaries.js';
import { summarizeResearchItems } from './researchSummaryService.js';

const abstractText = [
  'This study compares vocational education pathways in manufacturing.',
  'It identifies differences in employer participation and curriculum design.',
  'The evidence comes from public institutional and labour-market sources.',
].join(' ');

function researchItem(id, overrides = {}) {
  const title = `Study ${id}`;
  return {
    id,
    externalId: id,
    section: 'research',
    title,
    abstractText,
    summaryPt: abstractText,
    summaryStatus: 'extractive',
    summaryInputHash: abstractInputHash({ id, title, abstractText }),
    authors: ['Ana Silva'],
    publishedAt: '2026-06-01',
    sourceName: 'OpenAlex',
    provider: 'openalex',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetUsageBudgetForTests();
});

describe('resumos acadêmicos opcionais do Radar', () => {
  it('resume um lote com IA e registra orçamento separado do Radar', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_MODEL = 'test/model';
    process.env.RADAR_SUMMARY_PROVIDER = 'openrouter';
    const items = Array.from({ length: 6 }, (_, index) => researchItem(`work-${index + 1}`));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: 'test/model',
        usage: { total_tokens: 420 },
        choices: [{
          message: {
            content: JSON.stringify({
              summaries: items.map((item) => ({
                id: item.externalId,
                summaryPt: `O estudo ${item.externalId} compara percursos de educação profissional na manufatura e identifica diferenças verificáveis na participação empresarial e no desenho curricular.`,
              })),
            }),
          },
        }],
      }),
    })));

    const result = await summarizeResearchItems(items);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(6);
    expect(result.every((item) => item.summaryStatus === 'ai')).toBe(true);
    expect(result[0].summaryProvenance).toMatchObject({
      source: 'OpenAlex',
      provider: 'openrouter',
      model: 'test/model',
    });
    expect(getUsageBudget('radar-summary')).toMatchObject({ requests: 1, tokens: 420 });
    expect(getUsageBudget('selection')).toMatchObject({ requests: 0, tokens: 0 });
  });

  it('processa abstracts em lotes de no máximo oito', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.RADAR_SUMMARY_PROVIDER = 'openrouter';
    const items = Array.from({ length: 9 }, (_, index) => researchItem(`batch-${index + 1}`));
    vi.stubGlobal('fetch', vi.fn(async (_url, request) => {
      const payload = JSON.parse(request.body);
      const requested = JSON.parse(payload.messages.at(-1).content);
      return {
        ok: true,
        json: async () => ({
          model: 'test/model',
          usage: { total_tokens: 100 },
          choices: [{
            message: {
              content: JSON.stringify({
                summaries: requested.map((item) => ({
                  id: item.id,
                  summaryPt: `Este estudo compara percursos de educação profissional e apresenta evidências verificáveis sobre currículo, participação empresarial e resultados de aprendizagem na manufatura.`,
                })),
              }),
            },
          }],
        }),
      };
    }));

    const result = await summarizeResearchItems(items);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.every((item) => item.summaryStatus === 'ai')).toBe(true);
    expect(getUsageBudget('radar-summary')).toMatchObject({ requests: 2, tokens: 200 });
  });

  it('reutiliza resumo anterior quando o hash do abstract não mudou', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.RADAR_SUMMARY_PROVIDER = 'openrouter';
    const current = researchItem('cached');
    const previous = {
      ...current,
      summaryStatus: 'ai',
      summaryPt: 'Resumo validado anteriormente a partir do mesmo abstract e preservado sem uma nova chamada ao provedor externo.',
      summaryProvenance: { source: 'OpenAlex', provider: 'openrouter', model: 'cached/model' },
    };
    vi.stubGlobal('fetch', vi.fn());

    const result = await summarizeResearchItems([current], { previousItems: [previous] });

    expect(fetch).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      summaryStatus: 'ai',
      summaryPt: previous.summaryPt,
      summaryProvenance: previous.summaryProvenance,
    });
    expect(getUsageBudget('radar-summary')).toMatchObject({ requests: 0, tokens: 0 });
  });
});
