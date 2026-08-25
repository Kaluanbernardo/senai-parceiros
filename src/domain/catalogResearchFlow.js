export const CATALOG_RESEARCH_BATCH_SIZE = 5;
export const CATALOG_RESEARCH_QUANTITIES = Object.freeze([5, 10, 20, 50, 100]);
export const CATALOG_RESEARCH_GEOGRAPHIES = Object.freeze([
  Object.freeze({ value: 'brasil', label: 'Brasil' }),
  Object.freeze({ value: 'internacional', label: 'Internacional' }),
]);

export function researchDecisionKey(batchId, rowNumber) {
  return `${batchId}:${rowNumber}`;
}

export function flattenResearchPreviews(previews = []) {
  return previews.flatMap((preview) => (preview?.rows || []).map((row) => ({ ...row, batchId: preview.batchId })));
}

export function countResearchCandidates(previews = []) {
  return flattenResearchPreviews(previews).filter((row) => row?.status ? row.status === 'new' : Boolean(row?.record?.nome || row?.record?.instituicao)).length;
}

export function visibleResearchPreviews(previews = [], busy = false) {
  if (busy) return [];
  return previews
    .map((preview) => ({
      ...preview,
      rows: (preview?.rows || []).filter((row) => !['possible_duplicate', 'already_imported'].includes(row.status)),
    }))
    .filter((preview) => preview.rows.length);
}

export function nextResearchBatch(previews = [], requestedQuantity = CATALOG_RESEARCH_QUANTITIES[0]) {
  const rows = flattenResearchPreviews(previews);
  const remaining = Math.max(0, Number(requestedQuantity) - countResearchCandidates(previews));
  if (!remaining) return null;
  return {
    batchIndex: previews.length,
    batchSize: Math.min(CATALOG_RESEARCH_BATCH_SIZE, remaining),
    excludeCandidates: [...new Set(rows.map((row) => row.record?.nome || row.record?.instituicao).filter(Boolean))].slice(0, 100),
  };
}

export async function runCatalogResearchBatches({ initialPreviews = [], requestedQuantity, requestBatch, onBatch } = {}) {
  if (typeof requestBatch !== 'function') throw new TypeError('research_batch_request_required');
  let previews = [...initialPreviews];
  const initialCards = countResearchCandidates(previews);
  const maximumBatches = Math.ceil(Math.max(0, Number(requestedQuantity) - initialCards) / CATALOG_RESEARCH_BATCH_SIZE) + 2;
  for (let attempt = 0; attempt < maximumBatches; attempt += 1) {
    const batch = nextResearchBatch(previews, requestedQuantity);
    if (!batch) break;
    try {
      const preview = await requestBatch(batch);
      if (!preview?.batchId || !Array.isArray(preview.rows) || !preview.rows.length) throw new Error('research_empty_batch');
      previews = [...previews, preview];
      await onBatch?.(previews, preview);
    } catch (error) {
      error.completedPreviews = previews;
      throw error;
    }
  }
  return {
    previews,
    cards: countResearchCandidates(previews),
    complete: countResearchCandidates(previews) >= Number(requestedQuantity),
  };
}

export function groupApprovedResearchDecisions(previews = [], decisions = {}) {
  const approved = new Set(['use_imported', 'merge']);
  return previews.flatMap((preview) => {
    const batchDecisions = Object.fromEntries((preview.rows || []).map((row) => [
      String(row.rowNumber),
      decisions[researchDecisionKey(preview.batchId, row.rowNumber)] || 'ignore',
    ]));
    return Object.values(batchDecisions).some((decision) => approved.has(decision))
      ? [{ batchId: preview.batchId, decisions: batchDecisions }]
      : [];
  });
}
