const timeoutMs = 10000;

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() { return Boolean(config()); }

async function request(path, options = {}) {
  const current = config();
  if (!current) throw new Error('supabase_not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${current.url}${path}`, { ...options, signal: options.signal || controller.signal, headers: { apikey: current.key, Authorization: `Bearer ${current.key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!response.ok) { const error = new Error(`supabase_${response.status}`); error.status = response.status; error.body = (await response.text()).slice(0, 500); throw error; }
    return response.status === 204 ? null : response.json();
  } finally { clearTimeout(timer); }
}

export async function readPilotDocument(key) {
  const rows = await request(`/rest/v1/pilot_documents?select=state,version&key=eq.${encodeURIComponent(key)}&limit=1`);
  return rows?.[0] ? { state: rows[0].state, version: Number(rows[0].version || 0) } : { state: {}, version: 0 };
}

export async function writePilotDocument(key, state, expectedVersion = null) {
  const rows = await request('/rest/v1/rpc/write_pilot_document', { method: 'POST', body: JSON.stringify({ p_key: key, p_state: state, p_expected_version: expectedVersion }) });
  return { version: Number(rows?.[0]?.version || 0) };
}

export async function recordSupabaseAiUsage(task, model, usage = {}, cacheHit = false) {
  // OpenRouter may complete a valid structured response without returning its
  // optional usage block. The caller still records one request, so `null` is a
  // legitimate input here — not a reason to discard the generated content.
  const metrics = usage && typeof usage === 'object' ? usage : {};
  const input = Number(metrics.prompt_tokens ?? metrics.input_tokens ?? 0) || 0;
  const output = Number(metrics.completion_tokens ?? metrics.output_tokens ?? 0) || 0;
  const reasoning = Number(metrics.reasoning_tokens ?? metrics.completion_tokens_details?.reasoning_tokens ?? 0) || 0;
  const cached = Number(metrics.cached_tokens ?? metrics.prompt_tokens_details?.cached_tokens ?? 0) || 0;
  const total = Number(metrics.total_tokens || input + output) || 0;
  const cost = Number(metrics.cost ?? metrics.cost_usd ?? 0) || 0;
  await request('/rest/v1/rpc/record_ai_usage', { method: 'POST', body: JSON.stringify({ p_task: task, p_model: model || '', p_input_tokens: input, p_output_tokens: output, p_reasoning_tokens: reasoning, p_cached_tokens: cached, p_total_tokens: total, p_cost_usd: cost, p_cache_hit: Boolean(cacheHit) }) });
}

export async function getSupabaseAiUsage() {
  const [daily, events] = await Promise.all([
    request('/rest/v1/ai_usage_daily?select=*&order=day.desc&limit=90'),
    request('/rest/v1/ai_usage_events?select=task,model,input_tokens,output_tokens,reasoning_tokens,cached_tokens,total_tokens,cost_usd,cache_hit,created_at&order=created_at.desc&limit=500'),
  ]);
  return { daily: daily || [], events: events || [] };
}

export async function getSupabaseAiCache(cacheKey) {
  const rows = await request(`/rest/v1/ai_cache?select=result,model,task&cache_key=eq.${encodeURIComponent(cacheKey)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
  return rows?.[0] || null;
}

export async function putSupabaseAiCache(cacheKey, task, model, result, ttlHours = 168) {
  const expires = new Date(Date.now() + Math.max(1, Number(ttlHours) || 168) * 3600000).toISOString();
  await request('/rest/v1/ai_cache?on_conflict=cache_key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: cacheKey, task, model, result, expires_at: expires, updated_at: new Date().toISOString() }) });
}
