import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * O frontend e o roteamento por arquivos da Vercel precisam concordar.
 *
 * `api/selection/interview-next.js` é servido em `/api/selection/interview-next`;
 * o frontend chamava `/api/selection/interview/next`, que não existe lá. Como o
 * `vercel.json` reescreve tudo que sobra para a SPA, a chamada devolvia o
 * `index.html` com status 200 e o cliente só via um JSON inválido — a
 * entrevista adaptativa nunca funcionou em produção, embora funcionasse no
 * desenvolvimento, onde um mapa de rotas em memória aceitava o caminho antigo.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Caminhos servidos pela Vercel, derivados dos arquivos em `api/`. */
function deployedRoutes() {
  const files = walk(path.join(root, 'api'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => `/api/${path.relative(path.join(root, 'api'), file).replace(/\\/g, '/').replace(/\.js$/, '')}`);
  const rewrites = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')).rewrites
    .map((rewrite) => rewrite.source)
    .filter((source) => source.startsWith('/api/'))
    .map((source) => source.replace(/:([^/]+)/g, '[$1]'));
  return [...files, ...rewrites];
}

/** Um segmento dinâmico `[action]` casa exatamente um segmento do caminho. */
function routeMatches(route, requested) {
  const routeParts = route.split('/');
  const requestedParts = requested.split('/');
  if (routeParts.length !== requestedParts.length) return false;
  return routeParts.every((part, index) => /^\[.+\]$/.test(part) || part === requestedParts[index]);
}

function frontendApiCalls() {
  return walk(path.join(root, 'src'))
    .filter((file) => /\.jsx?$/.test(file) && !file.endsWith('.test.js'))
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/fetch\('(\/api\/[^'?]+)/g)]
      .map((match) => ({ file: path.relative(root, file), url: match[1] })));
}

describe('API routing', () => {
  it('serves every path the frontend calls', () => {
    const routes = deployedRoutes();
    const unreachable = frontendApiCalls().filter(({ url }) => !routes.some((route) => routeMatches(route, url)));

    expect(unreachable).toEqual([]);
  });

  it('keeps the development route map identical to the deployed routes', async () => {
    const plugin = readFileSync(path.join(root, 'server/viteApiPlugin.js'), 'utf8');
    const declared = [...plugin.matchAll(/^\s*'(\/api\/[^']+)':/gm)].map((match) => match[1]);
    const routes = deployedRoutes();
    // Um mapa de desenvolvimento mais permissivo esconde exatamente o defeito
    // que este arquivo existe para impedir.
    const devOnly = declared.filter((url) => !routes.some((route) => routeMatches(route, url)));

    expect(devOnly).toEqual([]);
    expect(declared.length).toBeGreaterThan(0);
  });

  it('reaches the adaptive interview endpoint that the selection page calls', () => {
    const page = readFileSync(path.join(root, 'src/pages/SelectionPage.jsx'), 'utf8');
    const url = page.match(/fetch\('(\/api\/selection\/[^']*interview[^']*)'/)?.[1];

    expect(url).toBe('/api/selection/interview-next');
    expect(existsSync(path.join(root, 'api/selection/interview-next.js'))).toBe(true);
  });
});
