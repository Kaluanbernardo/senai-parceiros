import crypto from 'node:crypto';

const BOILERPLATE = [
  /^pesquisa\s+de\b/i,
  /^publica(?:do|da)\s+em\b/i,
  /^metadados\s+(?:doi|recuperados)/i,
  /consulte\s+(?:o\s+)?(?:doi|fonte)\s+original/i,
];

function stripMarkup(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAbstractText(value, max = 16000) {
  return stripMarkup(value).slice(0, max).trim();
}

export function reconstructOpenAlexAbstract(index) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return '';
  const tokens = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      const numeric = Number(position);
      if (Number.isInteger(numeric) && numeric >= 0) tokens.push([numeric, word]);
    }
  }
  tokens.sort((left, right) => left[0] - right[0] || String(left[1]).localeCompare(String(right[1])));
  return normalizeAbstractText(tokens.map(([, word]) => word).join(' '));
}

export function extractCrossrefAbstract(work) {
  return normalizeAbstractText(work?.abstract || work?.description || '');
}

export function abstractInputHash({ id, abstractText, title } = {}) {
  return crypto.createHash('sha256')
    .update(`${String(id || '')}\n${String(title || '')}\n${normalizeAbstractText(abstractText)}`)
    .digest('hex');
}

function sentenceParts(value) {
  return normalizeAbstractText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function buildEvidenceFallback(abstractText, { maxWords = 80 } = {}) {
  const source = normalizeAbstractText(abstractText);
  if (!source) return 'A fonte não disponibilizou resumo deste trabalho.';
  const sentences = sentenceParts(source);
  const selected = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).length;
    if (selected.length && words + count > maxWords) break;
    selected.push(sentence);
    words += count;
    if (selected.length >= 3 || words >= 45) break;
  }
  return (selected.length ? selected.join(' ') : source.split(/\s+/).slice(0, maxWords).join(' ')).trim();
}

export function validateResearchSummary(summary, { title = '', authors = [], publishedAt = '' } = {}) {
  const value = normalizeAbstractText(summary, 1200);
  if (!value || value === 'A fonte não disponibilizou resumo deste trabalho.') return false;
  if (BOILERPLATE.some((pattern) => pattern.test(value))) return false;
  const folded = value.toLocaleLowerCase('pt-BR');
  if (title && folded.includes(String(title).trim().toLocaleLowerCase('pt-BR'))) return false;
  if (publishedAt && folded.includes(String(publishedAt))) return false;
  const authorValues = Array.isArray(authors) ? authors : [];
  const repeatedAuthor = authorValues.some((author) => {
    const name = String(author || '').trim().toLocaleLowerCase('pt-BR');
    return name.length >= 8 && folded.includes(name);
  });
  if (repeatedAuthor) return false;
  return value.split(/\s+/).length >= 12;
}

export function buildSummaryMetadata({ source = 'unknown', status = 'unavailable', provider = null, model = null, sourceText = '', summary = '', id, title } = {}) {
  return {
    summaryStatus: ['source', 'ai', 'extractive', 'unavailable'].includes(status) ? status : 'unavailable',
    summaryInputHash: abstractInputHash({ id, title, abstractText: sourceText }),
    summaryUpdatedAt: new Date().toISOString(),
    summaryProvenance: { source, provider, model },
    summaryPt: normalizeAbstractText(summary || buildEvidenceFallback(sourceText), 1200),
  };
}

function identityKey(item) {
  return String(item?.doi || item?.externalId || item?.id || `${item?.sourceName}:${item?.title || ''}`)
    .trim().toLowerCase().replace(/^https?:\/\/doi.org\//, '');
}

export function mergeResearchItems(items = []) {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = identityKey(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...item, provenance: item?.provenance ? { ...item.provenance } : undefined });
      continue;
    }
    const sourceText = normalizeAbstractText(existing.abstractText || existing.abstract || '');
    const candidateText = normalizeAbstractText(item.abstractText || item.abstract || '');
    if (candidateText.length > sourceText.length) {
      existing.abstractText = candidateText;
      existing.summaryPt = item.summaryPt || existing.summaryPt;
      existing.summaryStatus = item.summaryStatus || existing.summaryStatus;
    }
    existing.authors = [...new Set([...(existing.authors || []), ...(item.authors || [])])];
    existing.provenance = { ...(existing.provenance || {}), ...(item.provenance || {}), mergedProviders: [...new Set([...(existing.provenance?.mergedProviders || []), existing.provider, item.provider].filter(Boolean))] };
  }
  return [...groups.values()];
}

export { stripMarkup };
