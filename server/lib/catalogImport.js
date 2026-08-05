import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { CATALOG_METADATA_SHEET_NAME, CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, getCatalogHeaders, normalizeCell, rowToCanonical, validateCatalogHeaders, validateCatalogRow } from '../../src/domain/catalogImportSchema.js';
import { normalizeResearcherName } from '../../src/domain/researcherCatalog.js';
import { catalogStore } from './catalogStore.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 1000;

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

/**
 * Descobre a categoria da planilha.
 *
 * Com o cabeçalho completo, as colunas específicas de cada categoria já a
 * identificam. Aceitando subconjunto, uma planilha que só traga colunas comuns
 * é válida para as três — e aí quem decide é o valor declarado em
 * `tipo_registro`, que é coluna obrigatória justamente por isso.
 */
function detectCategory(headers, requestedCategory, declaredType) {
  const candidates = ['researcher', 'school', 'organization'].filter((category) => validateCatalogHeaders(headers, category).valid);
  if (!candidates.length) return null;
  if (requestedCategory && candidates.includes(requestedCategory)) return requestedCategory;
  if (declaredType && candidates.includes(declaredType)) return declaredType;
  return candidates.length === 1 ? candidates[0] : null;
}

export function catalogKey(category, record) {
  if (category === 'researcher') {
    const scholar = String(record.scholar || record.google_scholar_url || '').match(/[?&]user=([^&]+)/i)?.[1];
    if (scholar) return `scholar:${scholar}`;
    if (record.orcid) return `orcid:${String(record.orcid).toUpperCase()}`;
    return `name:${normalizeResearcherName(record.nome)}|institution:${fold(record.instituicao || record.instituicao_atual)}|country:${fold(record.pais)}`;
  }
  if (record.identificador_publico) return `public:${fold(record.identificador_publico)}`;
  const websiteDomain = domain(record.website || record.website_oficial || record.dominio_oficial);
  return websiteDomain ? `domain:${websiteDomain}` : `name:${fold(record.nome || record.instituicao)}|country:${fold(record.pais)}`;
}

function hashRow(row) {
  return crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

function makeId(category, record, existing = []) {
  const prefix = category === 'researcher' ? 'r' : category === 'school' ? 's' : 'o';
  const sequence = existing.reduce((max, item) => Math.max(max, Number(String(item.id || '').match(/import-(\d+)/)?.[1] || 0)), 0) + 1;
  return `${prefix}-import-${sequence}-${hashRow(record).slice(0, 8)}`;
}

function mergeRecord(existing, imported) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(imported)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    merged[key] = Array.isArray(value) && Array.isArray(existing[key])
      ? [...new Set([...existing[key], ...value])]
      : value;
  }
  return merged;
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
  // O tipo declarado na primeira linha de dados desempata quando o cabeçalho
  // traz só colunas comuns às três categorias.
  const declaredType = headers.includes('tipo_registro')
    ? rowValues(sheet.getRow(2))[headers.indexOf('tipo_registro')]
    : '';
  const category = detectCategory(headers, requestedCategory, declaredType);
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
  const importedByKey = new Map(catalogStore.getRecords(parsed.category).map((candidate) => [catalogKey(parsed.category, candidate), candidate]));
  const seenInFile = new Map();
  const rows = parsed.rows.map((entry) => {
    if (!entry.valid) return { ...entry, status: 'invalid', match: null };
    if (catalogStore.hasRowHash(parsed.category, entry.hash)) return { ...entry, status: 'already_imported', match: null };
    const key = catalogKey(parsed.category, entry.record);
    const inFileMatch = seenInFile.get(key);
    if (inFileMatch) return { ...entry, status: 'possible_duplicate', match: { id: inFileMatch.rowNumber, name: inFileMatch.record.nome || inFileMatch.record.instituicao, source: 'file' } };
    seenInFile.set(key, entry);
    const match = existingByKey.get(key);
    const importedMatch = importedByKey.get(catalogKey(parsed.category, entry.record));
    return {
      ...entry,
      status: match ? 'possible_duplicate' : 'new',
      match: match ? { id: match.id, name: match.nome || match.instituicao, source: importedMatch ? 'imported' : 'catalog' } : null,
    };
  });
  const batchId = `import-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const preview = {
    batchId, schemaVersion: parsed.schemaVersion, category: parsed.category, filename: parsed.filename,
    metadata: parsed.metadata, rows,
    counts: {
      total: rows.length,
      new: rows.filter((row) => row.status === 'new').length,
      possibleDuplicate: rows.filter((row) => row.status === 'possible_duplicate').length,
      alreadyImported: rows.filter((row) => row.status === 'already_imported').length,
      invalid: rows.filter((row) => row.status === 'invalid').length,
    },
    createdAt: new Date().toISOString(),
  };
  catalogStore.setPending(preview);
  return preview;
}

export function commitCatalogImport(batchId, decisions = {}) {
  const preview = catalogStore.getPending(batchId);
  if (!preview) throw new Error('import_preview_not_found');
  const before = catalogStore.snapshot(preview.category);
  const records = catalogStore.getRecords(preview.category);
  const applied = [];
  const appliedRecords = [];
  const ignored = [];
  const conflicts = [];
  for (const row of preview.rows) {
    if (row.status === 'invalid') { ignored.push({ rowNumber: row.rowNumber, reason: 'invalid' }); continue; }
    if (row.status === 'already_imported') { ignored.push({ rowNumber: row.rowNumber, reason: 'idempotent_replay' }); continue; }
    const decision = decisions[String(row.rowNumber)] || (row.status === 'new' ? 'use_imported' : 'keep_existing');
    if (decision === 'keep_existing' || decision === 'ignore') { ignored.push({ rowNumber: row.rowNumber, reason: decision }); continue; }
    const key = catalogKey(preview.category, row.record);
    const existingIndex = records.findIndex((candidate) => catalogKey(preview.category, candidate) === key);
    const seedMatch = row.match && row.match.source !== 'imported';
    if (seedMatch && decision === 'keep_existing') {
      conflicts.push({ rowNumber: row.rowNumber, reason: 'seed_record_requires_review' });
      continue;
    }
    const existing = existingIndex >= 0 ? records[existingIndex] : null;
    const base = { ...row.record, id: existing?.id || (decision === 'use_imported' && row.match?.id) || makeId(preview.category, row.record, records), importBatchId: batchId, importRowHash: row.hash, catalogKey: key };
    const record = decision === 'merge' && existing ? mergeRecord(existing, base) : base;
    if (existingIndex >= 0) records[existingIndex] = record;
    else records.push(record);
    catalogStore.markRowHash(preview.category, row.hash);
    applied.push({ rowNumber: row.rowNumber, id: record.id, rowHash: row.hash, action: existingIndex >= 0 ? (decision === 'merge' ? 'merged' : 'updated') : 'created' });
    appliedRecords.push(record);
  }
  catalogStore.replaceCategory(preview.category, records, [...before.rowHashes, ...applied.map((item) => preview.rows.find((row) => row.rowNumber === item.rowNumber)?.hash).filter(Boolean)]);
  const batch = { ...preview, decisions, applied, appliedRecords, ignored, conflicts, before, committedAt: new Date().toISOString() };
  catalogStore.setCommitted(batch);
  catalogStore.deletePending(batchId);
  return batch;
}

export function rollbackCatalogImport(batchId) {
  const batch = catalogStore.getCommitted(batchId);
  if (!batch) throw new Error('import_batch_not_found');
  const applied = Array.isArray(batch.applied) ? batch.applied : [];
  const current = catalogStore.getRecords(batch.category);
  const conflicts = [];
  for (const change of applied) {
    const currentRecord = current.find((record) => String(record.id) === String(change.id));
    if (!currentRecord || currentRecord.importBatchId !== batchId || currentRecord.importRowHash !== change.rowHash) {
      conflicts.push({ rowNumber: change.rowNumber, id: change.id, reason: 'record_changed_after_batch' });
    }
  }
  if (conflicts.length) {
    const error = new Error('rollback_conflict');
    error.conflicts = conflicts;
    throw error;
  }
  const restored = [...current];
  for (const change of applied) {
    const index = restored.findIndex((record) => String(record.id) === String(change.id));
    if (index < 0) continue;
    if (change.action === 'created') {
      restored.splice(index, 1);
      continue;
    }
    const previous = (batch.before?.records || []).find((record) => String(record.id) === String(change.id));
    if (previous) restored[index] = previous;
    else restored.splice(index, 1);
  }
  const changedHashes = new Set(applied.map((change) => change.rowHash).filter(Boolean));
  const remainingHashes = (catalogStore.snapshot(batch.category).rowHashes || []).filter((hash) => !changedHashes.has(hash));
  catalogStore.replaceCategory(batch.category, restored, remainingHashes);
  catalogStore.deleteCommitted(batchId);
  return { batchId, rolledBack: true, restored: applied.length };
}

export function getImportedRecords(category) {
  return catalogStore.getRecords(category);
}

export function getImportBatch(batchId) {
  return catalogStore.getCommitted(batchId) || catalogStore.getPending(batchId) || null;
}

export function listImportBatches() {
  return catalogStore.listBatches();
}

export function getCatalogStoreStatus() {
  return catalogStore.status();
}

export async function hydrateCatalogStore(options) {
  return catalogStore.hydrate(options);
}

export async function flushCatalogStore() {
  return catalogStore.flush();
}

export const IMPORT_LIMITS = Object.freeze({ maxFileBytes: MAX_FILE_BYTES, maxRows: MAX_ROWS });
