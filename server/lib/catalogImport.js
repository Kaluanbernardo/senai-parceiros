import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { CATALOG_METADATA_SHEET_NAME, CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, getCatalogHeaders, normalizeCell, rowToCanonical, validateCatalogHeaders, validateCatalogRow } from '../../src/domain/catalogImportSchema.js';
import { normalizeResearcherName } from '../../src/domain/researcherCatalog.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const pendingBatches = new Map();
const committedBatches = new Map();
const importedRecords = { researcher: [], school: [], organization: [] };

function fold(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function domain(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function rowValues(row) {
  return row.values.slice(1).map((value) => {
    if (value && typeof value === 'object' && value.formula) throw new Error('formulas_not_allowed');
    return normalizeCell(value);
  });
}

function detectCategory(headers, requestedCategory) {
  if (requestedCategory && getCatalogHeaders(requestedCategory).every((header, index) => headers[index] === header)) return requestedCategory;
  return ['researcher', 'school', 'organization'].find((category) => validateCatalogHeaders(headers, category).valid) || null;
}

function matchKey(category, record) {
  if (category === 'researcher') {
    const scholar = String(record.scholar || '').match(/[?&]user=([^&]+)/i)?.[1];
    if (scholar) return `scholar:${scholar}`;
    if (record.orcid) return `orcid:${String(record.orcid).toUpperCase()}`;
    return `name:${normalizeResearcherName(record.nome)}|institution:${fold(record.instituicao)}|country:${fold(record.pais)}`;
  }
  if (record.identificador_publico) return `public:${fold(record.identificador_publico)}`;
  const websiteDomain = domain(record.website || record.website_oficial || record.dominio_oficial);
  return websiteDomain ? `domain:${websiteDomain}` : `name:${fold(record.nome || record.instituicao)}|country:${fold(record.pais)}`;
}

function hashRow(row) {
  return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function catalogKey(category, candidate) {
  return matchKey(category, candidate);
}

function makeId(category, record) {
  const prefix = category === 'researcher' ? 'r' : category === 'school' ? 's' : 'o';
  const existing = importedRecords[category].reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  return `${prefix}-import-${existing + 1}-${hashRow(record).slice(0, 8)}`;
}

export async function parseCatalogWorkbook({ contentBase64, filename, category: requestedCategory } = {}) {
  if (!filename || !/\.xlsx$/i.test(filename) || /\.(xlsm|xls)$/i.test(filename)) throw new Error('xlsx_only');
  if (typeof contentBase64 !== 'string') throw new Error('file_content_required');
  const buffer = Buffer.from(contentBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('file_too_large');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, { ignoreNodes: ['extLst'] });
  const sheet = workbook.getWorksheet(CATALOG_SHEET_NAME);
  if (!sheet) throw new Error('stakeholders_sheet_required');
  if (sheet.rowCount < 2) throw new Error('stakeholders_rows_required');
  if (sheet.rowCount - 1 > MAX_ROWS) throw new Error('too_many_rows');
  const headers = rowValues(sheet.getRow(1));
  const category = detectCategory(headers, requestedCategory);
  if (!category) throw new Error('invalid_headers');
  const headerValidation = validateCatalogHeaders(headers, category);
  if (!headerValidation.valid) throw new Error(`invalid_headers:${headerValidation.errors.join(' ')}`);
  const rows = [];
  const errors = [];
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const values = rowValues(sheet.getRow(index));
    if (values.every((value) => !value)) continue;
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] || '']));
    const validation = validateCatalogRow(row, category, index);
    if (!validation.valid) errors.push(...validation.errors);
    rows.push({ rowNumber: index, row, record: rowToCanonical(row), valid: validation.valid, errors: validation.errors, hash: hashRow(row) });
  }
  const metadataSheet = workbook.getWorksheet(CATALOG_METADATA_SHEET_NAME);
  const metadata = {};
  metadataSheet?.eachRow((row) => {
    const [key, value] = row.values.slice(1);
    if (key) metadata[String(key).trim()] = normalizeCell(value);
  });
  return { schemaVersion: CATALOG_SCHEMA_VERSION, category, headers, rows, errors, metadata, filename, rowCount: rows.length };
}

export function previewCatalogImport(parsed, catalog = []) {
  const existingByKey = new Map(catalog.map((candidate) => [catalogKey(parsed.category, candidate), candidate]));
  const rows = parsed.rows.map((entry) => {
    if (!entry.valid) return { ...entry, status: 'invalid', match: null };
    const match = existingByKey.get(catalogKey(parsed.category, entry.record));
    return { ...entry, status: match ? 'possible_duplicate' : 'new', match: match ? { id: match.id, name: match.nome || match.instituicao } : null };
  });
  const batchId = `import-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const preview = {
    batchId, schemaVersion: parsed.schemaVersion, category: parsed.category, filename: parsed.filename,
    metadata: parsed.metadata, rows,
    counts: { total: rows.length, new: rows.filter((row) => row.status === 'new').length, possibleDuplicate: rows.filter((row) => row.status === 'possible_duplicate').length, invalid: rows.filter((row) => row.status === 'invalid').length },
    createdAt: new Date().toISOString(),
  };
  pendingBatches.set(batchId, preview);
  return preview;
}

export function commitCatalogImport(batchId, decisions = {}) {
  const preview = pendingBatches.get(batchId);
  if (!preview) throw new Error('import_preview_not_found');
  const before = [...importedRecords[preview.category]];
  const applied = [];
  const appliedRecords = [];
  const ignored = [];
  const conflicts = [];
  for (const row of preview.rows) {
    if (row.status === 'invalid') { ignored.push({ rowNumber: row.rowNumber, reason: 'invalid' }); continue; }
    const decision = decisions[String(row.rowNumber)] || (row.status === 'new' ? 'use_imported' : 'keep_existing');
    if (decision === 'keep_existing' || decision === 'ignore') { ignored.push({ rowNumber: row.rowNumber, reason: decision }); continue; }
    const key = catalogKey(preview.category, row.record);
    const existingIndex = importedRecords[preview.category].findIndex((candidate) => catalogKey(preview.category, candidate) === key);
    if (row.match && existingIndex < 0 && decision === 'keep_existing') { conflicts.push({ rowNumber: row.rowNumber, reason: 'seed_record_requires_review' }); continue; }
    const record = { ...row.record, id: existingIndex >= 0 ? importedRecords[preview.category][existingIndex].id : makeId(preview.category, row.record), importBatchId: batchId };
    if (existingIndex >= 0 && decision === 'merge') importedRecords[preview.category][existingIndex] = { ...importedRecords[preview.category][existingIndex], ...record };
    else if (existingIndex >= 0 && decision === 'use_imported') importedRecords[preview.category][existingIndex] = record;
    else if (existingIndex < 0) importedRecords[preview.category].push(record);
    else { conflicts.push({ rowNumber: row.rowNumber, reason: 'unsupported_decision' }); continue; }
    applied.push({ rowNumber: row.rowNumber, id: record.id, action: existingIndex >= 0 ? 'updated' : 'created' });
    appliedRecords.push(record);
  }
  const batch = { ...preview, decisions, applied, appliedRecords, ignored, conflicts, before, committedAt: new Date().toISOString() };
  committedBatches.set(batchId, batch);
  pendingBatches.delete(batchId);
  return batch;
}

export function rollbackCatalogImport(batchId) {
  const batch = committedBatches.get(batchId);
  if (!batch) throw new Error('import_batch_not_found');
  importedRecords[batch.category].splice(0, importedRecords[batch.category].length, ...batch.before);
  committedBatches.delete(batchId);
  return { batchId, rolledBack: true };
}

export function getImportedRecords(category) {
  return [...(importedRecords[category] || [])];
}

export function getImportBatch(batchId) {
  return committedBatches.get(batchId) || pendingBatches.get(batchId) || null;
}

export const IMPORT_LIMITS = Object.freeze({ maxFileBytes: MAX_FILE_BYTES, maxRows: MAX_ROWS });
