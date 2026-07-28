import { loadServerEnv } from '../server/lib/envFile.js';

// The preflight must observe the same server-only configuration the runtime
// uses.  Loading happens before the status modules are imported, because they
// read `process.env` at call time and would otherwise report a filled
// `.env.local` as missing configuration.
const loadedEnv = loadServerEnv();
const { getHandoffPreflight } = await import('../server/lib/handoffPreflight.js');

const profileArg = process.argv.find((value) => value.startsWith('--profile='));
// The public MVP is the current delivery gate. Corporate readiness is an
// explicit future profile, enabled only when SENAI-SP provisions Azure/Entra.
const profile = profileArg ? profileArg.slice('--profile='.length) : 'mvp';
const result = getHandoffPreflight(profile);
// Only file names and variable names are reported; never a value.
console.log(JSON.stringify({ ...result, envFiles: loadedEnv.files }, null, 2));
process.exitCode = result.ok ? 0 : 1;
