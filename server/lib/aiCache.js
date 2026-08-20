import crypto from 'node:crypto';
import { getSupabaseAiCache, isSupabaseConfigured, putSupabaseAiCache } from './supabase.js';

const memory = new Map();

export function aiCacheKey(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export async function readAiCache(key) {
  const local = memory.get(key);
  if (local && local.expiresAt > Date.now()) return local.result;
  if (!isSupabaseConfigured()) return null;
  const remote = await getSupabaseAiCache(key);
  return remote?.result || null;
}

export async function writeAiCache(key, task, model, result) {
  const ttlHours = Math.max(1, Number(process.env.AI_CACHE_TTL_HOURS) || 168);
  memory.set(key, { result, expiresAt: Date.now() + ttlHours * 3600000 });
  if (isSupabaseConfigured()) await putSupabaseAiCache(key, task, model, result, ttlHours);
}

export function resetAiCacheForTests() { memory.clear(); }
