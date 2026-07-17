import { evaluateWithOpenAI, evaluateWithOpenRouter } from './openrouter.js';
import { generateNextQuestionWithProvider } from './interviewProvider.js';

// Provider boundary for the MVP. Azure OpenAI or an SENAI-SP internal endpoint
// can implement the same contract without changing the selection endpoint.
export async function evaluateWithProvider(args) {
  const preferred = String(process.env.AI_PROVIDER || '').toLowerCase();
  const providers = preferred === 'openrouter'
    ? ['openrouter']
    : preferred === 'openai'
      ? ['openai', 'openrouter']
      : ['openai', 'openrouter'];
  let lastError = null;
  for (const provider of providers) {
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) continue;
    if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) continue;
    try {
      return provider === 'openai' ? await evaluateWithOpenAI(args) : await evaluateWithOpenRouter(args);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('ai_not_configured');
}

export { generateNextQuestionWithProvider };
