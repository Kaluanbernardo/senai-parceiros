import fs from 'node:fs';
import path from 'node:path';
import { AtomicJsonStore } from './atomicJsonStore.js';
import { consumeSupabaseOperationLimit, readPilotDocument, writePilotDocument } from './supabase.js';

function emptyState() {
  return { entries: {} };
}

function normalizeState(value) {
  return value?.entries && typeof value.entries === 'object' && !Array.isArray(value.entries)
    ? { entries: value.entries }
    : emptyState();
}

function defaultFilePath() {
  return process.env.RATE_LIMIT_STORE_FILE || path.join(process.cwd(), '.data', 'rate-limit-store.json');
}

export class RateLimitStore {
  constructor() {
    this.store = new AtomicJsonStore({ name: 'rate-limit', emptyState, normalizeState });
    this.configure();
  }

  configure({ driver, filePath, blobPath } = {}) {
    const selectedDriver = String(driver || process.env.RATE_LIMIT_STORE_DRIVER || (process.env.RATE_LIMIT_STORE_FILE ? 'file' : 'memory')).toLowerCase();
    this.store.configure({
      driver: selectedDriver,
      filePath: filePath || defaultFilePath(),
      blobPath: blobPath || process.env.RATE_LIMIT_BLOB_PATH || 'senai/security/rate-limits.json',
    });
    return this.status();
  }

  status() { return this.store.status(); }

  get(key) { return this.store.get(key); }

  set(key, value) {
    const result = this.store.set(key, value);
    if (this.store.driver === 'file') {
      fs.mkdirSync(path.dirname(this.store.filePath), { recursive: true });
      const temporaryPath = `${this.store.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(this.store.state), 'utf8');
      fs.renameSync(temporaryPath, this.store.filePath);
    }
    return result;
  }

  async consume(key, limit, windowMs) {
    if (this.store.driver === 'supabase') {
      return !(await consumeSupabaseOperationLimit(key, limit, windowMs));
    }
    const now = Date.now();
    let limited = false;
    await this.store.update((state) => {
      const current = state.entries?.[key];
      if (!current || current.resetAt <= now) {
        state.entries[key] = { count: 1, resetAt: now + windowMs };
        return state;
      }
      if (current.count >= limit) {
        limited = true;
        return state;
      }
      state.entries[key] = { ...current, count: current.count + 1 };
      return state;
    });
    return limited;
  }

  async hydrate({ force = false } = {}) {
    if (this.store.driver === 'supabase') {
      if (!force && this.store.remoteHydrated) return this.status();
      try { const current = await readPilotDocument('rate-limit'); this.store.state = normalizeState(current.state); this.store.remoteVersion = current.version; this.store.remoteHydrated = true; this.store.lastError = null; }
      catch { this.store.lastError = 'store_hydrate_failed'; this.store.remoteHydrated = true; }
      return this.status();
    }
    if (this.store.driver !== 'vercel_blob' || (!force && this.store.remoteHydrated)) return this.status();
    try {
      const current = await this.store.readBlob();
      this.store.state = current.state;
      this.store.remoteEtag = current.etag;
      this.store.remoteHydrated = true;
      this.store.lastError = null;
    } catch {
      this.store.lastError = 'store_hydrate_failed';
      this.store.remoteHydrated = true;
    }
    return this.status();
  }

  async flush() {
    if (this.store.driver === 'supabase') {
      try { const result = await writePilotDocument('rate-limit', this.store.state, this.store.remoteVersion); this.store.remoteVersion = result.version; this.store.remoteHydrated = true; this.store.lastError = null; }
      catch { this.store.lastError = 'store_flush_failed'; }
      return this.status();
    }
    if (this.store.driver !== 'vercel_blob') return this.status();
    try {
      const result = await this.store.writeBlob(this.store.state, this.store.remoteEtag);
      this.store.remoteEtag = result?.etag || this.store.remoteEtag;
      this.store.remoteHydrated = true;
      this.store.lastError = null;
    } catch {
      this.store.lastError = 'store_flush_failed';
    }
    return this.status();
  }

  resetForTests() { this.store.resetForTests(); }
}

export const rateLimitStore = new RateLimitStore();
