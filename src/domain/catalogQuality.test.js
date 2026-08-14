import { describe, expect, it } from 'vitest';
import {
  auditCatalogQuality,
  auditCatalogRecord,
  catalogPublicUrls,
  directPublicationUrls,
} from './catalogQuality';

const longDescription = 'Descrição factual baseada em fontes públicas. '.repeat(12);

describe('catalog quality contract', () => {
  it('accepts a complete organization card and ignores favicon plumbing as evidence', () => {
    const record = {
      nome: 'Instituto Completo', pais: 'Brasil', descricao: longDescription,
      natureza: 'Terceiro setor', diferencial: 'Formação técnica aplicada',
      relacao: 'Cooperação pública com a indústria', website: 'https://example.org',
      logo: 'https://www.google.com/s2/favicons?domain=example.org&sz=128',
    };

    expect(auditCatalogRecord(record, 'organization').pass).toBe(true);
    expect(catalogPublicUrls(record)).toEqual(['https://example.org']);
  });

  it('reports every objective gap instead of assigning a subjective score', () => {
    const quality = auditCatalogRecord({ nome: 'Perfil raso', pais: 'Brasil' }, 'person');

    expect(quality.pass).toBe(false);
    expect(quality.missing.map((item) => item.id)).toEqual(expect.arrayContaining([
      'description', 'public_links', 'field:institution', 'field:areas', 'field:profile',
    ]));
  });

  it('requires five direct publication links from research profiles', () => {
    const artigos = [1, 2, 3, 4, 5].map((index) => ({
      titulo: `Artigo ${index}`,
      url: index < 5 ? `https://doi.org/10.1000/${index}` : 'https://scholar.google.com/scholar?q=artigo',
    }));
    const record = {
      nome: 'Pesquisadora', pais: 'Brasil', instituicao: 'Universidade', areas: 'EPT',
      pesquisa: longDescription, scholar: 'https://scholar.google.com/citations?user=abc', artigos,
    };

    expect(directPublicationUrls(record)).toHaveLength(4);
    expect(auditCatalogRecord(record, 'person').missing.map((item) => item.id)).toContain('publications');
    record.artigos.push({ titulo: 'Artigo 6', url: 'https://example.org/artigo-6' });
    expect(auditCatalogRecord(record, 'person').pass).toBe(true);
  });

  it('does not impose academic publication fields on non-research specialists', () => {
    const record = {
      nome: 'Especialista industrial', pais: 'Brasil', instituicao: 'Indústria', areas: 'Manufatura',
      perfis_atuacao: ['indústria'], descricao: longDescription,
      perfil_principal_url: 'https://example.org/perfil',
      fontes: ['https://example.org/projeto', 'https://example.org/entrevista'],
    };

    const quality = auditCatalogRecord(record, 'person');
    expect(quality.pass).toBe(true);
    expect(quality.metrics.researchProfile).toBe(false);
  });

  it('summarizes all categories for the catalog-wide gate', () => {
    const organization = {
      nome: 'Organização', pais: 'Brasil', descricao: longDescription, natureza: 'Pública',
      diferencial: 'Atuação técnica', relacao: 'Relação pública', website: 'https://example.org',
    };
    const summary = auditCatalogQuality({ organization: [organization, { nome: 'Rasa' }], person: [] });

    expect(summary).toMatchObject({ total: 2, conforming: 1, needsEnrichment: 1 });
    expect(summary.categories.find((entry) => entry.category === 'organization')).toMatchObject({ total: 2, conforming: 1 });
  });
});
