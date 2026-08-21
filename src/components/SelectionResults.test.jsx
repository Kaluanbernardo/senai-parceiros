import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SelectionResults from './SelectionResults.jsx';
import { buildLocalEvaluation } from '../domain/selectionEngine.js';
import pesquisadores from '../data/pesquisadores.json';

/**
 * A tela de resultados descartava quase tudo que o motor calcula: as seis
 * dimensões, a faixa de decisão de cada candidato e a distinção entre
 * recomendado e exploratório existiam só no `trace`. Estes testes usam o
 * catálogo real e uma pergunta real para garantir que essa informação chega
 * de fato à tela.
 */
function realResult() {
  const answers = {
    context: 'Especialistas em digitalização e indústria 4.0 na formação profissional, para uma palestra em São Paulo.',
    themes: 'digitalização, indústria 4.0, formação de docentes',
    desired_outcome: 'palestra de abertura em um evento presencial',
  };
  return buildLocalEvaluation({
    category: 'person',
    objective: 'speaker',
    answers,
    candidates: pesquisadores,
    brief: { answers, priorities: [], uncertainties: [] },
  });
}

function render(result) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SelectionResults result={result} onReview={vi.fn()} onRestart={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('resultados da seleção', () => {
  const result = realResult();

  it('produz uma shortlist a partir do catálogo real', () => {
    expect(result.shortlist.length).toBeGreaterThan(1);
  });

  it('mostra a faixa de decisão de cada candidato, não só do que está aberto', () => {
    const html = render(result);
    const bands = html.match(/Boa opção para conhecer|Vale conhecer|Opção complementar/g) || [];
    // Uma por linha da lista, mais a ficha do candidato aberto.
    expect(bands.length).toBeGreaterThanOrEqual(result.shortlist.length);
  });

  it('mostra em que o candidato aberto se diferencia dos demais', () => {
    const html = render(result);
    expect(html).toContain('Onde este se diferencia');
  });

  it('oferece o caminho de volta para a ficha no catálogo', () => {
    const html = render(result);
    expect(html).toContain('Ver no catálogo');
    expect(html).toContain('/catalogo/pessoas-fisicas?perfil=');
  });

  it('anuncia quantos parceiros foram recomendados', () => {
    const html = render(result);
    expect(html).toContain(`${result.shortlist.length} parceiros recomendados`);
  });

  it('continua explicando a lista vazia sem quebrar', () => {
    const html = render({ shortlist: [], trace: { requestSignal: { hasSignal: false } } });
    expect(html).toContain('Não conseguimos reconhecer um tema');
    expect(html).toContain('Revisar respostas');
  });

  it('não quebra com um único candidato, quando não há com quem comparar', () => {
    const single = { ...result, shortlist: result.shortlist.slice(0, 1) };
    const html = render(single);
    expect(html).toContain('1 parceiro recomendado');
    expect(html).not.toContain('Onde este se diferencia');
  });
});
