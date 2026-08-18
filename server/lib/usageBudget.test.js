import { afterEach, describe, expect, it } from 'vitest';
import { canUseAi, getUsageBudget, getUsageBudgetStatus, recordAiUsage, resetUsageBudgetForTests } from './usageBudget.js';
import { usageStore } from './usageStore.js';

  afterEach(() => {
    resetUsageBudgetForTests();
    usageStore.configure({ driver: 'memory' });
  delete process.env.AI_DAILY_REQUEST_LIMIT;
  delete process.env.AI_DAILY_TOKEN_LIMIT;
  delete process.env.AI_DAILY_COST_LIMIT_USD;
  delete process.env.RADAR_EDITORIAL_DAILY_REQUEST_LIMIT;
  delete process.env.RADAR_EDITORIAL_DAILY_TOKEN_LIMIT;
  delete process.env.RADAR_EDITORIAL_DAILY_COST_LIMIT_USD;
  delete process.env.CATALOG_ENRICHMENT_DAILY_REQUEST_LIMIT;
  delete process.env.CATALOG_ENRICHMENT_DAILY_TOKEN_LIMIT;
  delete process.env.CATALOG_ENRICHMENT_DAILY_COST_LIMIT_USD;
  delete process.env.CATALOG_RESEARCH_DAILY_REQUEST_LIMIT;
  delete process.env.CATALOG_RESEARCH_DAILY_TOKEN_LIMIT;
  delete process.env.CATALOG_RESEARCH_DAILY_COST_LIMIT_USD;
});

describe('AI usage budget', () => {
  it('records aggregate usage without storing prompts or answers', () => {
    process.env.AI_DAILY_REQUEST_LIMIT = '2';
    const first = recordAiUsage('selection', { total_tokens: 100 });
    expect(first.requests).toBe(1);
    expect(first.tokens).toBe(100);
    expect(canUseAi('selection')).toBe(true);
    recordAiUsage('selection', { total_tokens: 100 });
    expect(canUseAi('selection')).toBe(false);
    expect(getUsageBudget('selection')).not.toHaveProperty('prompt');
  });

  it('reserva um limite próprio e controlado para a fila editorial do Radar', () => {
    expect(getUsageBudget('selection').limits).toMatchObject({ requests: 100, tokens: 100000, costUsd: 25 });
    expect(getUsageBudget('radar-editorial').limits).toMatchObject({ requests: 200, tokens: 500000, costUsd: 5 });
    expect(getUsageBudget('catalog_research').limits).toMatchObject({ requests: 100, tokens: 1000000, costUsd: 25 });
  });

  it('mantém orçamento disponível durante um lote completo de enriquecimento', () => {
    process.env.AI_DAILY_TOKEN_LIMIT = '1';
    expect(getUsageBudget('catalog-enrichment').limits).toMatchObject({ requests: 500, tokens: 3000000, costUsd: 30 });

    // 91 cards fora do padrão, cada um com até duas tentativas: o teto precisa
    // cobrir o lote inteiro, senão a cota acaba antes do trabalho.
    for (let card = 1; card <= 182; card += 1) {
      expect(canUseAi('catalog-enrichment'), `orçamento esgotou antes do card ${card}`).toBe(true);
      recordAiUsage('catalog-enrichment', { total_tokens: 10_000 });
    }
  });

  it('supports a durable file adapter without changing the budget contract', () => {
    const filePath = `${process.cwd()}/tmp-ai-usage-${Date.now()}.json`;
    usageStore.configure({ driver: 'file', filePath });
    recordAiUsage('interview', { total_tokens: 250 });
    expect(getUsageBudget('interview').tokens).toBe(250);
    expect(getUsageBudgetStatus()).toMatchObject({ driver: 'file', durable: true });

    usageStore.configure({ driver: 'file', filePath });
    expect(getUsageBudget('interview').tokens).toBe(250);
    resetUsageBudgetForTests();
    usageStore.configure({ driver: 'memory' });
  });
});
