import fs from 'node:fs/promises';
import path from 'node:path';

const dataPath = path.resolve('src/data/pesquisadores.json');
const readJson = async (file) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const data = await readJson(dataPath);
const mapFiles = (await fs.readdir('tmp')).filter((file) => file.startsWith('image-map-') && file.endsWith('.json'));
const maps = [];
for (const file of mapFiles) maps.push(...await readJson(path.join('tmp', file)));
let applied = 0;
for (const item of maps) {
  const person = data.find((entry) => entry.id === item.id);
  const imagePath = item.path || (item.file ? `/fotos/${item.file}` : null);
  if (!person || !imagePath || !item.sourceUrl) continue;
  try { await fs.access(path.resolve('public', `.${imagePath}`)); } catch { continue; }
  person.foto = imagePath;
  person.image = {
    path: imagePath,
    sourceUrl: item.sourceUrl,
    sourceType: item.sourceType || 'public-professional',
    license: item.license || 'unknown',
    attribution: item.attribution || 'Fonte pública identificada',
    retrievedAt: new Date().toISOString().slice(0, 10),
    status: 'approved',
    confidence: Number(item.confidence) || 80,
    reviewedAt: new Date().toISOString().slice(0, 10),
  };
  applied += 1;
}
await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`APPLIED ${applied} FROM ${mapFiles.length} MAPS`);
