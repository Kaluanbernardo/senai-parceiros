import { describe, expect, it } from 'vitest';
import { buildLegalEntityCatalog } from './legalEntityCatalog';

describe('legal entity catalog', () => {
  it('combines education institutions and other organizations under one category', () => {
    const records = buildLegalEntityCatalog({
      schools: [{ id: 1, instituicao: 'Escola Técnica Teste', pais: 'Brasil', areas: 'Mecatrônica' }],
      stakeholders: [{ id: 2, nome: 'Empresa Teste', categoria: 'Empresa', pais: 'Brasil', diferencial: 'Automação industrial' }],
    });

    expect(records).toHaveLength(2);
    expect(records.every((record) => record.categoria === 'Pessoa Jurídica')).toBe(true);
    expect(records.find((record) => record.nome === 'Escola Técnica Teste')).toMatchObject({ subtipo: 'Instituição de ensino' });
    expect(records.find((record) => record.nome === 'Empresa Teste')).toMatchObject({ subtipo: 'Empresa' });
  });

  it('excludes concepts and reclassifies organizations from the legacy school source', () => {
    const records = buildLegalEntityCatalog({
      schools: [
        { id: 62, instituicao: 'T-Levels (sistema)', pais: 'Reino Unido' },
        { id: 84, instituicao: 'NCVER — National Centre for Vocational Education Research', pais: 'Austrália' },
        { id: 89, instituicao: 'DHET — Department of Higher Education and Training', pais: 'África do Sul' },
      ],
    });
    expect(records.map((record) => record.nome)).not.toContain('T-Levels (sistema)');
    expect(records.find((record) => record.nome.startsWith('NCVER'))?.subtipo).toBe('Centro de pesquisa e inovação');
    expect(records.find((record) => record.nome.startsWith('DHET'))?.subtipo).toBe('Órgão público');
  });
});
