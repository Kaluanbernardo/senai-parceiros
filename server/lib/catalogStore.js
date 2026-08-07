import fs from 'node:fs';
import path from 'node:path';

const CATEGORIES = ['person', 'school', 'organization'];
const normalizeCategory = (category) => category === 'researcher' ? 'person' : category;

function emptyState() {
  return {
    records: Object.fromEntries(CATEGORIES.map((category) => [category, []])),
    rowHashes: Object.fromEntries(CATEGORIES.map((category) => [category, []])),
    pendingBatches: {},
    committedBatches: {},
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(value) {
  const state = emptyState();
  for (const category of CATEGORIES) {
    if (Array.isArray(value?.records?.[category])) state.records[category] = value.records[category];
    if (Array.isArray(value?.rowHashes?.[category])) state.rowHashes[category] = value.rowHashes[category];
  }
  if (Array.isArray(value?.records?.researcher)) state.records.person.push(...value.records.researcher);
  if (Array.isArray(value?.rowHashes?.researcher)) state.rowHashes.person.push(...value.rowHashes.researcher);
  if (value?.pendingBatches && typeof value.pendingBatches === 'object') state.pendingBatches = value.pendingBatches;
  if (value?.committedBatches && typeof value.committedBatches === 'object') state.committedBatches = value.committedBatches;
  for (const batches of [state.pendingBatches, state.committedBatches]) {
    for (const batch of Object.values(batches)) if (batch?.category === 'researcher') batch.category = 'person';
  }
  return state;
}

class CatalogStore {
  constructor() {
    const defaultDriver = process.env.NODE_ENV === 'test'
      ? 'memory'
      : (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL ? 'vercel_blob' : 'file');
    this.driver = String(process.env.CATALOG_STORE_DRIVER || (process.env.CATALOG_STORE_FILE ? 'file' : defaultDriver)).toLowerCase();
    this.filePath = process.env.CATALOG_STORE_FILE || path.join(process.cwd(), '.data', 'catalog-store.json');
    this.blobPath = process.env.CATALOG_BLOB_PATH || 'senai/catalog/manifest.json';
    this.state = emptyState();
    this.loaded = false;
    this.remoteHydrated = false;
    this.remoteEtag = null;
  }

  configure({ driver, filePath } = {}) {
    if (driver) this.driver = String(driver).toLowerCase();
    if (filePath) this.filePath = filePath;
    this.state = emptyState();
    this.loaded = false;
    this.load();
    return this.status();
  }

  status() {
    return { driver: this.driver, durable: this.driver === 'file' || this.driver === 'vercel_blob' };
  }

  load() {
    if (this.loaded) return;
    this.loaded = true;
    if (this.driver !== 'file') return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state = normalizeState(parsed);
    } catch (error) {
      if (error?.code !== 'ENOENT') console.warn('[catalog-store] failed to load store', error.message);
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

  getRecords(category) {
    category = normalizeCategory(category);
    this.load();
    return clone(this.state.records[category] || []);
  }

  hasRowHash(category, hash) {
    category = normalizeCategory(category);
    this.load();
    return (this.state.rowHashes[category] || []).includes(hash);
  }

  snapshot(category) {
    category = normalizeCategory(category);
    this.load();
    return clone({ records: this.state.records[category] || [], rowHashes: this.state.rowHashes[category] || [] });
  }

  restore(category, snapshot) {
    category = normalizeCategory(category);
    this.load();
    this.state.records[category] = clone(snapshot?.records || []);
    this.state.rowHashes[category] = clone(snapshot?.rowHashes || []);
    this.persist();
  }

  replaceCategory(category, records, rowHashes) {
    category = normalizeCategory(category);
    this.load();
    this.state.records[category] = clone(records || []);
    this.state.rowHashes[category] = [...new Set(rowHashes || [])];
    this.persist();
  }

  markRowHash(category, hash) {
    category = normalizeCategory(category);
    this.load();
    if (hash && !this.state.rowHashes[category].includes(hash)) this.state.rowHashes[category].push(hash);
  }

  setPending(batch) {
    this.load();
    this.state.pendingBatches[batch.batchId] = clone(batch);
    this.persist();
  }

  getPending(batchId) {
    this.load();
    return this.state.pendingBatches[batchId] ? clone(this.state.pendingBatches[batchId]) : null;
  }

  deletePending(batchId) {
    this.load();
    delete this.state.pendingBatches[batchId];
    this.persist();
  }

  setCommitted(batch) {
    this.load();
    this.state.committedBatches[batch.batchId] = clone(batch);
    this.persist();
  }

  getCommitted(batchId) {
    this.load();
    return this.state.committedBatches[batchId] ? clone(this.state.committedBatches[batchId]) : null;
  }

  deleteCommitted(batchId) {
    this.load();
    delete this.state.committedBatches[batchId];
    this.persist();
  }

  listBatches() {
    this.load();
    return Object.values(this.state.committedBatches).map((batch) => ({
      batchId: batch.batchId,
      category: batch.category,
      filename: batch.filename,
      createdAt: batch.createdAt,
      committedAt: batch.committedAt,
      counts: batch.counts,
      applied: batch.applied,
      ignored: batch.ignored,
      conflicts: batch.conflicts,
    }));
  }

  resetForTests() {
    this.state = emptyState();
    this.loaded = true;
    this.remoteHydrated = false;
    this.remoteEtag = null;
    if (this.driver === 'file') {
      try { fs.rmSync(this.filePath, { force: true }); } catch { /* test cleanup */ }
    }
  }

  async hydrate({ force = false } = {}) {
    if (this.driver !== 'vercel_blob' || (!force && this.remoteHydrated)) return this.status();
    const { get } = await import('@vercel/blob');
    const result = await get(this.blobPath, { access: 'private', useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      this.state = normalizeState(JSON.parse(await new Response(result.stream).text()));
      this.remoteEtag = result.blob?.etag || null;
    }
    this.remoteHydrated = true;
    this.loaded = true;
    return this.status();
  }

  async refreshRemoteEtag() {
    try {
      const { head } = await import('@vercel/blob');
      const info = await head(this.blobPath);
      this.remoteEtag = info?.etag || null;
    } catch {
      this.remoteEtag = null;
    }
  }

  async flush({ attempts = 3 } = {}) {
    if (this.driver !== 'vercel_blob') return this.status();
    const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const options = { access: 'private', allowOverwrite: true, contentType: 'application/json' };
      if (this.remoteEtag && attempt < attempts) options.ifMatch = this.remoteEtag;
      try {
        const result = await put(this.blobPath, JSON.stringify(this.state), options);
        this.remoteEtag = result.etag || null;
        this.remoteHydrated = true;
        return this.status();
      } catch (error) {
        const precondition = error instanceof BlobPreconditionFailedError
          || /precondition failed|etag mismatch/i.test(String(error?.message || ''));
        if (!precondition || attempt === attempts) throw error;
        await this.refreshRemoteEtag();
      }
    }
    return this.status();
  }
}

export const catalogStore = new CatalogStore();
export const CATALOG_STORE_CATEGORIES = CATEGORIES;
