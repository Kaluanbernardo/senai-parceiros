/**
 * Exporta o resultado de uma selecao sem acoplar a interface a um formato
 * especifico. Os geradores sao carregados sob demanda para manter o bundle
 * inicial pequeno.
 *
 * API principal:
 *   const artifact = await exportSelection(result, 'xlsx', metadata)
 *   downloadExport(artifact)
 */

const FORMAT_ALIASES = {
  excel: 'xlsx',
  spreadsheet: 'xlsx',
  word: 'docx',
  powerpoint: 'pptx',
};

const FORMAT_CONFIG = {
  xlsx: {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  pdf: { extension: 'pdf', mimeType: 'application/pdf' },
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  pptx: {
    extension: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
};

const DIMENSION_KEYS = ['impact', 'alignment', 'credibility', 'collaboration', 'feasibility', 'risk'];
export const RICH_WORKSHEET_NAMES = Object.freeze(['Leia-me', 'Contexto', 'Shortlist', 'Comparação detalhada', 'Evidências', 'Riscos e lacunas', 'Respostas', 'Metodologia', 'Catálogo considerado']);

const DIMENSION_LABELS = {
  impact: 'Impacto potencial',
  alignment: 'Alinhamento estratégico',
  credibility: 'Credibilidade',
  collaboration: 'Colaboração',
  feasibility: 'Viabilidade de engajamento',
  risk: 'Risco',
};

const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

const round = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : '');

export function sanitizeSpreadsheetValue(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function normalizeFormat(format) {
  const normalized = String(format || '').trim().toLowerCase().replace(/^\./, '');
  return FORMAT_ALIASES[normalized] || normalized;
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
    profileType: safeString(candidate.profileType),
    strategicValue: round(entry?.strategicValue ?? entry?.total ?? entry?.score),
    total: round(entry?.total ?? entry?.score ?? entry?.strategicValue),
    confidence: round(entry?.confidence),
    dimensions: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, round(dimensions[key])])),
    summary: safeString(entry?.summary || entry?.justification || entry?.reason),
    gaps: (Array.isArray(entry?.gaps) ? entry.gaps : entry?.gaps ? [entry.gaps] : []).map((gap) => safeString(gap)),
    risk: {
      severe: Boolean(severeRisk?.confirmed || entry?.severeRisk?.confirmed),
      evidence: safeString(severeRisk?.evidence),
    },
    sources: (Array.isArray(entry?.sources) ? entry.sources : [candidate.website, candidate.scholar, ...(candidate.artigos || []).map((article) => article?.url)]).filter(Boolean).map((source) => safeString(source)),
    raw: entry,
  };
}

/**
 * Cria um snapshot serializavel e estavel para todos os formatos.
 * Nenhum objeto do resultado original e mutado.
 */
export function snapshotSelection(result = {}, metadata = {}) {
  const shortlist = Array.isArray(result?.shortlist)
    ? result.shortlist.map(normalizeEntry)
    : [];
  const trace = result?.trace || {};

  return {
    version: 1,
    generatedAt: metadata.generatedAt || new Date().toISOString(),
    metadata: {
      title: metadata.title || 'Avaliação de stakeholders',
      category: metadata.category || result?.category || '',
      objective: metadata.objective || result?.objective || '',
      context: metadata.context || result?.answers?.context || '',
      provider: metadata.provider || trace.provider || '',
      model: metadata.model || trace.model || '',
      ...metadata,
    },
    answers: result?.answers || trace.answers || {},
    catalog: Array.isArray(result?.candidatePool) ? result.candidatePool : (Array.isArray(metadata.catalog) ? metadata.catalog : []),
    shortlist,
    trace: {
      ...trace,
      formula: trace.formula || 'Pontuação multidimensional recalculada pelo mecanismo de seleção.',
      criteria: trace.criteria || trace.dimensions || DIMENSION_KEYS.map((key) => DIMENSION_LABELS[key]),
      usage: trace.usage || null,
      institutionalBaseline: trace.institutionalBaseline || [],
    },
    // Mantém os dados originais para auditoria, sem depender da forma usada na tela.
    sourceResult: result,
  };
}

function metadataRows(snapshot) {
  const metadata = snapshot.metadata || {};
  return [
    ['Título', metadata.title],
    ['Gerado em', snapshot.generatedAt],
    ['Categoria', metadata.category],
    ['Objetivo', metadata.objective],
    ['Contexto', metadata.context],
    ['Provedor', metadata.provider || 'Não informado'],
    ['Modelo', metadata.model || 'Não informado'],
  ];
}

function shortlistColumns() {
  return [
    'Posição',
    'Stakeholder',
    'Instituição',
    'País',
    'Pontuação total',
    'Confiança',
    ...DIMENSION_KEYS.map((key) => DIMENSION_LABELS[key]),
    'Risco grave confirmado',
    'Justificativa',
    'Lacunas',
    'Fontes',
  ];
}

function shortlistRows(snapshot) {
  return snapshot.shortlist.map((entry) => [
    entry.rank,
    entry.name,
    entry.institution,
    entry.country,
    entry.total,
    entry.confidence,
    ...DIMENSION_KEYS.map((key) => entry.dimensions[key]),
    entry.risk.severe ? 'Sim' : 'Não',
    entry.summary,
    entry.gaps.join('; '),
    entry.sources.join('; '),
  ]);
}

function traceRows(snapshot) {
  const trace = snapshot.trace || {};
  const rows = [
    ['Fórmula', safeString(trace.formula)],
    ['Pesos', safeString(trace.weights || trace.criteriaWeights)],
    ['Modelo', safeString(trace.model || snapshot.metadata.model)],
    ['Provedor', safeString(trace.provider || snapshot.metadata.provider)],
    ['Uso de tokens', safeString(trace.usage)],
    ['Baseline institucional', safeString(trace.institutionalBaseline)],
    ['Versão', safeString(trace.version || snapshot.version)],
  ];

  Object.entries(snapshot.answers || {}).forEach(([question, answer]) => {
    rows.push([`Resposta: ${question}`, safeString(answer, 'Não informado')]);
  });

  if (Array.isArray(trace.questions)) {
    trace.questions.forEach((question, index) => {
      rows.push([`Pergunta ${index + 1}`, safeString(question)]);
    });
  }
  if (Array.isArray(trace.sources)) {
    trace.sources.forEach((source, index) => {
      rows.push([`Fonte ${index + 1}`, safeString(source)]);
    });
  }
  return rows;
}

function filenameFor(snapshot, format) {
  const title = String(snapshot.metadata?.title || 'avaliacao-stakeholders')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'avaliacao-stakeholders';
  const date = String(snapshot.generatedAt || '').slice(0, 10).replace(/[^0-9-]/g, '') || 'resultado';
  return `${title}-${date}.${FORMAT_CONFIG[format].extension}`;
}

function asBlob(data, mimeType) {
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data], { type: mimeType });
  if (ArrayBuffer.isView(data)) return new Blob([data], { type: mimeType });
  return new Blob([data], { type: mimeType });
}

async function buildXlsx(snapshot) {
  const exceljs = await import('exceljs');
  const Workbook = exceljs.Workbook || exceljs.default?.Workbook;
  if (!Workbook) throw new Error('Não foi possível carregar o gerador XLSX.');
  const workbook = new Workbook();
  workbook.creator = 'Senai Parceiros';
  workbook.created = new Date(snapshot.generatedAt);

  const summary = workbook.addWorksheet('Resumo');
  summary.columns = [{ width: 25 }, { width: 90 }];
  summary.addRow(['Avaliação de stakeholders']);
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
  summary.mergeCells('A1:B1');
  metadataRows(snapshot).forEach((row) => summary.addRow(row));
  summary.addRow([]);
  summary.addRow(['Contexto completo', snapshot.metadata?.context || '']);
  summary.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const ranking = workbook.addWorksheet('Shortlist');
  ranking.columns = shortlistColumns().map((header) => ({ header, width: Math.min(Math.max(header.length + 4, 14), 36) }));
  shortlistRows(snapshot).forEach((row) => ranking.addRow(row));
  ranking.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ranking.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
  ranking.views = [{ state: 'frozen', ySplit: 1 }];
  ranking.eachRow((row) => row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; }));

  const traceSheet = workbook.addWorksheet('Rastreabilidade');
  traceSheet.columns = [{ header: 'Campo', width: 25 }, { header: 'Valor', width: 120 }];
  traceRows(snapshot).forEach((row) => traceSheet.addRow(row));
  traceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  traceSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
  traceSheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; }));

  const raw = workbook.addWorksheet('Snapshot JSON');
  raw.getColumn(1).width = 140;
  raw.getCell('A1').value = JSON.stringify(snapshot, null, 2);
  raw.getCell('A1').alignment = { wrapText: true, vertical: 'top' };

  return asBlob(await workbook.xlsx.writeBuffer(), FORMAT_CONFIG.xlsx.mimeType);
}

async function buildRichXlsx(snapshot) {
  const exceljs = await import('exceljs');
  const Workbook = exceljs.Workbook || exceljs.default?.Workbook;
  if (!Workbook) throw new Error('ExcelJS indisponivel.');
  const workbook = new Workbook();
  workbook.creator = 'Senai Parceiros';
  workbook.created = new Date(snapshot.generatedAt);
  const sanitize = sanitizeSpreadsheetValue;
  const addTable = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = headers.map((header) => ({ header: sanitize(header), width: Math.min(Math.max(String(header).length + 4, 14), 42) }));
    rows.forEach((row) => {
      const added = sheet.addRow(row.map(sanitize));
      added.eachCell((cell) => {
        if (typeof cell.value === 'string' && /^https?:\/\//i.test(cell.value)) cell.value = { text: cell.value, hyperlink: cell.value };
      });
    });
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3B60' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (headers.length) sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}1` };
    sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: 'top' }; }));
  };
  addTable('Leia-me', ['Campo', 'Orientacao'], [
    ['Objetivo', 'Apoiar a selecao de stakeholders para educacao profissional e desenvolvimento da industria paulista.'],
    ['Como usar', 'Comece pela aba Contexto, valide a Shortlist e leia as Evidencias antes de contatar qualquer organizacao.'],
    ['Rastreabilidade', 'As abas preservam respostas, criterios, fontes e lacunas do processamento.'],
    ['Privacidade', 'Este arquivo e uma exportacao pontual; nao representa armazenamento permanente na ferramenta.'],
  ]);
  addTable('Contexto', ['Campo', 'Valor'], metadataRows(snapshot).concat([['Respostas completas', safeString(snapshot.answers)]]));
  addTable('Shortlist', shortlistColumns(), shortlistRows(snapshot));
  addTable('Compara\u00e7\u00e3o detalhada', ['Stakeholder', 'Instituicao', 'Pontuacao total', 'Confianca', ...DIMENSION_KEYS.map((key) => DIMENSION_LABELS[key])], snapshot.shortlist.map((entry) => [entry.name, entry.institution, entry.total, entry.confidence, ...DIMENSION_KEYS.map((key) => entry.dimensions[key])]));
  addTable('Evid\u00eancias', ['Stakeholder', 'Resumo da justificativa', 'Fonte'], snapshot.shortlist.flatMap((entry) => (entry.sources.length ? entry.sources : ['']).map((source) => [entry.name, entry.summary, source])));
  addTable('Riscos e lacunas', ['Stakeholder', 'Risco grave confirmado', 'Evidencia de risco', 'Lacunas'], snapshot.shortlist.map((entry) => [entry.name, entry.risk.severe ? 'Sim' : 'Nao', entry.risk.evidence, entry.gaps.join('; ')]));
  addTable('Respostas', ['Pergunta', 'Resposta'], Object.entries(snapshot.answers || {}).map(([question, answer]) => [question, safeString(answer, 'Nao informado')]));
  addTable('Metodologia', ['Campo', 'Valor'], traceRows(snapshot));
  const catalog = snapshot.catalog || snapshot.sourceResult?.catalog || snapshot.sourceResult?.candidates || snapshot.trace?.catalog || [];
  const catalogRows = (Array.isArray(catalog) ? catalog : []).map((entry, index) => {
    const candidate = entry?.candidate || entry?.stakeholder || entry || {};
    return [index + 1, candidate?.nome || candidate?.name || candidate?.instituicao || 'Sem nome', candidate?.instituicao || candidate?.institution || '', candidate?.categoria || candidate?.category || '', candidate?.website || ''];
  });
  addTable('Cat\u00e1logo considerado', ['#', 'Stakeholder', 'Instituicao', 'Categoria', 'Website'], catalogRows.length ? catalogRows : snapshot.shortlist.map((entry) => [entry.rank, entry.name, entry.institution, entry.category, entry.website]));
  return asBlob(await workbook.xlsx.writeBuffer(), FORMAT_CONFIG.xlsx.mimeType);
}

function pageHeader(doc, snapshot, title) {
  doc.setFontSize(18);
  doc.setTextColor(11, 59, 96);
  doc.text(title, 14, 16);
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Gerado em ${snapshot.generatedAt}`, 14, 22);
  if (snapshot.metadata?.context) {
    doc.setFontSize(9);
    doc.setTextColor(45, 45, 45);
    const context = doc.splitTextToSize(`Contexto: ${snapshot.metadata.context}`, 265);
    doc.text(context, 14, 29);
    return 29 + context.length * 4;
  }
  return 28;
}

async function buildPdf(snapshot) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let cursor = pageHeader(doc, snapshot, 'Avaliação de stakeholders');
  autoTable(doc, {
    startY: cursor,
    head: [shortlistColumns().slice(0, 11)],
    body: shortlistRows(snapshot).map((row) => row.slice(0, 11)),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 59, 96] },
    alternateRowStyles: { fillColor: [242, 246, 249] },
    margin: { left: 14, right: 14 },
  });
  cursor = (doc.lastAutoTable?.finalY || cursor) + 8;
  doc.setFontSize(11);
  doc.setTextColor(11, 59, 96);
  doc.text('Justificativas e lacunas', 14, cursor);
  autoTable(doc, {
    startY: cursor + 3,
    head: [['Stakeholder', 'Justificativa', 'Lacunas', 'Risco grave', 'Fontes']],
    body: snapshot.shortlist.map((entry) => [entry.name, entry.summary, entry.gaps.join('; '), entry.risk.severe ? 'Sim' : 'Não', entry.sources.join('; ')]),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 59, 96] },
    columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 72 }, 2: { cellWidth: 55 }, 3: { cellWidth: 22 }, 4: { cellWidth: 75 } },
    margin: { left: 14, right: 14 },
  });
  doc.addPage();
  cursor = pageHeader(doc, snapshot, 'Rastreabilidade da avaliação');
  autoTable(doc, {
    startY: cursor,
    head: [['Campo', 'Valor']],
    body: traceRows(snapshot),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [11, 59, 96] },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 220 } },
    margin: { left: 14, right: 14 },
  });
  return asBlob(doc.output('arraybuffer'), FORMAT_CONFIG.pdf.mimeType);
}

async function buildDocx(snapshot) {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = await import('docx');
  const text = (value) => safeString(value, '');
  const heading = (value, level = HeadingLevel.HEADING_1) => new Paragraph({ text: value, heading: level });
  const cell = (value, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text(value), bold })] })] });
  const rows = [
    new TableRow({ children: shortlistColumns().slice(0, 11).map((column) => cell(column, true)) }),
    ...shortlistRows(snapshot).map((row) => new TableRow({ children: row.slice(0, 11).map((value) => cell(value)) })),
  ];
  const traceTable = new Table({ rows: [
    new TableRow({ children: [cell('Campo', true), cell('Valor', true)] }),
    ...traceRows(snapshot).map((row) => new TableRow({ children: row.map((value) => cell(value)) })),
  ] });
  const document = new Document({ sections: [{ children: [
    new Paragraph({ text: snapshot.metadata?.title || 'Avaliação de stakeholders', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Gerado em ${snapshot.generatedAt}` }),
    heading('Contexto'),
    new Paragraph({ text: text(snapshot.metadata?.context || 'Não informado') }),
    heading('Shortlist'),
    new Table({ rows }),
    heading('Justificativas e lacunas'),
    ...snapshot.shortlist.flatMap((entry) => [
      new Paragraph({ children: [new TextRun({ text: `${entry.rank}. ${entry.name}`, bold: true })] }),
      new Paragraph({ text: entry.summary || 'Justificativa não informada.' }),
      new Paragraph({ text: `Lacunas: ${entry.gaps.join('; ') || 'Nenhuma informada.'}` }),
    ]),
    heading('Rastreabilidade'),
    traceTable,
  ] }] });
  return asBlob(await Packer.toBlob(document), FORMAT_CONFIG.docx.mimeType);
}

async function buildPptx(snapshot) {
  const PptxGenJSModule = await import('pptxgenjs');
  const PptxGenJS = PptxGenJSModule.default || PptxGenJSModule;
  const pptx = new PptxGenJS();
  pptx.author = 'Senai Parceiros';
  pptx.subject = 'Avaliação de stakeholders';
  pptx.title = snapshot.metadata?.title || 'Avaliação de stakeholders';
  pptx.company = 'SENAI-SP';
  pptx.lang = 'pt-BR';
  pptx.layout = 'LAYOUT_WIDE';
  const navy = '0B3B60';
  const light = 'F2F6F9';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: navy };
  titleSlide.addText(snapshot.metadata?.title || 'Avaliação de stakeholders', { x: 0.6, y: 1.25, w: 11.9, h: 0.8, fontFace: 'Aptos Display', fontSize: 26, bold: true, color: 'FFFFFF', margin: 0 });
  titleSlide.addText(`Gerado em ${snapshot.generatedAt}`, { x: 0.65, y: 2.2, w: 11.5, h: 0.3, fontSize: 11, color: 'D6E6F2', margin: 0 });
  titleSlide.addText(snapshot.metadata?.context || 'Sem contexto informado', { x: 0.65, y: 2.8, w: 11.3, h: 1.1, fontSize: 17, color: 'FFFFFF', breakLine: false, margin: 0.02, fit: 'shrink' });

  const shortlistSlide = pptx.addSlide();
  shortlistSlide.addText('Shortlist recomendada', { x: 0.45, y: 0.25, w: 12, h: 0.4, fontSize: 22, bold: true, color: navy, margin: 0 });
  const tableRows = [
    [{ text: 'Pos.', options: { bold: true, color: 'FFFFFF' } }, { text: 'Stakeholder', options: { bold: true, color: 'FFFFFF' } }, { text: 'Instituição', options: { bold: true, color: 'FFFFFF' } }, { text: 'Total', options: { bold: true, color: 'FFFFFF' } }, { text: 'Confiança', options: { bold: true, color: 'FFFFFF' } }],
    ...snapshot.shortlist.map((entry) => [String(entry.rank), entry.name, entry.institution, String(entry.total), entry.confidence === '' ? '—' : String(entry.confidence)]),
  ];
  shortlistSlide.addTable(tableRows, { x: 0.45, y: 0.9, w: 12.2, h: 2.1, border: { type: 'solid', color: 'D6E0E8', pt: 1 }, fill: light, color: '172B4D', fontSize: 12, margin: 0.08, rowH: 0.38, bold: false, autoFit: false, colW: [0.65, 3.25, 4.45, 1.4, 1.5], valign: 'mid', breakLine: false });
  shortlistSlide.addText('As notas detalhadas, lacunas e fontes ficam no relatório completo.', { x: 0.5, y: 3.45, w: 11.7, h: 0.35, fontSize: 11, color: '536777', margin: 0 });

  const detailSlide = pptx.addSlide();
  detailSlide.addText('Critérios e rastreabilidade', { x: 0.45, y: 0.25, w: 12, h: 0.4, fontSize: 22, bold: true, color: navy, margin: 0 });
  const criteria = DIMENSION_KEYS.map((key) => `${DIMENSION_LABELS[key]}: ${snapshot.shortlist[0]?.dimensions?.[key] ?? '—'}`).join('\n');
  detailSlide.addText(criteria || 'Nenhuma avaliação disponível.', { x: 0.65, y: 1, w: 5.2, h: 3.3, fontSize: 15, breakLine: false, bullet: { type: 'ul' }, color: '172B4D', margin: 0.05, fit: 'shrink' });
  detailSlide.addText(`Fórmula: ${safeString(snapshot.trace?.formula)}\nModelo: ${safeString(snapshot.metadata?.model || snapshot.trace?.model, 'Não informado')}\nFontes e lacunas são preservadas no snapshot exportado.`, { x: 6.2, y: 1, w: 6.2, h: 3, fontSize: 13, color: '536777', margin: 0.05, fit: 'shrink' });

  return asBlob(await pptx.write({ outputType: 'blob' }), FORMAT_CONFIG.pptx.mimeType);
}

/**
 * Gera um artefato de exportacao.
 * @param {object} result Resultado produzido pelo selection engine.
 * @param {'xlsx'|'pdf'|'docx'|'pptx'} format Formato desejado.
 * @param {object} metadata Metadados opcionais do relatorio.
 * @returns {Promise<{blob: Blob, filename: string, mimeType: string, format: string, snapshot: object}>}
 */
export async function exportSelection(result, format, metadata = {}) {
  const normalizedFormat = normalizeFormat(format);
  const config = FORMAT_CONFIG[normalizedFormat];
  if (!config) {
    throw new Error(`Formato de exportação não suportado: ${format}`);
  }

  const snapshot = snapshotSelection(result, metadata);
  const builders = { xlsx: buildRichXlsx, pdf: buildPdf, docx: buildDocx, pptx: buildPptx };
  const blob = await builders[normalizedFormat](snapshot);
  return {
    blob,
    filename: metadata.filename || filenameFor(snapshot, normalizedFormat),
    mimeType: config.mimeType,
    format: normalizedFormat,
    snapshot,
  };
}

/** Dispara o download de um artefato no navegador. */
export function downloadExport(artifact) {
  if (!artifact?.blob) throw new Error('Artefato de exportação inválido.');
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(artifact.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.filename || 'exportacao';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export const EXPORT_FORMATS = Object.freeze(Object.keys(FORMAT_CONFIG));
