import { describe, expect, it } from 'vitest';
import { catalogEnrichmentErrorMessage, catalogEnrichmentFailureReason, catalogEnrichmentRunningMessage } from './CatalogEnrichmentDialog.jsx';

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
});
