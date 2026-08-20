import fs from 'node:fs/promises';
import path from 'node:path';
import { applyMigrationPlan, buildMigrationPlan, readPrivateBlobJson } from '../server/lib/storageMigration.js';
import { readPilotDocument, writePilotDocument } from '../server/lib/supabase.js';

const apply = process.argv.includes('--apply');
const replaceConflicts = process.argv.includes('--replace-conflicts');
const backupFlag = process.argv.find((argument) => argument.startsWith('--backup-dir='));
const stamp = new Date().toISOString().replaceAll(':', '-');
const backupDir = path.resolve(backupFlag?.slice('--backup-dir='.length) || path.join('.data', 'storage-migration', stamp));

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase server credentials are required');
if (replaceConflicts && !apply) throw new Error('--replace-conflicts requires --apply');

const entries = await buildMigrationPlan({ readBlob: readPrivateBlobJson, readTarget: readPilotDocument });
await fs.mkdir(backupDir, { recursive: true });
for (const entry of entries) {
  await fs.writeFile(path.join(backupDir, `${entry.key}.source.json`), JSON.stringify(entry.sourceState, null, 2), { encoding: 'utf8', flag: 'wx' });
  await fs.writeFile(path.join(backupDir, `${entry.key}.target.json`), JSON.stringify({ version: entry.targetVersion, state: entry.targetState }, null, 2), { encoding: 'utf8', flag: 'wx' });
}
const report = entries.map(({ key, blobPath, action, sourceHash, targetHash, targetVersion, source, target }) => ({ key, blobPath, action, sourceHash, targetHash, targetVersion, source, target }));
await fs.writeFile(path.join(backupDir, 'report.json'), JSON.stringify({ createdAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', replaceConflicts, stores: report }, null, 2), { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', replaceConflicts, backupDir, stores: report }, null, 2));

if (!apply) process.exit(0);
const applied = await applyMigrationPlan({ entries, writeTarget: writePilotDocument, readTarget: readPilotDocument, replaceConflicts });
console.log(JSON.stringify({ status: 'verified', applied }, null, 2));
