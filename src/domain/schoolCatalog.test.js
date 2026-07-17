import { describe, expect, it } from 'vitest';
import { mergeSchoolSources } from './schoolCatalog';

describe('school catalog', () => {
  it('merges SENAI/SENAC variants while preserving source provenance', () => {
    const records = mergeSchoolSources({
      schools: [
        { id: 1, instituicao: 'Serviço Nacional de Aprendizagem Industrial', pais: 'Brasil', website: 'https://portaldaindustria.com.br/senai', relevancia: 'rede' },
        { id: 2, instituicao: 'Serviço Nacional de Aprendizagem Comercial', pais: 'Brasil', website: 'https://senac.br', relevancia: 'rede' },
      ],
      stakeholders: [
        { id: 74, nome: 'SENAI — Serviço Nacional de Aprendizagem Industrial', categoria: 'Escola', pais: 'Brasil', website: 'https://portaldaindustria.com.br/senai', relacao: '✅ parceria' },
        { id: 73, nome: 'SENAC – Serviço Nacional de Aprendizagem Comercial', categoria: 'Escola', pais: 'Brasil', website: 'https://senac.br' },
      ],
    });

    expect(records).toHaveLength(2);
    expect(records.find((record) => record.catalogIdentity === 'alias:senai').sourceRecords).toHaveLength(2);
    expect(records.find((record) => record.catalogIdentity === 'alias:senai').hasPartnership).toBe(true);
  });

  it('keeps different entities sharing a parent domain separate', () => {
    const records = mergeSchoolSources({
      schools: [
        { id: 1, instituicao: 'Serviço Nacional de Aprendizagem Industrial', pais: 'Brasil', website: 'https://portaldaindustria.com.br/senai' },
        { id: 8, instituicao: 'Serviço Social da Indústria', pais: 'Brasil', website: 'https://portaldaindustria.com.br/sesi' },
      ],
    });
    expect(records).toHaveLength(2);
  });

  it('does not merge a national network with a regional or local unit', () => {
    const records = mergeSchoolSources({
      schools: [
        { id: 1, instituicao: 'Serviço Nacional de Aprendizagem Industrial', pais: 'Brasil' },
        { id: 2, instituicao: 'SENAI-SP — Departamento Regional de São Paulo', pais: 'Brasil' },
        { id: 3, instituicao: 'SENAI Roberto Mange', pais: 'Brasil' },
      ],
    });

    expect(records).toHaveLength(3);
    expect(records.map((record) => record.catalogIdentity)).toEqual(expect.arrayContaining(['alias:senai', expect.stringContaining('scoped:senai:')]));
    expect(records.find((record) => record.nome === 'SENAI Roberto Mange').scope).toBe('local');
  });

  it('only marks explicit positive relations as confirmed partnerships', () => {
    const records = mergeSchoolSources({
      stakeholders: [
        { id: 1, nome: 'Ivy Tech', categoria: 'Escola', relacao: 'Sem evidência pública de parceria com SENAI.' },
        { id: 2, nome: 'Instituto parceiro', categoria: 'Escola', relacao: 'Parceiro de projetos.' },
        { id: 3, nome: 'ITS Academy', categoria: 'Escola', relacao: '🔗 SENAI lista Politecnico di Milano como parceiro. SENAI acompanha o modelo ITS. Possíveis diálogos via programas UE-América Latina.' },
      ],
    });

    expect(records.find((record) => record.nome === 'Ivy Tech').hasPartnership).toBe(false);
    expect(records.find((record) => record.nome === 'Instituto parceiro').hasPartnership).toBe(true);
    expect(records.find((record) => record.nome === 'ITS Academy').hasPartnership).toBe(false);
  });
});
