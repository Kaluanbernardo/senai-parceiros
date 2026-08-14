import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 8;
const BLOB_RETRY_BASE_DELAY_MS = 100;
const BLOB_RETRY_MAX_DELAY_MS = 6400;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isConflict(error) {
  const code = Number(error?.statusCode || error?.status || error?.response?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return code === 409 || code === 412 || message.includes('precondition') || message.includes('if-match') || message.includes('conflict');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobRetryDelay(attempt) {
  return Math.min(BLOB_RETRY_MAX_DELAY_MS, BLOB_RETRY_BASE_DELAY_MS * (2 ** attempt));
}

function normalizeBlobEtag(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const withoutWeakPrefix = text.startsWith('W/') ? text.slice(2) : text;
  return withoutWeakPrefix.startsWith('"') && withoutWeakPrefix.endsWith('"')
    ? withoutWeakPrefix.slice(1, -1)
    : withoutWeakPrefix;
}

async function acquireFileLock(lockPath, timeoutMs = DEFAULT_LOCK_TIMEOUT_MS) {
  const startedAt = Date.now();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  while (true) {
    try {
      return fs.openSync(lockPath, 'wx');
    } catch (error) {
      if (error?.code !== 'EEXIST' || Date.now() - startedAt >= timeoutMs) throw new Error('atomic_lock_timeout');
      await wait(20);
    }
  }
}

function releaseFileLock(lockPath, handle) {
  try { fs.closeSync(handle); } catch { /* best effort */ }
  try { fs.rmSync(lockPath, { force: true }); } catch { /* best effort */ }
}

/**
 * Small server-only JSON store with an atomic update contract.
 *
 * - memory: useful only for development/tests;
 * - file: exclusive lock + temp-file rename;
 * - vercel_blob: optimistic CAS through the Blob `ifMatch` option with retries.
 *
 * The mutator must be synchronous and must return the next state (or mutate the
 * draft and return nothing). It never receives request payloads or credentials.
 */
export class AtomicJsonStore {
  constructor({ name, emptyState, normalizeState = (value) => value } = {}) {
    this.name = name || 'json-store';
    this.emptyState = emptyState || (() => ({}));
    this.normalizeState = normalizeState;
    this.driver = 'memory';
    this.filePath = '';
    this.blobPath = '';
    this.state = clone(this.emptyState());
    this.lastError = null;
    this.remoteHydrated = false;
  }

  configure({ driver, filePath, blobPath } = {}) {
    if (driver) this.driver = String(driver).toLowerCase();
    if (filePath) this.filePath = filePath;
    if (blobPath) this.blobPath = blobPath;
    this.state = clone(this.emptyState());
    this.lastError = null;
    this.remoteHydrated = false;
    if (this.driver === 'file') this.loadFile();
    return this.status();
  }

  status() {
    return {
      driver: this.driver,
      durable: this.driver === 'file' || this.driver === 'vercel_blob',
      atomic: this.driver === 'file' || this.driver === 'vercel_blob',
      remoteHydrated: this.remoteHydrated,
      lastError: this.lastError,
    };
  }

  loadFile() {
    if (!this.filePath) return;
    try {
      this.state = this.normalizeState(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch (error) {
      if (error?.code !== 'ENOENT') this.lastError = 'store_read_failed';
    }
  }

  readFile() {
    if (!this.filePath) return clone(this.emptyState());
    try { return this.normalizeState(JSON.parse(fs.readFileSync(this.filePath, 'utf8'))); } catch (error) {
      if (error?.code === 'ENOENT') return clone(this.emptyState());
      throw error;
    }
  }

  async readBlob() {
    const { get } = await import('@vercel/blob');
    let result;
    try {
      result = await get(this.blobPath, { access: 'private', useCache: false });
    } catch (error) {
      if (Number(error?.statusCode || error?.status) === 404) return { state: clone(this.emptyState()), etag: null };
      throw error;
    }
    if (result?.statusCode === 404 || !result?.stream) return { state: clone(this.emptyState()), etag: null };
    if (result?.statusCode && result.statusCode >= 400) throw new Error('store_hydrate_failed');
    let etag = normalizeBlobEtag(result.blob?.etag);
    if (!etag) {
      try {
        const { head } = await import('@vercel/blob');
        etag = normalizeBlobEtag((await head(this.blobPath))?.etag);
      } catch (error) {
        if (Number(error?.statusCode || error?.status) !== 404) throw error;
      }
    }
    return {
      state: this.normalizeState(JSON.parse(await new Response(result.stream).text())),
      etag,
    };
  }

  async writeBlob(state, etag) {
    const { put } = await import('@vercel/blob');
    const normalizedEtag = normalizeBlobEtag(etag);
    const options = { access: 'private', contentType: 'application/json', allowOverwrite: Boolean(normalizedEtag) };
    if (normalizedEtag) options.ifMatch = normalizedEtag;
    return put(this.blobPath, JSON.stringify(state), options);
  }

  async update(mutator, { retries = DEFAULT_RETRIES } = {}) {
    if (typeof mutator !== 'function') throw new TypeError('atomic_mutator_required');
    if (this.driver === 'memory') {
      const draft = clone(this.state);
      const next = mutator(draft);
      this.state = clone(next === undefined ? draft : next);
      return clone(this.state);
    }

    if (this.driver === 'file') {
      const lockPath = `${this.filePath}.lock`;
      const handle = await acquireFileLock(lockPath);
      try {
        const draft = this.readFile();
        const next = mutator(clone(draft));
        const state = clone(next === undefined ? draft : next);
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(temporaryPath, JSON.stringify(state), 'utf8');
        fs.renameSync(temporaryPath, this.filePath);
        this.state = state;
        this.remoteHydrated = true;
        this.lastError = null;
        return clone(state);
      } finally {
        releaseFileLock(lockPath, handle);
      }
    }

    if (this.driver !== 'vercel_blob') throw new Error('unsupported_store_driver');
    let lastError = null;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const current = await this.readBlob();
        const draft = clone(current.state);
        const next = mutator(draft);
        const state = clone(next === undefined ? draft : next);
        const result = await this.writeBlob(state, current.etag);
        this.state = state;
        this.remoteHydrated = true;
        this.lastError = null;
        this.remoteEtag = normalizeBlobEtag(result?.etag) || current.etag || null;
        return clone(state);
      } catch (error) {
        lastError = error;
        if (!isConflict(error) || attempt === retries - 1) break;
        await wait(blobRetryDelay(attempt));
      }
    }
    this.lastError = isConflict(lastError) ? 'store_conflict' : 'store_update_failed';
    throw new Error(this.lastError);
  }

  get(key) {
    const value = this.state?.entries?.[key];
    return value === undefined ? null : clone(value);
  }

  set(key, value) {
    const draft = clone(this.state);
    draft.entries = draft.entries || {};
    draft.entries[key] = clone(value);
    this.state = draft;
    return clone(value);
  }

  resetForTests() {
    this.state = clone(this.emptyState());
    this.lastError = null;
    this.remoteHydrated = false;
    if (this.driver === 'file' && this.filePath) {
      try { fs.rmSync(this.filePath, { force: true }); } catch { /* test cleanup */ }
      try { fs.rmSync(`${this.filePath}.lock`, { force: true }); } catch { /* test cleanup */ }
    }
  }
}
