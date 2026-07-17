import { getHandoffPreflight } from '../server/lib/handoffPreflight.js';

const profileArg = process.argv.find((value) => value.startsWith('--profile='));
const profile = profileArg ? profileArg.slice('--profile='.length) : 'corporate';
const result = getHandoffPreflight(profile);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
