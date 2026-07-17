/** Exporta somente a planilha rica do resultado de seleção. */
const FORMAT_CONFIG = Object.freeze({
  xlsx: { extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
});

const DIMENSION_KEYS = ['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk'];
const DIMENSION_LABELS = {
  impact: 'Impacto potencial', alignment: 'Alinhamento estratégico', credibility: 'Credibilidade',
  collaboration: 'Colaboração', feasibility: 'Viabilidade de engajamento', risk: 'Risco controlado',
};
export const RICH_WORKSHEET_NAMES = Object.freeze(['Leia-me', 'Contexto', 'Shortlist', 'Comparação detalhada', 'Evidências', 'Riscos e lacunas', 'Respostas', 'Metodologia', 'Catálogo considerado']);

const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return fallback; }
};
const round = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : '');

export function sanitizeSpreadsheetValue(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function normalizeEntry(entry, index) {
  const candidate = entry?.candidate || entry?.stakeholder || entry || {};
  const dimensions = entry?.dimensions || entry?.scores || {};
  const severeRisk = entry?.severeRisk || entry?.riskEvidence || {};
  return {
    rank: entry?.rank || index + 1,
    id: candidate.id ?? entry?.id ?? '',
    name: safeString(candidate.nome || candidate.name || candidate.instituicao, 'Sem nome'),
    institution: safeString(candidate.instituicao || candidate.institution),
    country: safeString(candidate.pais || candidate.country),
    category: safeString(candidate.categoria || candidate.category),
    website: safeString(candidate.website),
    strategicValue: round(entry?.strategicValue ?? entry?.total ?? entry?.score),
    total: round(entry?.total ?? entry?.score ?? entry?.strategicValue),
    confidence: round(entry?.confidence),
    dimensions: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, round(dimensions[key])])),
    summary: safeString(entry?.summary || entry?.justification || entry?.reason),
    comparativeEdge: safeString(entry?.comparativeEdge),
    tradeoffs: (Array.isArray(entry?.tradeoffs) ? entry.tradeoffs : entry?.tradeoffs ? [entry.tradeoffs] : []).map((value) => safeString(value)),
    dimensionRationale: entry?.dimensionRationale && typeof entry.dimensionRationale === 'object' ? Object.fromEntries(Object.entries(entry.dimensionRationale).map(([key, value]) => [key, safeString(value)])) : {},
    gaps: (Array.isArray(entry?.gaps) ? entry.gaps : entry?.gaps ? [entry.gaps] : []).map((gap) => safeString(gap)),
    risk: { severe: Boolean(severeRisk?.confirmed || entry?.severeRisk?.confirmed), evidence: safeString(severeRisk?.evidence) },
    sources: (Array.isArray(entry?.sources) ? entry.sources : [candidate.website, candidate.scholar, ...(candidate.artigos || []).map((article) => article?.url)]).filter(Boolean).map((source) => safeString(source)),
    raw: entry,
  };
}

export function snapshotSelection(result = {}, metadata = {}) {
  const shortlist = Array.isArray(result?.shortlist) ? result.shortlist.map(normalizeEntry) : [];
  const trace = result?.trace || {};
  return {
    version: 2,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    metadata: { title: metadata.title || 'Avaliação de stakeholders', category: metadata.category || result?.category || '', objective: metadata.objective || result?.objective || '', context: metadata.context || result?.answers?.context || '', provider: metadata.provider || trace.provider || '', model: metadata.model || trace.model || '', ...metadata },
    answers: result?.answers || trace.answers || {},
    catalog: Array.isArray(result?.candidatePool) ? result.candidatePool : [],
    shortlist,
    trace: { ...trace, formula: trace.formula || 'Pontuação multidimensional recalculada pelo mecanismo de seleção.', usage: trace.usage || null, institutionalBaseline: trace.institutionalBaseline || [] },
    sourceResult: result,
  };
}

function metadataRows(snapshot) {
  const metadata = snapshot.metadata || {};
  return [['Título', metadata.title], ['Gerado em', snapshot.generatedAt], ['Categoria', metadata.category], ['Objetivo', metadata.objective], ['Contexto', metadata.context], ['Provedor', metadata.provider || 'Não informado'], ['Modelo', metadata.model || 'Não informado']];
}

function shortlistColumns() {
  return ['Posição', 'Stakeholder', 'Instituição', 'País', 'Pontuação total', 'Confiança', ...DIMENSION_KEYS.map((key) => DIMENSION_LABELS[key]), 'Risco grave confirmado', 'Justificativa', 'Lacunas', 'Fontes'];
}

function shortlistRows(snapshot) {
  return snapshot.shortlist.map((entry) => [entry.rank, entry.name, entry.institution, entry.country, entry.total, entry.confidence, ...DIMENSION_KEYS.map((key) => entry.dimensions[key]), entry.risk.severe ? 'Sim' : 'Não', entry.summary, entry.comparativeEdge, entry.tradeoffs.join('; '), entry.gaps.join('; '), entry.sources.join('; ')]);
}

function traceRows(snapshot) {
  const trace = snapshot.trace || {};
  const rows = [['Fórmula', safeString(trace.formula)], ['Pesos', safeString(trace.weights)], ['Modelo', safeString(trace.model || snapshot.metadata.model)], ['Provedor', safeString(trace.provider || snapshot.metadata.provider)], ['Uso de tokens', safeString(trace.usage)], ['Pré-seleção do provider', safeString(trace.providerPreselection)], ['Baseline institucional', safeString(trace.institutionalBaseline)], ['Versão', safeString(trace.version || snapshot.version)]];
  Object.entries(snapshot.answers || {}).forEach(([question, answer]) => rows.push([`Resposta: ${question}`, safeString(answer, 'Não informado')]));
  if (Array.isArray(trace.interview)) trace.interview.forEach((entry, index) => rows.push([`Transição ${index + 1}`, safeString(entry)]));
  return rows;
}

function filenameFor(snapshot) {
  const title = String(snapshot.metadata?.title || 'avaliacao-stakeholders').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'avaliacao-stakeholders';
  const date = String(snapshot.generatedAt || '').slice(0, 10).replace(/[^0-9-]/g, '') || 'resultado';
  return `${title}-${date}.xlsx`;
}

async function buildRichXlsx(snapshot) {
  const exceljs = await import('exceljs');
  const Workbook = exceljs.Workbook || exceljs.default?.Workbook;
  if (!Workbook) throw new Error('ExcelJS indisponível.');
  const workbook = new Workbook();
  workbook.creator = 'SENAI-SP Parceiros';
  workbook.created = new Date(snapshot.generatedAt);
  const addTable = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = headers.map((header) => ({ header: sanitizeSpreadsheetValue(header), width: Math.min(Math.max(String(header).length + 4, 14), 42) }));
    rows.forEach((row) => {
      const added = sheet.addRow(row.map(sanitizeSpreadsheetValue));
      added.eachCell((cell) => { if (typeof cell.value === 'string' && /^https?:\/\//i.test(cell.value)) cell.value = { text: cell.value, hyperlink: cell.value }; });
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; }));
  };
  addTable('Leia-me', ['Campo', 'Orientação'], [['Objetivo', 'Apoiar a seleção de stakeholders para educação profissional e desenvolvimento da indústria paulista.'], ['Como usar', 'Valide a Shortlist, leia as Evidências e confirme as fontes antes de contatar qualquer organização.'], ['Rastreabilidade', 'As abas preservam respostas, critérios, fontes, lacunas e regras do processamento.'], ['Privacidade', 'Este arquivo é uma exportação pontual; a ferramenta não salva a entrevista.']]);
  addTable('Contexto', ['Campo', 'Valor'], metadataRows(snapshot).concat([['Respostas completas', safeString(snapshot.answers)]]));
  addTable('Shortlist', [...shortlistColumns().slice(0, -2), 'Diferencial comparativo', 'Trade-offs', 'Lacunas', 'Fontes'], shortlistRows(snapshot));
  addTable('Comparação detalhada', ['Stakeholder', 'Instituição', 'Pontuação total', 'Confiança', ...DIMENSION_KEYS.map((key) => DIMENSION_LABELS[key]), 'Diferencial comparativo', 'Trade-offs'], snapshot.shortlist.map((entry) => [entry.name, entry.institution, entry.total, entry.confidence, ...DIMENSION_KEYS.map((key) => entry.dimensions[key]), entry.comparativeEdge, entry.tradeoffs.join('; ')]));
  addTable('Evidências', ['Stakeholder', 'Resumo da justificativa', 'Diferencial', 'Fonte'], snapshot.shortlist.flatMap((entry) => (entry.sources.length ? entry.sources : ['']).map((source) => [entry.name, entry.summary, entry.comparativeEdge, source])));
  addTable('Riscos e lacunas', ['Stakeholder', 'Risco grave confirmado', 'Evidência de risco', 'Lacunas'], snapshot.shortlist.map((entry) => [entry.name, entry.risk.severe ? 'Sim' : 'Não', entry.risk.evidence, entry.gaps.join('; ')]));
  addTable('Respostas', ['Pergunta', 'Resposta'], Object.entries(snapshot.answers || {}).map(([question, answer]) => [question, safeString(answer, 'Não informado')]));
  addTable('Metodologia', ['Campo', 'Valor'], traceRows(snapshot));
  const catalogRows = (Array.isArray(snapshot.catalog) ? snapshot.catalog : []).map((entry, index) => {
    const candidate = entry?.candidate || entry?.stakeholder || entry || {};
    return [index + 1, candidate.nome || candidate.name || candidate.instituicao || 'Sem nome', candidate.instituicao || candidate.institution || '', candidate.categoria || candidate.category || '', candidate.website || ''];
  });
  addTable('Catálogo considerado', ['#', 'Stakeholder', 'Instituição', 'Categoria', 'Website'], catalogRows.length ? catalogRows : snapshot.shortlist.map((entry) => [entry.rank, entry.name, entry.institution, entry.category, entry.website]));
  return new Blob([await workbook.xlsx.writeBuffer()], { type: FORMAT_CONFIG.xlsx.mimeType });
}

export async function exportSelection(result, format, metadata = {}) {
  const normalized = String(format || '').trim().toLowerCase().replace(/^\./, '');
  if (normalized !== 'xlsx' && normalized !== 'excel' && normalized !== 'spreadsheet') throw new Error('Somente a exportação XLSX está disponível.');
  const snapshot = snapshotSelection(result, metadata);
  const blob = await buildRichXlsx(snapshot);
  return { blob, filename: metadata.filename || filenameFor(snapshot), mimeType: FORMAT_CONFIG.xlsx.mimeType, format: 'xlsx', snapshot };
}

export function downloadExport(artifact) {
  if (!artifact?.blob) throw new Error('Artefato de exportação inválido.');
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = artifact.filename || 'exportacao.xlsx'; anchor.rel = 'noopener';
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export const EXPORT_FORMATS = Object.freeze(['xlsx']);
