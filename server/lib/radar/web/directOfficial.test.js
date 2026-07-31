import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { DirectOfficialWebProvider } from './directOfficial.js';

const editionHtml = await readFile(new URL('../fixtures/dou-edition.html', import.meta.url), 'utf8');
const editionSpaHtml = await readFile(new URL('../fixtures/dou-edition-spa.html', import.meta.url), 'utf8');
const articleHtml = await readFile(new URL('../fixtures/dou-article.html', import.meta.url), 'utf8');

describe('DirectOfficialWebProvider', () => {
  it('discovers DOU article links while keeping official provenance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(editionHtml, { status: 200 }));
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1'], maxDays: 1 });
    const result = await provider.discover({ startDate: '2026-07-17', endDate: '2026-07-17', maxResults: 10 });
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ sourceName: 'Diário Oficial da União', official: true, provider: 'direct-official', publishedAt: '2026-07-17' });
    expect(result.items[0].sourceUrl).toContain('in.gov.br/web/dou/');
    expect(result.items[0].provenance.editionUrl).toContain('leiturajornal');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('busca os atos em paralelo, senao a edicao inteira se perde por tempo', async () => {
    // Eligibility needs the act's body, so a sequential retrieval ran out of
    // budget after discovery and every discovered act was dropped for lack of
    // content rather than for lack of relevance.
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      inFlight -= 1;
      return new Response(articleHtml, { status: 200 });
    });
    const provider = new DirectOfficialWebProvider({ fetchImpl, concurrency: 5 });
    const urls = Array.from({ length: 10 }, (_, index) => `https://www.in.gov.br/web/dou/-/portaria-${index}`);
    const result = await provider.retrieve({ urls });

    expect(result.documents).toHaveLength(10);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('retrieves validated DOU article URLs and rejects external URLs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(articleHtml, { status: 200 }));
    const provider = new DirectOfficialWebProvider({ fetchImpl });
    const result = await provider.retrieve({ urls: ['https://www.in.gov.br/web/dou/-/portaria-123', 'https://example.org/noticia'] });
    expect(result.status).toBe('partial');
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].content).toMatch(/diretrizes para programas/i);
    expect(result.documents[0].title).toMatch(/Portaria de educação profissional/i);
    expect(result.errors).toContainEqual({ url: 'https://example.org/noticia', error: 'url_not_allowed' });
  });

  it('isolates the first act when one DOU article groups multiple acts', async () => {
    // Real DOU pages can group several acts under one <article>, separated by
    // p.identifica. A vocational term in a later act must not approve the first.
    const groupedHtml = `
      <html><body><article>
        <p class="text-center">Publicado em: 27/07/2026</p>
        <p class="identifica">ALVARA No 3.155, DE 23 DE JULHO DE 2026</p>
        <p class="dou-paragraph">Autoriza compra de municao por centro de formacao de vigilantes.</p>
        <p class="identifica">PORTARIA No 99, DE 24 DE JULHO DE 2026</p>
        <p class="dou-paragraph">Institui politica de educacao profissional tecnica.</p>
      </article></body></html>`;
    const provider = new DirectOfficialWebProvider({ fetchImpl: vi.fn().mockResolvedValue(new Response(groupedHtml, { status: 200 })) });

    const result = await provider.retrieve({ urls: ['https://www.in.gov.br/web/dou/-/alvara-n-3.155'] });

    expect(result.documents[0].content).toMatch(/formacao de vigilantes/i);
    expect(result.documents[0].content).not.toMatch(/educacao profissional/i);
  });

  it('does not treat an annex table entry as the subject of the act', async () => {
    // The real SERES false positive matched "qualificacao profissional" only
    // inside a maintainer name in a large course table.
    const tableHtml = `
      <html><body><article>
        <p class="identifica">PORTARIA SERES/MEC No 356</p>
        <p>Reconhece cursos superiores de graduacao a distancia.</p>
        <table><tr><td>Instituto de Educacao e Qualificacao Profissional</td></tr></table>
      </article></body></html>`;
    const provider = new DirectOfficialWebProvider({ fetchImpl: vi.fn().mockResolvedValue(new Response(tableHtml, { status: 200 })) });

    const result = await provider.retrieve({ urls: ['https://www.in.gov.br/web/dou/-/portaria-seres-mec-356'] });

    expect(result.documents[0].content).toMatch(/cursos superiores/i);
    expect(result.documents[0].content).not.toMatch(/qualificacao profissional/i);
  });

  it('le os atos do payload embutido mesmo quando a edicao tem ancoras', async () => {
    // Anchors on an edition page are navigation links repeated across editions,
    // so gating the payload on their absence made it unreachable.
    const withNavigation = editionSpaHtml.replace(
      '<div id="root"></div>',
      '<a href="/web/dou/-/edicao-anterior">Edição anterior do Diário Oficial</a><div id="root"></div>',
    );
    const fetchImpl = vi.fn().mockResolvedValue(new Response(withNavigation, { status: 200 }));
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1'], maxDays: 1 });
    const result = await provider.discover({ startDate: '2026-07-17', endDate: '2026-07-17', maxResults: 10 });

    expect(result.status).toBe('ok');
    // The navigation anchor still comes through; what matters is that the acts
    // are no longer excluded by its mere presence.
    const act = result.items.find((item) => /educação profissional/i.test(item.title));
    expect(act).toBeTruthy();
    expect(act).toMatchObject({
      sourceName: 'Diário Oficial da União',
      official: true,
      provider: 'direct-official',
      publishedAt: '2026-07-17',
    });
    expect(act.sourceUrl).toContain('in.gov.br/web/dou/');
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });

  it('descreve a estrutura da edicao sem expor conteudo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(editionSpaHtml, { status: 200 }));
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1'], maxDays: 1 });
    const result = await provider.discover({ startDate: '2026-07-17', endDate: '2026-07-17' });

    expect(result.diagnostics.markers).toMatchObject({
      hasParamsScript: true,
      hasJsonArray: true,
      scriptsJson: 1,
    });
    expect(result.diagnostics.markers.biggestJsonKeys).toEqual(['jsonArray']);
    // Key names and counts only; no title, no body, no page text.
    const serialized = JSON.stringify(result.diagnostics.markers);
    expect(serialized).not.toMatch(/Portaria|educação profissional/i);
  });

  it('distingue edicao sem ato de pagina que nao foi lida', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html><body><div id="root"></div></body></html>', { status: 200 }));
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1'], maxDays: 1 });
    const result = await provider.discover({ startDate: '2026-07-17', endDate: '2026-07-17' });

    expect(result.items).toHaveLength(0);
    expect(result.diagnostics).toMatchObject({ editionsRead: 1, anchorItems: 0, embeddedItems: 0, emptyEditions: 1 });
    expect(result.diagnostics.htmlBytes).toBeGreaterThan(0);
  });

  it('busca as edicoes em paralelo para permitir uma janela util', async () => {
    // One edition per day per section fetched one after another made a useful
    // lookback cost more wall clock than a serverless invocation has, which is
    // why the window stayed too short to ever catch an act.
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      inFlight -= 1;
      return new Response(editionHtml, { status: 200 });
    });
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1', 'DO3'], maxDays: 10, concurrency: 6 });
    const result = await provider.discover({ startDate: '2026-07-08', endDate: '2026-07-17', maxResults: 200 });

    expect(result.status).toBe('ok');
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(6);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('keeps source failures observable without throwing away partial results', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(editionHtml, { status: 200 }))
      .mockRejectedValueOnce(new Error('network_down'));
    const provider = new DirectOfficialWebProvider({ fetchImpl, sections: ['DO1', 'DO3'], maxDays: 1 });
    const result = await provider.discover({ startDate: '2026-07-17', endDate: '2026-07-17' });
    expect(result.status).toBe('partial');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toBe('network_down');
  });
});

