import { usageStore } from './usageStore.js';
import { emitOperationalAlert } from './alerts.js';
import { recordSupabaseAiUsage, isSupabaseConfigured } from './supabase.js';

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_LIMITS = Object.freeze({ tokens: 100000, costUsd: 25, requests: 100 });
const RADAR_EDITORIAL_DEFAULT_LIMITS = Object.freeze({ tokens: 500000, costUsd: 5, requests: 200 });
const CATALOG_RESEARCH_DEFAULT_LIMITS = Object.freeze({ tokens: 1000000, costUsd: 25, requests: 100 });
const CATALOG_ENRICHMENT_DEFAULT_LIMITS = Object.freeze({ tokens: 1000000, costUsd: 10, requests: 150 });

function numericLimit(specificName, genericName, fallback) {
  const configured = (specificName ? process.env[specificName] : undefined)
    ?? (genericName ? process.env[genericName] : undefined)
    ?? fallback;
  const value = Number(configured);
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function limits(kind = 'selection') {
  if (kind === 'catalog-enrichment') {
    // Este trabalho percorre dezenas de cards em chamadas independentes.
    // Herdar o teto interativo de 100 mil tokens interrompe o lote no meio;
    // o perfil próprio continua limitado sem consumir a cota das entrevistas.
    return {
      tokens: numericLimit('CATALOG_ENRICHMENT_DAILY_TOKEN_LIMIT', null, CATALOG_ENRICHMENT_DEFAULT_LIMITS.tokens),
      costUsd: numericLimit('CATALOG_ENRICHMENT_DAILY_COST_LIMIT_USD', null, CATALOG_ENRICHMENT_DEFAULT_LIMITS.costUsd),
      requests: numericLimit('CATALOG_ENRICHMENT_DAILY_REQUEST_LIMIT', null, CATALOG_ENRICHMENT_DEFAULT_LIMITS.requests),
      costPer1kUsd: Math.max(0, Number(process.env.AI_ESTIMATED_COST_PER_1K_USD || 0.01)),
    };
  }
  const editorial = kind === 'radar-editorial';
  const catalogResearch = kind === 'catalog_research';
  const defaults = editorial ? RADAR_EDITORIAL_DEFAULT_LIMITS : catalogResearch ? CATALOG_RESEARCH_DEFAULT_LIMITS : DEFAULT_LIMITS;
  const prefix = editorial ? 'RADAR_EDITORIAL' : catalogResearch ? 'CATALOG_RESEARCH' : 'AI';
  return {
    // Reescrever centenas de itens em lotes consome muito mais chamadas que
    // uma entrevista ou uma seleção. Um limite próprio impede essa fila de
    // parar as outras ferramentas e mantém um teto financeiro menor, de US$ 5.
    tokens: numericLimit(`${prefix}_DAILY_TOKEN_LIMIT`, 'AI_DAILY_TOKEN_LIMIT', defaults.tokens),
    costUsd: numericLimit(`${prefix}_DAILY_COST_LIMIT_USD`, 'AI_DAILY_COST_LIMIT_USD', defaults.costUsd),
    requests: numericLimit(`${prefix}_DAILY_REQUEST_LIMIT`, 'AI_DAILY_REQUEST_LIMIT', defaults.requests),
    costPer1kUsd: Math.max(0, Number(process.env.AI_ESTIMATED_COST_PER_1K_USD || 0.01)),
  };
}

function usageFor(kind) {
  const key = `${dayKey()}:${kind}`;
  const existing = usageStore.get(key);
  if (existing) return existing;
  return { kind, date: dayKey(), requests: 0, tokens: 0, costUsd: 0 };
}

function tokenCount(usage) {
  return Number(usage?.total_tokens || 0) || Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0) + Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0) + Number(usage?.reasoning_tokens ?? usage?.completion_tokens_details?.reasoning_tokens ?? 0);
}

function costFor(usage, tokens, cap) {
  const reported = Number(usage?.cost ?? usage?.cost_usd);
  return Number.isFinite(reported) && reported >= 0 ? reported : (tokens / 1000) * cap.costPer1kUsd;
}

function budgetFor(current) {
  const cap = limits(current.kind);
  return { ...current, limits: cap, remaining: { tokens: Math.max(0, cap.tokens - current.tokens), costUsd: Math.max(0, cap.costUsd - current.costUsd), requests: Math.max(0, cap.requests - current.requests) } };
}

export function getUsageBudget(kind = 'selection') {
  const current = usageFor(kind);
  return budgetFor(current);
}

export function canUseAi(kind = 'selection') {
  // Preserve the original fail-safe default. The pilot may explicitly disable
  // enforcement while observing costs, but an absent variable must not turn
  // every configured cap into decoration.
  if (String(process.env.AI_ENFORCE_BUDGET || 'true').toLowerCase() !== 'true') return true;
  const budget = getUsageBudget(kind);
  return budget.requests < budget.limits.requests && budget.tokens < budget.limits.tokens && budget.costUsd < budget.limits.costUsd;
}

export function recordAiUsage(kind = 'selection', usage = null) {
  const current = usageFor(kind);
  const cap = limits(kind);
  const tokens = tokenCount(usage);
  current.requests += 1;
  current.tokens += tokens;
  current.costUsd += costFor(usage, tokens, cap);
  usageStore.set(`${dayKey()}:${kind}`, current);
  return getUsageBudget(kind);
}

export async function recordAiUsageAtomic(kind = 'selection', usage = null, model = '') {
  const key = `${dayKey()}:${kind}`;
  const cap = limits(kind);
  const tokens = tokenCount(usage);
  let current;
  await usageStore.update((state) => {
    state.entries = state.entries || {};
    current = state.entries[key] || { kind, date: dayKey(), requests: 0, tokens: 0, costUsd: 0 };
    current = {
      ...current,
      requests: Number(current.requests || 0) + 1,
      tokens: Number(current.tokens || 0) + tokens,
      costUsd: Number(current.costUsd || 0) + costFor(usage, tokens, cap),
    };
    state.entries[key] = current;
    return state;
  });
  if (isSupabaseConfigured()) await recordSupabaseAiUsage(kind, model, usage);
  const budget = budgetFor(current);
  const threshold = Math.min(1, Math.max(0.5, Number(process.env.AI_ALERT_THRESHOLD || 0.8)));
  const requestsRatio = cap.requests ? current.requests / cap.requests : 0;
  const tokensRatio = cap.tokens ? current.tokens / cap.tokens : 0;
  const costRatio = cap.costUsd ? current.costUsd / cap.costUsd : 0;
  if (Math.max(requestsRatio, tokensRatio, costRatio) >= threshold) {
    await emitOperationalAlert('ai_budget_threshold', {
      severity: Math.max(requestsRatio, tokensRatio, costRatio) >= 1 ? 'critical' : 'warning',
      details: {
        kind,
        requests: current.requests,
        tokens: current.tokens,
        costUsd: Number(current.costUsd.toFixed(4)),
        remainingRequests: budget.remaining.requests,
        remainingTokens: budget.remaining.tokens,
        remainingCostUsd: Number(budget.remaining.costUsd.toFixed(4)),
        threshold,
      },
    });
  }
  return budget;
}

export async function hydrateUsageBudget({ force = false } = {}) {
  return usageStore.hydrate({ force });
}

export async function flushUsageBudget() {
  return usageStore.flush();
}

export function getUsageBudgetStatus() {
  return usageStore.status();
}

export function resetUsageBudgetForTests() {
  usageStore.resetForTests();
}
