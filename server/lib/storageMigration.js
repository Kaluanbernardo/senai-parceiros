import crypto from 'node:crypto';

export const MIGRATED_STORES = Object.freeze([
  { key: 'catalog-store', blobPathEnv: 'CATALOG_BLOB_PATH', defaultBlobPath: 'senai/catalog/manifest.json' },
  { key: 'radar-store', blobPathEnv: 'RADAR_BLOB_PATH', defaultBlobPath: 'senai/radar/snapshot.json' },
  { key: 'ai-usage', blobPathEnv: 'AI_BUDGET_BLOB_PATH', defaultBlobPath: 'senai/ai/usage-budget.json' },
  { key: 'rate-limit', blobPathEnv: 'RATE_LIMIT_BLOB_PATH', defaultBlobPath: 'senai/security/rate-limits.json' },
]);

export const VERSIONED_BASELINE_STATES = Object.freeze({
  'catalog-store': { records: { person: [], organization: [] }, rowHashes: { person: [], organization: [] }, pendingBatches: {}, committedBatches: {} },
  'radar-store': { snapshot: null, lastRun: null },
  'ai-usage': { entries: {} },
  'rate-limit': { entries: {} },
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function stateHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function summarizeState(key, state) {
  if (state == null) return { present: false };
  if (key === 'catalog-store') {
    return {
      present: true,
      people: state.records?.person?.length || state.records?.researcher?.length || 0,
      organizations: state.records?.organization?.length || state.records?.school?.length || 0,
      pendingBatches: Object.keys(state.pendingBatches || {}).length,
      committedBatches: Object.keys(state.committedBatches || {}).length,
    };
  }
  if (key === 'radar-store') {
    return { present: true, items: state.snapshot?.items?.length || 0, hasLastRun: Boolean(state.lastRun) };
  }
  return { present: true, entries: Object.keys(state || {}).length };
}

export function planStoreMigration({ key, sourceState, targetState, targetVersion }) {
  const sourceHash = sourceState == null ? null : stateHash(sourceState);
  const targetExists = Number(targetVersion) > 0;
  const targetHash = targetExists ? stateHash(targetState) : null;
  let action;
  if (sourceState == null) action = targetExists ? 'destination_only' : 'empty';
  else if (!targetExists) action = 'copy';
  else if (sourceHash === targetHash) action = 'already_migrated';
  else action = 'conflict';
  return {
    key,
    action,
    sourceHash,
    targetHash,
    targetVersion: Number(targetVersion) || 0,
    source: summarizeState(key, sourceState),
    target: summarizeState(key, targetExists ? targetState : null),
  };
}

export async function buildMigrationPlan({ readBlob, readTarget, stores = MIGRATED_STORES }) {
  const entries = [];
  for (const store of stores) {
    const blobPath = process.env[store.blobPathEnv] || store.defaultBlobPath;
    const [sourceState, target] = await Promise.all([readBlob(blobPath), readTarget(store.key)]);
    entries.push({
      store,
      blobPath,
      sourceState,
      targetState: target.state,
      ...planStoreMigration({ key: store.key, sourceState, targetState: target.state, targetVersion: target.version }),
    });
  }
  return entries;
}

export async function buildVersionedBaselinePlan({ readTarget, stores = MIGRATED_STORES }) {
  const entries = [];
  for (const store of stores) {
    const sourceState = VERSIONED_BASELINE_STATES[store.key];
    if (!sourceState) throw new Error(`versioned_baseline_missing:${store.key}`);
    const target = await readTarget(store.key);
    entries.push({
      store,
      blobPath: null,
      sourceState,
      targetState: target.state,
      ...planStoreMigration({ key: store.key, sourceState, targetState: target.state, targetVersion: target.version }),
    });
  }
  return entries;
}

export async function readPrivateBlobJson(blobPath) {
  const { get } = await import('@vercel/blob');
  // Vercel injects OIDC into every deployment. Passing the store token here is
  // deliberate: otherwise the SDK gives OIDC precedence and a legacy Blob
  // store can reject the read even though its connected token is available.
  const result = await get(blobPath, { access: 'private', useCache: false, token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) throw new Error(`blob_read_failed:${blobPath}:${result.statusCode || 'unknown'}`);
  return JSON.parse(await new Response(result.stream).text());
}

export async function applyMigrationPlan({ entries, writeTarget, readTarget, replaceConflicts = false }) {
  const conflicts = entries.filter((entry) => entry.action === 'conflict');
  if (conflicts.length && !replaceConflicts) throw new Error(`migration_conflict:${conflicts.map((entry) => entry.key).join(',')}`);
  const applied = [];
  try {
    for (const entry of entries.filter((candidate) => candidate.action === 'copy' || (replaceConflicts && candidate.action === 'conflict'))) {
      const result = await writeTarget(entry.key, entry.sourceState, entry.targetVersion || 0);
      const verified = await readTarget(entry.key);
      if (stateHash(verified.state) !== entry.sourceHash) throw new Error(`migration_verification_failed:${entry.key}`);
      applied.push({ entry, writtenVersion: Number(result.version) || Number(verified.version) || 1 });
    }
    return applied.map(({ entry, writtenVersion }) => ({ key: entry.key, version: writtenVersion, hash: entry.sourceHash }));
  } catch (error) {
    for (const { entry, writtenVersion } of applied.reverse()) {
      try { await writeTarget(entry.key, entry.targetState || {}, writtenVersion); } catch { /* preserve the original failure */ }
    }
    throw error;
  }
}
