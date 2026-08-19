import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../lib/http.js';
import { getSupabaseAiUsage, isSupabaseConfigured } from '../../lib/supabase.js';
import { getUsageBudgetStatus } from '../../lib/usageBudget.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;
  if (!isSupabaseConfigured()) return res.status(200).json({ configured: false, store: getUsageBudgetStatus(), daily: [], events: [] });
  try {
    const usage = await getSupabaseAiUsage();
    return res.status(200).json({ configured: true, store: getUsageBudgetStatus(), ...usage });
  } catch {
    return res.status(503).json({ error: 'usage_store_unavailable' });
  }
}
