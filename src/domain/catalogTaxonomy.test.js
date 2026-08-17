import { describe, expect, it } from 'vitest';
import {
  CATALOG_CATEGORY_LABELS,
  ORGANIZATION_SUBTYPES,
  PERSON_SUBTYPES,
  inferOrganizationSubtype,
  inferPersonSubtype,
  normalizeCatalogRequest,
  normalizeOrganizationSubtype,
  normalizeCatalogCategory,
  withCatalogClassification,
} from './catalogTaxonomy';

describe('catalog taxonomy', () => {
  it('exposes only individuals and legal entities as canonical categories', () => {
    expect(Object.keys(CATALOG_CATEGORY_LABELS)).toEqual(['person', 'organization']);
    expect(normalizeCatalogCategory('researcher')).toBe('person');
    expect(normalizeCatalogCategory('school')).toBe('organization');
    expect(normalizeCatalogCategory('Pessoa Jurídica')).toBe('organization');
  });

  it('infers useful person subtypes without making academic fields universal', () => {
    expect(inferPersonSubtype({ perfis_atuacao: ['pesquisa'], orcid: '0000-0001' })).toBe(PERSON_SUBTYPES[1]);
    expect(inferPersonSubtype({ cargo: 'Secretária de Estado e agente pública' })).toBe(PERSON_SUBTYPES[6]);
    expect(inferPersonSubtype({ cargo: 'Engenheira de manufatura' })).toBe(PERSON_SUBTYPES[0]);
  });

  it('keeps education as a legal-entity subtype', () => {
    expect(inferOrganizationSubtype({ categoria: 'Escola', areas_formacao: ['mecatrônica'] })).toBe(ORGANIZATION_SUBTYPES[0]);
    expect(withCatalogClassification({ nome: 'Centro Técnico', categoria: 'Escola' }, 'school')).toMatchObject({
      categoria: 'Pessoa Jurídica',
      subtipo: 'Instituição de ensino',
    });
  });

  it('prioritizes declared legal nature over incidental descriptive words', () => {
    expect(inferOrganizationSubtype({ categoria: 'Terceiro setor', atuacao: 'Educação para a indústria' })).toBe(ORGANIZATION_SUBTYPES[5]);
    expect(inferOrganizationSubtype({ natureza: 'Pública / PPP', nome: 'Secretaria de Educação Profissional' })).toBe(ORGANIZATION_SUBTYPES[2]);
  });

  it('does not preserve arbitrary subtype text and keeps the school alias specific', () => {
    expect(normalizeOrganizationSubtype('Categoria inventada')).toBe('');
    expect(inferOrganizationSubtype({ subtipo: 'Categoria inventada', categoria: 'Empresa' })).toBe(ORGANIZATION_SUBTYPES[1]);
    expect(normalizeCatalogRequest('school')).toEqual({ category: 'organization', subtype: ORGANIZATION_SUBTYPES[0] });
  });
});
