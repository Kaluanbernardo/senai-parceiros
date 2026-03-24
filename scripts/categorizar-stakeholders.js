import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_PATH = join(__dirname, '../src/data/stakeholders.json');

// Categoria: 'Empresa' | 'Escola' | 'Pública/PPP' | 'Terceiro setor'
const categoriaMap = {
  // Empresas privadas (comerciais)
  5: 'Empresa', 9: 'Empresa', 15: 'Empresa', 21: 'Empresa', 24: 'Empresa',
  46: 'Empresa', 53: 'Empresa', 62: 'Empresa', 70: 'Empresa', 77: 'Empresa', 88: 'Empresa',

  // Escolas (instituições de ensino/formação)
  2: 'Escola', 6: 'Escola', 8: 'Escola', 12: 'Escola', 18: 'Escola', 22: 'Escola',
  34: 'Escola', 35: 'Escola', 36: 'Escola', 37: 'Escola', 39: 'Escola', 42: 'Escola',
  43: 'Escola', 44: 'Escola', 49: 'Escola', 52: 'Escola', 55: 'Escola', 60: 'Escola',
  61: 'Escola', 63: 'Escola', 65: 'Escola', 67: 'Escola', 68: 'Escola', 69: 'Escola',
  72: 'Escola', 73: 'Escola', 74: 'Escola', 75: 'Escola', 76: 'Escola', 78: 'Escola',
  81: 'Escola', 84: 'Escola', 86: 'Escola', 87: 'Escola', 89: 'Escola', 90: 'Escola',
  95: 'Escola', 96: 'Escola',

  // Instituições públicas e público-privadas
  3: 'Pública/PPP', 4: 'Pública/PPP', 7: 'Pública/PPP', 10: 'Pública/PPP', 11: 'Pública/PPP',
  13: 'Pública/PPP', 19: 'Pública/PPP', 20: 'Pública/PPP', 23: 'Pública/PPP', 28: 'Pública/PPP',
  29: 'Pública/PPP', 31: 'Pública/PPP', 32: 'Pública/PPP', 33: 'Pública/PPP', 38: 'Pública/PPP',
  40: 'Pública/PPP', 41: 'Pública/PPP', 45: 'Pública/PPP', 47: 'Pública/PPP', 48: 'Pública/PPP',
  50: 'Pública/PPP', 51: 'Pública/PPP', 54: 'Pública/PPP', 57: 'Pública/PPP', 58: 'Pública/PPP',
  59: 'Pública/PPP', 64: 'Pública/PPP', 71: 'Pública/PPP', 79: 'Pública/PPP', 80: 'Pública/PPP',
  91: 'Pública/PPP', 92: 'Pública/PPP', 94: 'Pública/PPP', 99: 'Pública/PPP',

  // Terceiro setor (ONGs, fundações, associações)
  1: 'Terceiro setor', 14: 'Terceiro setor', 16: 'Terceiro setor', 17: 'Terceiro setor',
  25: 'Terceiro setor', 26: 'Terceiro setor', 27: 'Terceiro setor', 30: 'Terceiro setor',
  56: 'Terceiro setor', 66: 'Terceiro setor', 82: 'Terceiro setor', 83: 'Terceiro setor',
  85: 'Terceiro setor', 93: 'Terceiro setor', 97: 'Terceiro setor', 98: 'Terceiro setor',
  100: 'Terceiro setor',
};

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

for (const item of data) {
  item.categoria = categoriaMap[item.id] || 'Pública/PPP';
}

writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

const counts = {};
for (const item of data) {
  counts[item.categoria] = (counts[item.categoria] || 0) + 1;
}
console.log('✅ categoria adicionada a todos os stakeholders:');
for (const [cat, n] of Object.entries(counts)) console.log(`   ${cat}: ${n}`);
