/**
 * Server-only loader for `.env` files.
 *
 * Vite reads `.env.local` into `import.meta.env`, which only reaches the
 * client bundle through the `VITE_` prefix.  The API handlers and the handoff
 * preflight run in Node and read `process.env`, so without this loader a
 * developer with a correctly filled `.env.local` still sees the session secret
 * as missing.
 *
 * Two guarantees keep the secret boundary intact:
 * - values already present in `process.env` always win, so a Vercel/CI
 *   environment is never overwritten by a file on disk;
 * - `VITE_`-prefixed names are ignored here, because anything the client may
 *   read is Vite's responsibility and must never be treated as a server secret.
 *
 * Nothing in this module returns or logs a value: callers only receive names.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_FILES = ['.env.local', '.env'];

function unquote(rawValue) {
  const value = rawValue.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) {
    const inner = value.slice(1, -1);
    return quote === '"' ? inner.replace(/\\n/g, '\n') : inner;
  }
  return value;
}

/**
 * Parse the textual content of an env file into a plain object.
 * Comments, blank lines and an optional `export ` prefix are tolerated.
 */
export function parseEnvFile(content) {
  const parsed = {};
  // Notepad on Windows saves UTF-8 with a BOM, which would otherwise glue
  // itself to the first variable name and make it disappear silently.
  for (const line of String(content || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (name.startsWith('VITE_')) continue;
    parsed[name] = unquote(rawValue);
  }
  return parsed;
}

/**
 * Load server-only env files into `env` without overriding existing values.
 * Returns which files were read and which names were applied, never values.
 */
export function loadServerEnv({ cwd = process.cwd(), files = DEFAULT_FILES, env = process.env } = {}) {
  const loadedFiles = [];
  const appliedNames = [];
  for (const file of files) {
    const filePath = path.resolve(cwd, file);
    if (!existsSync(filePath)) continue;
    let parsed;
    try {
      parsed = parseEnvFile(readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }
    loadedFiles.push(file);
    for (const [name, value] of Object.entries(parsed)) {
      if (String(env[name] || '').trim()) continue;
      env[name] = value;
      appliedNames.push(name);
    }
  }
  return { files: loadedFiles, applied: appliedNames };
}
