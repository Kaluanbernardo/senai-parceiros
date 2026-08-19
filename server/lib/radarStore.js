import fs from 'node:fs';
import path from 'node:path';
import { readPilotDocument, writePilotDocument } from './supabase.js';

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
    return { driver: this.driver, durable: this.driver === 'file' || this.driver === 'vercel_blob' || this.driver === 'supabase' };
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
    if (this.driver === 'supabase') {
      if (!force && this.remoteHydrated) return this.status();
      const current = await readPilotDocument('radar-store');
      this.state = { snapshot: current.state?.snapshot || null, lastRun: current.state?.lastRun || null };
      this.remoteVersion = current.version;
      this.remoteHydrated = true;
      this.loaded = true;
      return this.status();
    }
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

  /**
   * Reads the current remote ETag without touching local state.  `hydrate`
   * cannot be reused here: it replaces `this.state` with the remote document,
   * which would discard the very snapshot the retry is trying to write.
   */
  async refreshRemoteEtag() {
    try {
      const { head } = await import('@vercel/blob');
      const info = await head(this.blobPath);
      this.remoteEtag = info?.etag || null;
    } catch {
      // A blob we cannot describe is one we should write unconditionally.
      this.remoteEtag = null;
    }
  }

  /**
   * Optimistic CAS with bounded retries, matching `atomicJsonStore`.  Sending
   * `ifMatch` without any recovery made a single mismatch permanent: nothing
   * refreshed the stale ETag, so every later write failed too and the radar
   * could never persist a snapshot again.
   *
   * The final attempt drops the precondition deliberately. This blob holds one
   * whole snapshot written by a single logical writer — the daily cron or an
   * admin — so losing the race means the newer complete snapshot wins, which is
   * the intended outcome and strictly better than never writing at all.
   */
  async flush({ attempts = 3 } = {}) {
    if (this.driver === 'supabase') {
      const result = await writePilotDocument('radar-store', this.state, this.remoteVersion);
      this.remoteVersion = result.version;
      this.remoteHydrated = true;
      return this.status();
    }
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

export const radarStore = new RadarStore();
