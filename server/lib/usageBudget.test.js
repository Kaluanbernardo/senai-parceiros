import { afterEach, describe, expect, it } from 'vitest';
import { canUseAi, getUsageBudget, recordAiUsage, resetUsageBudgetForTests } from './usageBudget.js';

afterEach(() => {
  resetUsageBudgetForTests();
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
});
