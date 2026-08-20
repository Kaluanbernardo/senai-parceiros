import crypto from 'node:crypto';
import { requireSession } from '../../lib/cookies.js';
import { methodNotAllowed, requireSameOrigin } from '../../lib/http.js';
import { applyMigrationPlan, buildMigrationPlan, buildVersionedBaselinePlan, readPrivateBlobJson } from '../../lib/storageMigration.js';
import { readPilotDocument, writePilotDocument } from '../../lib/supabase.js';

function publicPlan(entries) {
  return entries.map(({ key, blobPath, action, sourceHash, targetHash, targetVersion, source, target }) => ({
    key, blobPath, action, sourceHash, targetHash, targetVersion, source, target,
  }));
}

function safeFailureCode(message) {
  if (/Failed to fetch blob: \d{3}/.test(message)) {
    return `blob_http_${message.match(/Failed to fetch blob: (\d{3})/)[1]}`;
  }
  if (message.includes('Invalid token')) return 'blob_invalid_token';
  if (message.includes('No token found')) return 'blob_token_missing';
  if (message.includes('Response body is null')) return 'blob_empty_response';
  if (message.startsWith('blob_read_failed:')) return `blob_http_${message.split(':').at(-1)}`;
  return message.startsWith('Vercel Blob') ? 'blob_sdk_error' : 'storage_error';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.STORAGE_MIGRATION_ENABLED !== 'true') return res.status(404).json({ error: 'not_found' });
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST']);
  if (!requireSameOrigin(req, res)) return;
  const session = requireSession(req, res, ['admin']);
  if (!session) return;

  try {
    const baselineRecovery = req.method === 'POST' && req.body?.action === 'bootstrap-versioned-baseline';
    const entries = baselineRecovery
      ? await buildVersionedBaselinePlan({ readTarget: readPilotDocument })
      : await buildMigrationPlan({ readBlob: readPrivateBlobJson, readTarget: readPilotDocument });
    if (req.method === 'GET') return res.status(200).json({ mode: 'dry-run', stores: publicPlan(entries) });
    if (!['apply', 'bootstrap-versioned-baseline'].includes(req.body?.action) || req.body?.confirmation !== 'discard-supabase-test-writes') {
      return res.status(400).json({ error: 'migration_confirmation_required' });
    }

    const backupId = `${new Date().toISOString()}-${crypto.randomUUID()}`;
    for (const entry of entries.filter((candidate) => candidate.targetVersion > 0)) {
      await writePilotDocument(`migration-backup:${backupId}:${entry.key}`, {
        originalKey: entry.key,
        originalVersion: entry.targetVersion,
        originalHash: entry.targetHash,
        state: entry.targetState,
      }, 0);
    }
    const applied = await applyMigrationPlan({
      entries,
      writeTarget: writePilotDocument,
      readTarget: readPilotDocument,
      replaceConflicts: true,
    });
    return res.status(200).json({ status: 'verified', mode: baselineRecovery ? 'versioned-baseline' : 'blob-copy', backupId, applied, stores: publicPlan(entries) });
  } catch (error) {
    const message = String(error?.message || 'storage_migration_failed');
    const conflict = message.startsWith('migration_conflict:');
    const code = conflict ? 'conflict' : safeFailureCode(message);
    console.error('storage_migration_failed', { code });
    return res.status(conflict ? 409 : 503).json({ error: conflict ? message : 'storage_migration_failed', ...(!conflict && { code }) });
  }
}
