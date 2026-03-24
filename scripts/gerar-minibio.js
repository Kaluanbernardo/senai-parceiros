/**
 * Gera campo miniBio para cada pesquisador a partir do campo pesquisa.
 * Regra: primeira frase + segunda frase (se o total ficar <= 220 chars);
 *        caso contrário, apenas a primeira frase.
 *        Se a primeira frase sozinha for > 220 chars, trunca na última
 *        palavra antes de 220 chars e adiciona "…".
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const { readFileSync: fs_read, writeFileSync: fs_write } = { readFileSync, writeFileSync };

const DATA_PATH = join(__dirname, '../src/data/pesquisadores.json');

function buildMiniBio(pesquisa) {
  if (!pesquisa) return '';

  const sentences = pesquisa.match(/[^.!?]+[.!?]+/g) || [pesquisa];
  const s1 = sentences[0]?.trim() || '';
  const s2 = sentences[1]?.trim() || '';

  const MAX = 220;

  // Tenta encaixar duas frases
  if (s2) {
    const combined = `${s1} ${s2}`;
    if (combined.length <= MAX) return combined;
  }

  // Apenas primeira frase
  if (s1.length <= MAX) return s1;

  // Trunca na última palavra antes de MAX
  const truncated = s1.slice(0, MAX).replace(/\s+\S*$/, '') + '…';
  return truncated;
}

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

let count = 0;
for (const p of data) {
  const miniBio = buildMiniBio(p.pesquisa);
  p.miniBio = miniBio;
  count++;
}

writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ miniBio gerado para ${count} pesquisadores.`);
