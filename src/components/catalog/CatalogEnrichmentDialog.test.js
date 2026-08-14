import { describe, expect, it } from 'vitest';
import { catalogEnrichmentErrorMessage } from './CatalogEnrichmentDialog.jsx';

describe('catalog enrichment errors', () => {
  it('explains the recoverable provider timeout instead of showing the generic failure', () => {
    expect(catalogEnrichmentErrorMessage('provider_timeout')).toContain('Continuar enriquecimento');
    expect(catalogEnrichmentErrorMessage('provider_timeout')).not.toBe('Não foi possível concluir o enriquecimento agora.');
  });
});
