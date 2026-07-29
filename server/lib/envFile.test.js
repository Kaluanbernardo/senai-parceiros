import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadServerEnv, parseEnvFile } from './envFile.js';

const created = [];

function fixtureDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'senai-env-'));
  created.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content, 'utf8');
  return dir;
}

afterEach(() => {
  while (created.length) rmSync(created.pop(), { recursive: true, force: true });
});

describe('parseEnvFile', () => {
  it('reads names, tolerates comments, export and quotes', () => {
    const parsed = parseEnvFile([
      '# comentário',
      '',
      'AUTH_SESSION_SECRET=segredo-local-com-mais-de-32-caracteres',
      'export PUBLIC_APP_ORIGIN="http://localhost:5173"',
      "AI_PROVIDER='openrouter'",
      'linha invalida',
    ].join('\n'));
    expect(parsed).toEqual({
      AUTH_SESSION_SECRET: 'segredo-local-com-mais-de-32-caracteres',
      PUBLIC_APP_ORIGIN: 'http://localhost:5173',
      AI_PROVIDER: 'openrouter',
    });
  });

  it('survives the UTF-8 BOM written by Notepad on Windows', () => {
    // Without this, editing .env.local in Notepad would silently drop the
    // first variable of the file.
    const parsed = parseEnvFile('﻿AUTH_SESSION_SECRET=segredo-local-com-mais-de-32-caracteres\n');
    expect(parsed.AUTH_SESSION_SECRET).toBe('segredo-local-com-mais-de-32-caracteres');
  });

  it('ignores VITE_ names so a secret is never treated as server configuration', () => {
    expect(parseEnvFile('VITE_OPENROUTER_API_KEY=nao-deve-carregar\nOPENROUTER_API_KEY=ok')).toEqual({
      OPENROUTER_API_KEY: 'ok',
    });
  });
});

describe('loadServerEnv', () => {
  it('applies missing names and reports only names', () => {
    const cwd = fixtureDir({ '.env.local': 'PUBLIC_APP_ORIGIN=http://localhost:5173\n' });
    const env = {};
    const result = loadServerEnv({ cwd, env });
    expect(env.PUBLIC_APP_ORIGIN).toBe('http://localhost:5173');
    expect(result.files).toEqual(['.env.local']);
    expect(result.applied).toEqual(['PUBLIC_APP_ORIGIN']);
    expect(JSON.stringify(result)).not.toContain('localhost:5173');
  });

  it('never overrides a value already provided by the deployment environment', () => {
    const cwd = fixtureDir({ '.env.local': 'AUTH_SESSION_SECRET=valor-do-arquivo\n' });
    const env = { AUTH_SESSION_SECRET: 'valor-do-ambiente' };
    const result = loadServerEnv({ cwd, env });
    expect(env.AUTH_SESSION_SECRET).toBe('valor-do-ambiente');
    expect(result.applied).toEqual([]);
  });

  it('gives precedence to .env.local over .env and ignores missing files', () => {
    const cwd = fixtureDir({
      '.env.local': 'AI_PROVIDER=openrouter\n',
      '.env': 'AI_PROVIDER=openai\nRADAR_LIVE_SOURCES=false\n',
    });
    const env = {};
    loadServerEnv({ cwd, env });
    expect(env.AI_PROVIDER).toBe('openrouter');
    expect(env.RADAR_LIVE_SOURCES).toBe('false');
    expect(loadServerEnv({ cwd: fixtureDir({}), env: {} }).files).toEqual([]);
  });
});
