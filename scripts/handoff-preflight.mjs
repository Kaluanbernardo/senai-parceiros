import { getHandoffPreflight } from '../server/lib/handoffPreflight.js';

const profileArg = process.argv.find((value) => value.startsWith('--profile='));
// The public MVP is the current delivery gate. Corporate readiness is an
// explicit future profile, enabled only when SENAI-SP provisions Azure/Entra.
const profile = profileArg ? profileArg.slice('--profile='.length) : 'mvp';
const result = getHandoffPreflight(profile);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
