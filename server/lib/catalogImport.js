import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { CATALOG_CATEGORIES, CATALOG_METADATA_SHEET_NAME, CATALOG_SCHEMA_VERSION, CATALOG_SHEET_NAME, getCatalogHeaders, normalizeCatalogCategory, normalizeCell, rowToCanonical, validateCatalogHeaders, validateCatalogRow } from '../../src/domain/catalogImportSchema.js';
import { normalizeResearcherName } from '../../src/domain/researcherCatalog.js';
import { inferOrganizationSubtype } from '../../src/domain/catalogTaxonomy.js';
import { catalogStore } from './catalogStore.js';

// JSON transport adds about 33% in base64; 3 MiB stays below Vercel's request limit.
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_ROWS = 1000;
const INPUT_CATEGORIES = [...CATALOG_CATEGORIES, 'researcher', 'school'];

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
  const candidates = CATALOG_CATEGORIES.filter((category) => validateCatalogHeaders(headers, category).valid);
  if (!candidates.length) return null;
  const requested = normalizeCatalogCategory(requestedCategory);
  const declared = normalizeCatalogCategory(declaredType);
  if (requested && candidates.includes(requested)) return requested;
  if (declared && candidates.includes(declared)) return declared;
  return candidates.length === 1 ? candidates[0] : null;
}

export function catalogKey(category, record) {
  if (category === 'person') {
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
  const prefix = category === 'person' ? 'p' : 'o';
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
  if (!filename || !/\.(xlsx|csv)$/i.test(filename) || /\.(xlsm|xls)$/i.test(filename)) throw new Error('xlsx_or_csv_only');
  if (typeof contentBase64 !== 'string') throw new Error('file_content_required');
  const buffer = Buffer.from(contentBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('file_too_large');
  const workbook = new ExcelJS.Workbook();
  let reportSheet = false;
  let sheet = /\.csv$/i.test(filename)
    ? await workbook.csv.read(Readable.from(buffer), { parserOptions: { delimiter: detectCsvDelimiter(buffer), ignoreEmpty: true, trim: true } })
    : (await workbook.xlsx.load(buffer, { ignoreNodes: ['extLst'] })).getWorksheet(CATALOG_SHEET_NAME);
  if (!sheet && !/\.csv$/i.test(filename)) {
    const candidate = workbook.worksheets.find((worksheet) => {
      const headers = rowValues(worksheet.getRow(1)).map((value) => fold(value));
      return headers.includes('stakeholder') && headers.includes('categoria');
    });
    if (candidate) { sheet = candidate; reportSheet = true; }
  }
  if (!sheet) throw new Error('stakeholders_sheet_required');
  if (sheet.rowCount < 2) throw new Error('stakeholders_rows_required');
  if (sheet.rowCount - 1 > MAX_ROWS) throw new Error('too_many_rows');
  const sourceHeaders = rowValues(sheet.getRow(1));
  const category = reportSheet ? normalizeCatalogCategory(requestedCategory || 'organization') : null;
  const headers = reportSheet ? getCatalogHeaders(category) : sourceHeaders;
  const typeColumnIndex = headers.indexOf('tipo_registro');
  const declaredCategories = new Set();
  if (!reportSheet && typeColumnIndex >= 0) {
    for (let index = 2; index <= sheet.rowCount; index += 1) {
      const values = rowValues(sheet.getRow(index));
      const declared = String(values[typeColumnIndex] || '').trim().toLowerCase();
      if (INPUT_CATEGORIES.includes(declared)) declaredCategories.add(normalizeCatalogCategory(declared));
    }
  }
  if (declaredCategories.size > 1) {
    const error = new Error('catalog_mixed_categories');
    error.code = 'catalog_mixed_categories';
    error.categories = [...declaredCategories];
    throw error;
  }
  // O tipo declarado na primeira linha de dados desempata quando o cabeçalho
  // traz só colunas comuns às três categorias.
  const declaredType = headers.includes('tipo_registro')
    ? rowValues(sheet.getRow(2))[headers.indexOf('tipo_registro')]
    : '';
  const detectedCategory = reportSheet ? category : detectCategory(headers, requestedCategory, declaredType);
  if (!detectedCategory) throw new Error('invalid_headers');
  const headerValidation = validateCatalogHeaders(headers, detectedCategory);
  if (!headerValidation.valid) throw new Error(`invalid_headers:${headerValidation.errors.join(' ')}`);
  const rows = [];
  const errors = [];
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const values = rowValues(sheet.getRow(index));
    if (values.every((value) => !value)) continue;
    const row = reportSheet
      ? evaluationRowToCatalog(sourceHeaders, values, detectedCategory, workbook)
      : Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] || '']));
    const validation = validateCatalogRow(row, detectedCategory, index);
    if (!validation.valid) errors.push(...validation.errors);
    rows.push({ rowNumber: index, row, record: rowToCanonical(row), valid: validation.valid, errors: validation.errors, hash: hashRow(row) });
  }
  const metadataSheet = workbook.getWorksheet(CATALOG_METADATA_SHEET_NAME);
  const metadata = {};
  metadataSheet?.eachRow((row) => {
    const [key, value] = row.values.slice(1);
    if (key) metadata[String(key).trim()] = normalizeCell(value);
  });
  return { schemaVersion: CATALOG_SCHEMA_VERSION, category: detectedCategory, headers, rows, errors, metadata, filename, rowCount: rows.length };
}

function evaluationRowToCatalog(headers, values, category, workbook) {
  const source = Object.fromEntries(headers.map((header, index) => [fold(header), values[index] || '']));
  const shortlist = workbook.getWorksheet('Shortlist');
  const shortlistHeaders = shortlist ? rowValues(shortlist.getRow(1)).map((header) => fold(header)) : [];
  const match = shortlist && shortlistHeaders.includes('stakeholder')
    ? Array.from({ length: shortlist.rowCount - 1 }, (_, offset) => rowValues(shortlist.getRow(offset + 2)))
      .map((row) => Object.fromEntries(shortlistHeaders.map((header, index) => [header, row[index] || ''])))
      .find((row) => fold(row.stakeholder) === fold(source.stakeholder))
    : null;
  const sources = match?.fontes || match?.fonte || '';
  return {
    schema_version: CATALOG_SCHEMA_VERSION,
    tipo_registro: category,
    subtipo: category === 'person'
      ? 'Pesquisador(a) ou acadêmico(a)'
      : inferOrganizationSubtype({ categoria: source.categoria, natureza: source.categoria }),
    nome: source.stakeholder,
    pais: match?.pais || 'Não informado',
    cidade_estado: '', resumo: match?.justificativa || '', descricao: match?.diferencial_comparativo || '',
    areas_temas: '', aderencia_contexto: match?.justificativa || '', relacao_publica: '',
    evidencias_publicas: sources, riscos_sinais: match?.trade_offs || '', website_oficial: source.website,
    contato_publico: '', fontes: sources, data_consulta: '', confianca: match?.confianca || '', dados_nao_localizados: '',
    ...(category === 'organization' ? {
      natureza_juridica: source.categoria,
      setor: source.categoria,
      atuacao: match?.justificativa || '',
      tipo_instituicao: fold(source.categoria).includes('escola') ? source.categoria : '',
      areas_formacao: '',
    } : {}),
    ...(category === 'person' ? { instituicao_atual: source.instituicao, areas_especialidade: '', linhas_pesquisa: '', perfis_atuacao: 'pesquisa' } : {}),
  };
}

// CSVs exported by Excel in pt-BR normally use `;`, while API-generated CSVs
// often use `,`. The header has no quoted values, so a small count is enough to
// select the delimiter before handing parsing to ExcelJS.
function detectCsvDelimiter(buffer) {
  const header = buffer.toString('utf8').split(/\r?\n/, 1)[0] || '';
  return (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';
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
  const committedAt = new Date().toISOString();
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
    const base = { ...row.record, id: existing?.id || (decision === 'use_imported' && row.match?.id) || makeId(preview.category, row.record, records), importBatchId: batchId, importRowHash: row.hash, catalogKey: key, adicionadoEm: existing?.adicionadoEm || committedAt };
    const record = decision === 'merge' && existing ? mergeRecord(existing, base) : base;
    if (existingIndex >= 0) records[existingIndex] = record;
    else records.push(record);
    catalogStore.markRowHash(preview.category, row.hash);
    applied.push({ rowNumber: row.rowNumber, id: record.id, rowHash: row.hash, action: existingIndex >= 0 ? (decision === 'merge' ? 'merged' : 'updated') : 'created' });
    appliedRecords.push(record);
  }
  catalogStore.replaceCategory(preview.category, records, [...before.rowHashes, ...applied.map((item) => preview.rows.find((row) => row.rowNumber === item.rowNumber)?.hash).filter(Boolean)]);
  const batch = { ...preview, decisions, applied, appliedRecords, ignored, conflicts, before, committedAt };
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
  category = normalizeCatalogCategory(category);
  const batchDates = new Map(catalogStore.listBatches().map((batch) => [batch.batchId, batch.committedAt || batch.createdAt]));
  return catalogStore.getRecords(category).map((record) => {
    if (record.adicionadoEm) return record;
    const adicionadoEm = batchDates.get(record.importBatchId);
    return adicionadoEm ? { ...record, adicionadoEm } : record;
  });
}

export function getImportBatch(batchId) {
  return catalogStore.getCommitted(batchId) || catalogStore.getPending(batchId) || null;
}

export function listPendingResearchBatches() {
  return catalogStore.listPending().filter((batch) => batch?.metadata?.origin === 'catalog_research');
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
