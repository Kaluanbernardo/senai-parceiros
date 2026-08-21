import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImportCandidateCard } from './ImportReview.jsx';

function researchedPerson() {
  return {
    rowNumber: 1,
    status: 'new',
    record: {
      categoria: 'Pessoa',
      nome: 'Marina Exemplo',
      pais: 'Brasil',
      cargo: 'Professora',
      instituicao: 'Instituto Federal Exemplo',
      miniBio: 'Pesquisadora de inteligência artificial aplicada à educação profissional.',
      descricao: 'Pesquisadora de inteligência artificial aplicada à educação profissional.',
      perfis_atuacao: ['pesquisa'],
      areas: ['Inteligência artificial', 'Educação profissional'],
      data_consulta: '2026-08-14',
      scholar: 'https://scholar.google.com/citations?user=abc',
      profileType: 'scholar',
      fontes: ['https://example.edu/perfil', 'https://orcid.org/0000-0000-0000-0000', 'https://scholar.google.com/citations?user=abc'],
      dados_nao_localizados: [],
      confianca: 95,
    },
    errors: [],
  };
}

describe('cartão de revisão de importação', () => {
  it('uses the catalog card anatomy and removes the redundant decision label', () => {
    const html = renderToStaticMarkup(
      <ImportCandidateCard row={researchedPerson()} decision="ignore" onDecision={vi.fn()} />,
    );

    expect(html).toContain('Marina Exemplo');
    expect(html).toContain('Pesquisada em');
    expect(html).not.toContain('Decisão:');
  });
});
