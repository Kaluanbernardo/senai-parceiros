import { describe, expect, it } from 'vitest';
import { catalogEnrichmentActionState, catalogEnrichmentErrorMessage, catalogEnrichmentRunningMessage } from './CatalogEnrichmentDialog.jsx';

describe('catalog enrichment errors', () => {
  it('explains the recoverable provider timeout instead of showing the generic failure', () => {
    expect(catalogEnrichmentErrorMessage('provider_timeout')).toContain('Continuar enriquecimento');
    expect(catalogEnrichmentErrorMessage('provider_timeout')).not.toBe('Não foi possível concluir o enriquecimento agora.');
  });

  it('shows that processing continues after a card becomes blocked', () => {
    expect(catalogEnrichmentActionState({
      running: true,
      hasFailed: true,
      pending: 43,
      needsEnrichment: 67,
    })).toEqual({ kind: 'running', label: 'Processando...' });
  });

  it('identifies the active card and keeps visible time moving between responses', () => {
    expect(catalogEnrichmentRunningMessage({
      next: { name: 'Ewart Keep', attempt: 2, maxAttempts: 2 },
    }, 17)).toBe('Processando Ewart Keep (tentativa 2 de 2) · 17 s nesta etapa. Cada card pode levar até 45 segundos; o contador avança quando a etapa termina.');
  });
});
