import { describe, expect, it } from 'vitest';
import {
  CATALOG_RESEARCH_GEOGRAPHIES,
  CATALOG_RESEARCH_QUANTITIES,
  flattenResearchPreviews,
  groupApprovedResearchDecisions,
  nextResearchBatch,
  researchDecisionKey,
  runCatalogResearchBatches,
} from './catalogResearchFlow.js';

describe('catalog deep-research flow', () => {
  it('exposes only the requested quantity and geography choices', () => {
    expect(CATALOG_RESEARCH_QUANTITIES).toEqual([5, 10, 20, 50, 100]);
    expect(CATALOG_RESEARCH_GEOGRAPHIES).toEqual([
      { value: 'brasil', label: 'Brasil' },
      { value: 'internacional', label: 'Internacional' },
    ]);
  });

  it('plans batches of five and excludes names already found', () => {
    expect(nextResearchBatch([], 20)).toEqual({ batchIndex: 0, batchSize: 5, excludeCandidates: [] });
    const previews = [{ batchId: 'a', rows: Array.from({ length: 5 }, (_, index) => ({ rowNumber: index + 1, record: { nome: `Nome ${index + 1}` } })) }];
    expect(nextResearchBatch(previews, 20)).toMatchObject({ batchIndex: 1, batchSize: 5, excludeCandidates: ['Nome 1', 'Nome 2', 'Nome 3', 'Nome 4', 'Nome 5'] });
    expect(flattenResearchPreviews(previews)[0]).toMatchObject({ batchId: 'a', rowNumber: 1 });
  });

  it('groups approved cards by their import batch', () => {
    const previews = [
      { batchId: 'a', rows: [{ rowNumber: 1 }, { rowNumber: 2 }] },
      { batchId: 'b', rows: [{ rowNumber: 1 }] },
    ];
    const decisions = {
      [researchDecisionKey('a', 1)]: 'use_imported',
      [researchDecisionKey('a', 2)]: 'ignore',
      [researchDecisionKey('b', 1)]: 'ignore',
    };
    expect(groupApprovedResearchDecisions(previews, decisions)).toEqual([{ batchId: 'a', decisions: { 1: 'use_imported', 2: 'ignore' } }]);
  });

  it('runs a 20-card request as four sequential batches and carries exclusions forward', async () => {
    const calls = [];
    const result = await runCatalogResearchBatches({
      requestedQuantity: 20,
      requestBatch: async (batch) => {
        calls.push(batch);
        return {
          batchId: `batch-${batch.batchIndex}`,
          rows: Array.from({ length: batch.batchSize }, (_, index) => ({
            rowNumber: index + 1,
            record: { nome: `Nome ${batch.batchIndex * 5 + index + 1}` },
          })),
        };
      },
    });

    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.batchIndex)).toEqual([0, 1, 2, 3]);
    expect(calls.map((call) => call.excludeCandidates.length)).toEqual([0, 5, 10, 15]);
    expect(result).toMatchObject({ cards: 20, complete: true });
  });

  it('runs a 10-card request as two sequential batches', async () => {
    const calls = [];
    const result = await runCatalogResearchBatches({
      requestedQuantity: 10,
      requestBatch: async (batch) => {
        calls.push(batch);
        return {
          batchId: `batch-${batch.batchIndex}`,
          rows: Array.from({ length: batch.batchSize }, (_, index) => ({
            rowNumber: index + 1,
            record: { nome: `Nome ${batch.batchIndex * 5 + index + 1}` },
          })),
        };
      },
    });

    expect(calls.map((call) => call.batchSize)).toEqual([5, 5]);
    expect(result).toMatchObject({ cards: 10, complete: true });
  });
});
