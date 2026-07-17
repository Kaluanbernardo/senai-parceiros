import fs from 'node:fs';
import path from 'node:path';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class RadarStore {
  constructor() {
    this.driver = String(process.env.RADAR_STORE_DRIVER || (process.env.RADAR_STORE_FILE ? 'file' : 'memory')).toLowerCase();
    this.filePath = process.env.RADAR_STORE_FILE || path.join(process.cwd(), '.data', 'radar-store.json');
    this.state = { snapshot: null, lastRun: null };
    this.loaded = false;
  }

  configure({ driver, filePath } = {}) {
    if (driver) this.driver = String(driver).toLowerCase();
    if (filePath) this.filePath = filePath;
    this.state = { snapshot: null, lastRun: null };
    this.loaded = false;
    this.load();
    return this.status();
  }

  status() {
    return { driver: this.driver, durable: this.driver === 'file' };
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
    if (this.driver === 'file') {
      try { fs.rmSync(this.filePath, { force: true }); } catch { /* test cleanup */ }
    }
  }
}

export const radarStore = new RadarStore();
