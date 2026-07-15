import { evaluateWithOpenRouter } from './openrouter.js';

// Provider boundary for the MVP. Azure OpenAI or an SENAI-SP internal endpoint
// can implement the same contract without changing the selection endpoint.
export async function evaluateWithProvider(args) {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
  if (provider === 'openrouter') return evaluateWithOpenRouter(args);
  throw new Error(`ai_provider_not_implemented:${provider}`);
}
