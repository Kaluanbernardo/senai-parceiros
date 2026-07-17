import fs from 'node:fs';
import path from 'node:path';

function emptyState() {
  return { entries: {} };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(value) {
  const state = emptyState();
  if (value?.entries && typeof value.entries === 'object' && !Array.isArray(value.entries)) {
    state.entries = value.entries;
  }
  return state;
}

class UsageStore {
  constructor() {
    this.driver = String(process.env.AI_BUDGET_STORE_DRIVER || (process.env.AI_BUDGET_STORE_FILE ? 'file' : 'memory')).toLowerCase();
    this.filePath = process.env.AI_BUDGET_STORE_FILE || path.join(process.cwd(), '.data', 'ai-usage-store.json');
    this.blobPath = process.env.AI_BUDGET_BLOB_PATH || 'senai/ai/usage-budget.json';
    this.state = emptyState();
    this.loaded = false;
    this.remoteHydrated = false;
    this.remoteEtag = null;
    this.lastError = null;
  }

  configure({ driver, filePath, blobPath } = {}) {
    if (driver) this.driver = String(driver).toLowerCase();
    if (filePath) this.filePath = filePath;
    if (blobPath) this.blobPath = blobPath;
    this.state = emptyState();
    this.loaded = false;
    this.remoteHydrated = false;
    this.remoteEtag = null;
    this.lastError = null;
    this.load();
    return this.status();
  }

  status() {
    return {
      driver: this.driver,
      durable: this.driver === 'file' || this.driver === 'vercel_blob',
      remoteHydrated: this.remoteHydrated,
      lastError: this.lastError,
    };
  }

  load() {
    if (this.loaded) return;
    this.loaded = true;
    if (this.driver !== 'file') return;
    try {
      this.state = normalizeState(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.lastError = 'store_read_failed';
        console.warn('[usage-store] failed to load store', error.message);
      }
    }
  }

  persist() {
    this.load();
    if (this.driver !== 'file') return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.state), 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  get(key) {
    this.load();
    return this.state.entries[key] ? clone(this.state.entries[key]) : null;
  }

  set(key, value) {
    this.load();
    this.state.entries[key] = clone(value);
    this.persist();
    return this.get(key);
  }

  resetForTests() {
    this.state = emptyState();
    this.loaded = true;
    this.remoteHydrated = false;
    this.remoteEtag = null;
    this.lastError = null;
    if (this.driver === 'file') {
      try { fs.rmSync(this.filePath, { force: true }); } catch { /* test cleanup */ }
    }
  }

  async hydrate({ force = false } = {}) {
    if (this.driver !== 'vercel_blob' || (!force && this.remoteHydrated)) return this.status();
    try {
      const { get } = await import('@vercel/blob');
      const result = await get(this.blobPath, { access: 'private', useCache: false });
      if (result?.statusCode === 200 && result.stream) {
        this.state = normalizeState(JSON.parse(await new Response(result.stream).text()));
        this.remoteEtag = result.blob?.etag || null;
      }
      this.lastError = null;
    } catch (error) {
      this.lastError = 'store_hydrate_failed';
      console.warn('[usage-store] failed to hydrate store', error.message);
    }
    this.remoteHydrated = true;
    this.loaded = true;
    return this.status();
  }

  async flush() {
    if (this.driver !== 'vercel_blob') return this.status();
    try {
      const { put } = await import('@vercel/blob');
      const options = { access: 'private', allowOverwrite: true, contentType: 'application/json' };
      if (this.remoteEtag) options.ifMatch = this.remoteEtag;
      const result = await put(this.blobPath, JSON.stringify(this.state), options);
      this.remoteEtag = result.etag || this.remoteEtag;
      this.lastError = null;
    } catch (error) {
      this.lastError = 'store_flush_failed';
      console.warn('[usage-store] failed to flush store', error.message);
    }
    this.remoteHydrated = true;
    return this.status();
  }
}

export const usageStore = new UsageStore();
