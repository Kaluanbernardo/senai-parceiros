import { describe, expect, it, vi } from 'vitest';
import {
  catalogEnrichmentErrorMessage,
  catalogEnrichmentFailureReason,
  catalogEnrichmentFieldLabel,
  catalogEnrichmentRunningMessage,
  runCatalogEnrichmentBatch,
} from './CatalogEnrichmentDialog.jsx';

describe('catalog enrichment errors', () => {
  it('explains a blocked card by its real processing error instead of hiding it behind the quality gaps', () => {
    const reason = catalogEnrichmentFailureReason({ error: 'provider_4xx', missing: ['website oficial'] });
    expect(reason).toBe(catalogEnrichmentErrorMessage('provider_4xx'));
    expect(reason).not.toBe('website oficial');
  });

  it('falls back to the missing quality fields when the card only failed the quality gate', () => {
    expect(catalogEnrichmentFailureReason({ error: 'quality_gate_failed', missing: ['website oficial'] })).toBe('website oficial');
  });

  it('falls back to a generic message when nothing is missing and there is no error', () => {
    expect(catalogEnrichmentFailureReason({})).toBe('Evidência pública insuficiente');
  });

  it('explains the recoverable provider timeout instead of showing the generic failure', () => {
    expect(catalogEnrichmentErrorMessage('provider_timeout')).toContain('Continuar enriquecimento');
    expect(catalogEnrichmentErrorMessage('provider_timeout')).not.toBe('Não foi possível concluir o enriquecimento agora.');
  });

  it('explica a resposta incompleta do provedor sem expor o erro de JSON', () => {
    const message = catalogEnrichmentErrorMessage('provider_invalid_response');
    expect(message).toContain('resposta incompleta');
    expect(message).not.toContain('JSON');
  });

  it('identifies the active card and keeps visible time moving between responses', () => {
    expect(catalogEnrichmentRunningMessage({
      next: { name: 'Ewart Keep', attempt: 2, maxAttempts: 2 },
    }, 17)).toBe('Processando Ewart Keep (tentativa 2 de 2) · 17 s nesta etapa. Cada card pode levar até 45 segundos; o contador avança quando a etapa termina.');
  });

  it('processes and commits every remaining card without another click', async () => {
    const responses = [
      { batchId: 'batch-1', counts: { total: 2, pending: 1, passed: 1 }, next: { key: 'organization:1', name: 'Primeiro' } },
      { batchId: 'batch-1', counts: { total: 2, committed: 1, pending: 1, passed: 0 }, next: { key: 'organization:2', name: 'Segundo' }, enriched: [{ key: 'organization:1', fields: [{ field: 'descricao' }] }] },
      { batchId: 'batch-1', counts: { total: 2, pending: 0, passed: 1 }, next: null },
      { batchId: 'batch-1', counts: { total: 2, committed: 2, pending: 0, passed: 0 }, next: null, enriched: [{ key: 'organization:1' }, { key: 'organization:2' }] },
    ];
    const request = vi.fn(async () => responses.shift());

    const result = await runCatalogEnrichmentBatch({
      batchId: 'batch-1', counts: { total: 2, pending: 2, passed: 0 }, next: { key: 'organization:1', name: 'Primeiro' },
    }, { request });

    expect(request.mock.calls.map(([body]) => body.action)).toEqual(['process', 'commit', 'process', 'commit']);
    expect(result.counts.committed).toBe(2);
    expect(result.enriched).toHaveLength(2);
  });

  it('continues the bulk queue after a card exhausts its attempts', async () => {
    const responses = [
      { batchId: 'batch-1', counts: { total: 2, pending: 2, failed: 0, passed: 0 }, next: { key: 'organization:1', name: 'Primeiro', attempt: 2, maxAttempts: 2 } },
      { batchId: 'batch-1', counts: { total: 2, pending: 1, failed: 1, passed: 0 }, next: { key: 'organization:2', name: 'Segundo', attempt: 1, maxAttempts: 2 } },
      { batchId: 'batch-1', counts: { total: 2, pending: 0, failed: 1, passed: 1 }, next: null },
      { batchId: 'batch-1', counts: { total: 2, committed: 1, pending: 0, failed: 1, passed: 0 }, next: null, enriched: [{ key: 'organization:2' }] },
    ];
    const request = vi.fn(async () => responses.shift());

    const result = await runCatalogEnrichmentBatch({
      batchId: 'batch-1', counts: { total: 2, pending: 2, failed: 0, passed: 0 }, next: { key: 'organization:1', name: 'Primeiro', attempt: 1, maxAttempts: 2 },
    }, { request });

    expect(request.mock.calls.map(([body]) => body.action)).toEqual(['process', 'process', 'process', 'commit']);
    expect(result.counts).toMatchObject({ committed: 1, failed: 1, pending: 0 });
  });

  it('uses readable labels for the enriched field report', () => {
    expect(catalogEnrichmentFieldLabel('perfil_principal_url')).toBe('Perfil principal');
    expect(catalogEnrichmentFieldLabel('campo_novo')).toBe('campo novo');
  });
});
