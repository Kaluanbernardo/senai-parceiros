import { afterEach, describe, expect, it } from 'vitest';
import { canUseAi, getUsageBudget, getUsageBudgetStatus, recordAiUsage, resetUsageBudgetForTests } from './usageBudget.js';
import { usageStore } from './usageStore.js';

  afterEach(() => {
    resetUsageBudgetForTests();
    usageStore.configure({ driver: 'memory' });
  delete process.env.AI_DAILY_REQUEST_LIMIT;
  delete process.env.AI_DAILY_TOKEN_LIMIT;
  delete process.env.AI_DAILY_COST_LIMIT_USD;
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
