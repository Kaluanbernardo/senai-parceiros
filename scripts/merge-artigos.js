import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_PATH = join(__dirname, '../src/data/pesquisadores.json');
const ARTIGOS_PATH = join(__dirname, './artigos-data.json');

const pesquisadores = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const artigosMap = JSON.parse(readFileSync(ARTIGOS_PATH, 'utf8'));

const byId = {};
for (const entry of artigosMap) byId[entry.id] = entry.artigos;

let count = 0;
for (const p of pesquisadores) {
  if (byId[p.id]) {
    p.artigos = byId[p.id];
    count++;
  }
}

writeFileSync(DATA_PATH, JSON.stringify(pesquisadores, null, 2), 'utf8');
console.log(`✅ artigos adicionados a ${count} pesquisadores.`);
