const daily = new Map();

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function limits() {
  return {
    tokens: Math.max(0, Number(process.env.AI_DAILY_TOKEN_LIMIT || 100000)),
    costUsd: Math.max(0, Number(process.env.AI_DAILY_COST_LIMIT_USD || 25)),
    requests: Math.max(0, Number(process.env.AI_DAILY_REQUEST_LIMIT || 100)),
    costPer1kUsd: Math.max(0, Number(process.env.AI_ESTIMATED_COST_PER_1K_USD || 0.01)),
  };
}

function usageFor(kind) {
  const key = `${dayKey()}:${kind}`;
  if (!daily.has(key)) daily.set(key, { kind, date: dayKey(), requests: 0, tokens: 0, costUsd: 0 });
  return daily.get(key);
}

function tokenCount(usage) {
  return Number(usage?.total_tokens || 0) || Number(usage?.prompt_tokens || 0) + Number(usage?.completion_tokens || 0);
}

export function getUsageBudget(kind = 'selection') {
  const current = usageFor(kind);
  const cap = limits();
  return { ...current, limits: cap, remaining: { tokens: Math.max(0, cap.tokens - current.tokens), costUsd: Math.max(0, cap.costUsd - current.costUsd), requests: Math.max(0, cap.requests - current.requests) } };
}

export function canUseAi(kind = 'selection') {
  const budget = getUsageBudget(kind);
  return budget.requests < budget.limits.requests && budget.tokens < budget.limits.tokens && budget.costUsd < budget.limits.costUsd;
}

export function recordAiUsage(kind = 'selection', usage = null) {
  const current = usageFor(kind);
  const cap = limits();
  const tokens = tokenCount(usage);
  current.requests += 1;
  current.tokens += tokens;
  current.costUsd += (tokens / 1000) * cap.costPer1kUsd;
  return getUsageBudget(kind);
}

export function resetUsageBudgetForTests() {
  daily.clear();
}
