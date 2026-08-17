import fs from 'node:fs';
import path from 'node:path';
import { normalizeCatalogCategory, normalizeCatalogRequest, withCatalogClassification } from '../../src/domain/catalogTaxonomy.js';

const CATEGORIES = ['person', 'organization'];

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

function classifiedRecord(record, sourceCategory) {
  const request = normalizeCatalogRequest(sourceCategory);
  const source = request.subtype && !record?.subtipo ? { ...record, subtipo: request.subtype } : record;
  return withCatalogClassification(source, request.category);
}

function normalizedSnapshot(snapshot, sourceCategory) {
  return {
    records: Array.isArray(snapshot?.records) ? snapshot.records.map((record) => classifiedRecord(record, sourceCategory)) : [],
    rowHashes: Array.isArray(snapshot?.rowHashes) ? [...snapshot.rowHashes] : [],
  };
}

function mergeSnapshot(target, incoming) {
  target.records.push(...incoming.records);
  target.rowHashes.push(...incoming.rowHashes);
  target.rowHashes = [...new Set(target.rowHashes)];
}

function normalizeBatch(batch) {
  if (!batch || typeof batch !== 'object') return batch;
  const migrated = clone(batch);
  const batchRequest = normalizeCatalogRequest(batch.category);
  if (batch.category) migrated.category = batchRequest.category;
  if (Array.isArray(batch.targets)) {
    migrated.targets = batch.targets.map((target) => {
      const request = normalizeCatalogRequest(target.category || batch.category);
      return {
        ...target,
        category: request.category,
        ...(target.record ? { record: classifiedRecord(target.record, target.category || batch.category) } : {}),
        ...(target.result ? { result: classifiedRecord(target.result, target.category || batch.category) } : {}),
      };
    });
  }
  if (Array.isArray(batch.applied)) {
    migrated.applied = batch.applied.map((change) => ({
      ...change,
      category: normalizeCatalogRequest(change.category || batch.category).category,
    }));
  }
  if (batch.beforeByCategory && typeof batch.beforeByCategory === 'object') {
    migrated.beforeByCategory = Object.fromEntries(CATEGORIES.map((category) => [category, { records: [], rowHashes: [] }]));
    for (const [sourceCategory, snapshot] of Object.entries(batch.beforeByCategory)) {
      const request = normalizeCatalogRequest(sourceCategory);
      if (!CATEGORIES.includes(request.category)) continue;
      mergeSnapshot(migrated.beforeByCategory[request.category], normalizedSnapshot(snapshot, sourceCategory));
    }
  }
  if (Array.isArray(batch.appliedRecords)) {
    migrated.appliedRecords = batch.appliedRecords.map((record) => {
      const change = batch.applied?.find((entry) => String(entry.id) === String(record.id));
      return classifiedRecord(record, change?.category || batch.category);
    });
  }
  return migrated;
}

function normalizeState(value) {
  const state = emptyState();
  for (const category of CATEGORIES) {
    if (Array.isArray(value?.records?.[category])) state.records[category] = value.records[category].map((record) => withCatalogClassification(record, category));
    if (Array.isArray(value?.rowHashes?.[category])) state.rowHashes[category] = value.rowHashes[category];
  }
  if (Array.isArray(value?.records?.researcher)) state.records.person.push(...value.records.researcher.map((record) => withCatalogClassification(record, 'person')));
  if (Array.isArray(value?.rowHashes?.researcher)) state.rowHashes.person.push(...value.rowHashes.researcher);
  if (Array.isArray(value?.records?.school)) state.records.organization.push(...value.records.school.map((record) => withCatalogClassification({ ...record, subtipo: record.subtipo || 'Instituição de ensino' }, 'organization')));
  if (Array.isArray(value?.rowHashes?.school)) state.rowHashes.organization.push(...value.rowHashes.school);
  state.rowHashes.person = [...new Set(state.rowHashes.person)];
  state.rowHashes.organization = [...new Set(state.rowHashes.organization)];
  if (value?.pendingBatches && typeof value.pendingBatches === 'object') {
    state.pendingBatches = Object.fromEntries(Object.entries(value.pendingBatches).map(([id, batch]) => [id, normalizeBatch(batch)]));
  }
  if (value?.committedBatches && typeof value.committedBatches === 'object') {
    state.committedBatches = Object.fromEntries(Object.entries(value.committedBatches).map(([id, batch]) => [id, normalizeBatch(batch)]));
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
    category = normalizeCatalogCategory(category);
    this.load();
    return clone(this.state.records[category] || []);
  }

  hasRowHash(category, hash) {
    category = normalizeCatalogCategory(category);
    this.load();
    return (this.state.rowHashes[category] || []).includes(hash);
  }

  snapshot(category) {
    category = normalizeCatalogCategory(category);
    this.load();
    return clone({ records: this.state.records[category] || [], rowHashes: this.state.rowHashes[category] || [] });
  }

  restore(category, snapshot) {
    category = normalizeCatalogCategory(category);
    this.load();
    this.state.records[category] = clone(snapshot?.records || []).map((record) => withCatalogClassification(record, category));
    this.state.rowHashes[category] = clone(snapshot?.rowHashes || []);
    this.persist();
  }

  replaceCategory(category, records, rowHashes) {
    category = normalizeCatalogCategory(category);
    this.load();
    this.state.records[category] = clone(records || []).map((record) => withCatalogClassification(record, category));
    this.state.rowHashes[category] = [...new Set(rowHashes || [])];
    this.persist();
  }

  markRowHash(category, hash) {
    category = normalizeCatalogCategory(category);
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

  listPending() {
    this.load();
    return Object.values(this.state.pendingBatches).map(clone);
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
      kind: batch.kind || 'import',
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
export { normalizeState as normalizeCatalogStoreState };
