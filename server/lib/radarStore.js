import fs from 'node:fs';
import path from 'node:path';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class RadarStore {
  constructor() {
    this.driver = String(process.env.RADAR_STORE_DRIVER || (process.env.RADAR_STORE_FILE ? 'file' : 'memory')).toLowerCase();
    this.filePath = process.env.RADAR_STORE_FILE || path.join(process.cwd(), '.data', 'radar-store.json');
    this.blobPath = process.env.RADAR_BLOB_PATH || 'senai/radar/snapshot.json';
    this.state = { snapshot: null, lastRun: null };
    this.loaded = false;
    this.remoteHydrated = false;
    this.remoteEtag = null;
  }

  configure({ driver, filePath } = {}) {
    if (driver) this.driver = String(driver).toLowerCase();
    if (filePath) this.filePath = filePath;
    this.state = { snapshot: null, lastRun: null };
    this.loaded = false;
    this.remoteHydrated = false;
    this.remoteEtag = null;
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
      this.state = { snapshot: parsed.snapshot || null, lastRun: parsed.lastRun || null };
    } catch (error) {
      if (error?.code !== 'ENOENT') console.warn('[radar-store] failed to load store', error.message);
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

  getSnapshot() {
    this.load();
    return this.state.snapshot ? clone(this.state.snapshot) : null;
  }

  writeSnapshot(snapshot) {
    this.load();
    this.state.snapshot = clone(snapshot);
    this.persist();
    return this.getSnapshot();
  }

  recordRun(run) {
    this.load();
    this.state.lastRun = clone(run);
    this.persist();
    return this.state.lastRun;
  }

  getLastRun() {
    this.load();
    return this.state.lastRun ? clone(this.state.lastRun) : null;
  }

  resetForTests() {
    this.state = { snapshot: null, lastRun: null };
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
      const parsed = JSON.parse(await new Response(result.stream).text());
      this.state = { snapshot: parsed.snapshot || null, lastRun: parsed.lastRun || null };
      this.remoteEtag = result.blob?.etag || null;
    }
    this.remoteHydrated = true;
    this.loaded = true;
    return this.status();
  }

  async flush() {
    if (this.driver !== 'vercel_blob') return this.status();
    const { put } = await import('@vercel/blob');
    const options = { access: 'private', allowOverwrite: true, contentType: 'application/json' };
    if (this.remoteEtag) options.ifMatch = this.remoteEtag;
    const result = await put(this.blobPath, JSON.stringify(this.state), options);
    this.remoteEtag = result.etag || this.remoteEtag;
    this.remoteHydrated = true;
    return this.status();
  }
}

export const radarStore = new RadarStore();
