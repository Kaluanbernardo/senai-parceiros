import { afterEach, describe, expect, it, vi } from 'vitest';
import { dedupeRadarItems, douRelevance, fetchDouItems, fetchFeedItems, fetchOecdItems, fetchOpenAlexItems, fetchWebItems, filterRadarItems, normalizeRadarItem, refreshRadarEditorials, refreshRadarSnapshot, getRadarFeedPolicy, getRadarFeedReadiness, getRadarItems, getRadarStoreStatus, getTrackedResearcherCatalog, RADAR_SOURCE_POLICY, RADAR_WEB_POLICY, resetRadarLiveCache } from './radar.js';
import { radarStore } from './radarStore.js';
import { catalogStore } from './catalogStore.js';

const baseItems = [
  normalizeRadarItem({ id: 'a', section: 'research', title: 'IA na indústria', summaryPt: 'Competências para manufatura', publishedAt: '2026-07-10', sourceName: 'OpenAlex', contentType: 'artigo', topics: ['IA', 'indústria'], relevanceScore: 90, externalId: 'doi:a' }),
  normalizeRadarItem({ id: 'b', section: 'government', title: 'Política de EPT', summaryPt: 'MEC', publishedAt: '2026-06-10', sourceName: 'MEC / SETEC', contentType: 'notícia oficial', topics: ['EPT'], relevanceScore: 80, externalId: 'gov:b' }),
];

/**
 * Modo estrito: nenhum item chega ao leitor com o texto cru da fonte, entao uma
 * coleta ao vivo com fila de reescrita exige provedor. Estes testes sao sobre
 * coleta e armazenamento, nao sobre o modelo, entao o provedor responde uma
 * reescrita valida e sai da frente.
 */
function enableRadarProvider() {
  process.env.AI_PROVIDER = 'openrouter';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'test/model';
  process.env.RADAR_EDITORIAL_PROVIDER = 'openrouter';
  process.env.RADAR_SUMMARY_PROVIDER = 'openrouter';
}

function providerReply(request) {
  const payload = JSON.parse(request.body);
  const requested = JSON.parse(payload.messages.at(-1).content);
  const body = payload.response_format?.json_schema?.name === 'radar_research_summaries'
    ? { summaries: requested.map((item) => ({ id: item.id, summaryPt: 'O estudo compara percursos de educação profissional para manufatura avançada e apresenta evidências sobre participação empresarial, currículo e oportunidades de aprendizagem.' })) }
    : { items: requested.map((item) => ({ id: item.id, title: 'Institutos federais podem abrir cursos técnicos em mecatrônica', summary: 'A portaria autoriza três institutos federais a oferecer cursos técnicos em mecatrônica já no próximo semestre letivo. A medida vale para a rede federal e amplia as vagas disponíveis.', topics: item.temas })) };
  return new Response(JSON.stringify({ model: 'test/model', usage: { total_tokens: 120 }, choices: [{ message: { content: JSON.stringify(body) } }] }), { status: 200 });
}

describe('radar domain', () => {
  afterEach(() => { vi.restoreAllMocks(); resetRadarLiveCache(); radarStore.configure({ driver: 'memory' }); catalogStore.configure({ driver: 'memory' }); delete process.env.RADAR_EXTRA_FEEDS_JSON; });

  it('usa pesquisadores importados no catálogo acompanhado pelo Radar', async () => {
    catalogStore.configure({ driver: 'memory' });
    catalogStore.replaceCategory('researcher', [{
      id: 'r-import-1',
      nome: 'Pesquisadora Importada',
      instituicao: 'Instituto de Teste',
      pais: 'Brasil',
      areas: ['educação profissional'],
      openalex_id: 'A123',
    }], ['hash-import-1']);

    const catalog = await getTrackedResearcherCatalog();

    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'r-import-1', nome: 'Pesquisadora Importada' }),
    ]));
  });
  it('deduplicates by DOI or external identifier', () => {
    expect(dedupeRadarItems([...baseItems, { ...baseItems[0], id: 'copy' }])).toHaveLength(2);
    expect(dedupeRadarItems([{ title: 'Sem identificador', sourceName: 'Fonte' }, { title: 'Sem identificador', sourceName: 'Fonte' }])).toHaveLength(1);
    expect(dedupeRadarItems([
      { section: 'government', title: 'PORTARIA Nº 7', sourceName: 'DOE-SP', externalId: 'ato:1' },
      { section: 'government', title: 'PORTARIA Nº 7', sourceName: 'DOE-SP', externalId: 'ato:2' },
    ])).toHaveLength(2);
  });

  it('filters by section, topic and query while sorting by publication date', () => {
    const result = filterRadarItems(baseItems, { section: 'research', topic: 'IA', query: 'manufatura' });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('keeps undated items in the default window and hides them in narrow ones', () => {
    // Institutional pages often expose no parsable date. Dropping those items in
    // every window made collected results invisible with no signal at all.
    const undated = normalizeRadarItem({ id: 'c', section: 'government', title: 'Nota sem data publicada', summaryPt: 'Portal institucional', sourceName: 'Centro Paula Souza', contentType: 'notícia institucional', topics: ['EPT'], relevanceScore: 70, externalId: 'gov:c' });
    expect(undated.publishedAt).toBeNull();
    expect(undated.noveltyStatus).toBe('reference');

    const wide = filterRadarItems([...baseItems, undated], { section: 'government', period: '1y' });
    expect(wide.map((item) => item.id)).toContain('c');

    const narrow = filterRadarItems([...baseItems, undated], { section: 'government', period: '30d' });
    expect(narrow.map((item) => item.id)).not.toContain('c');
  });

  it('coleta segue e grava snapshot quando o DOU esta indisponivel', async () => {
    // A bare await on the DOU collector used to abort the entire run: no other
    // source was collected, no snapshot was written and the failure reported no
    // source at all, so it could not be attributed to anything.
    radarStore.configure({ driver: 'memory' });
    enableRadarProvider();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
      const href = String(url);
      if (href.includes('openrouter.ai')) return providerReply(request);
      if (href.includes('in.gov.br')) throw new Error('dou_connection_reset');
      if (href.includes('cps.sp.gov.br/wp-json/')) {
        return new Response(
          JSON.stringify([{ id: 1, date: '2026-07-20T12:00:00', link: 'https://www.cps.sp.gov.br/noticias/curso-tecnico', title: { rendered: 'Centro Paula Souza amplia vagas em educação profissional na indústria' }, excerpt: { rendered: '<p>Formação técnica e competências.</p>' } }]),
          { status: 200, headers: { 'content-type': 'application/json', 'x-wp-totalpages': '1' } },
        );
      }
      return new Response('', { status: 403 });
    });
    const result = await refreshRadarSnapshot();
    expect(result.refreshed).toBe(true);
    expect(result.sourceStatus.DOU.status).toBe('error');
    const stored = radarStore.getSnapshot();
    expect(stored.items.some((item) => item.sourceName === 'Centro Paula Souza')).toBe(true);
  });

  it('reporta a falha do armazenamento sem perder a execucao', async () => {
    // flush() used to be called from inside the catch block, so a failing store
    // threw a second time and the original cause escaped with no lastRun.
    radarStore.configure({ driver: 'memory' });
    enableRadarProvider();
    vi.spyOn(radarStore, 'flush').mockRejectedValue(new Error('blob_write_forbidden'));
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
      if (String(url).includes('openrouter.ai')) return providerReply(request);
      return String(url).includes('cps.sp.gov.br')
        ? new Response('<article><a href="/n/1">Centro Paula Souza amplia vagas em educacao profissional</a><p>Formacao tecnica.</p></article>', { status: 200, headers: { 'content-type': 'text/html' } })
        : new Response('', { status: 403 });
    });

    const result = await refreshRadarSnapshot();
    expect(result.lastRun).toBeTruthy();
    expect(result.sourceStatus['Snapshot (armazenamento)']).toMatchObject({ status: 'error', error: 'blob_write_forbidden' });
  });

  it('reconhece um snapshot coletado ao vivo na leitura seguinte', async () => {
    // Reading never collects, so the read's own liveProvider is always false.
    // Reporting the mode from it told every reader the content came from the
    // curated fallback, even right after a successful collection.
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({ id: 'live', section: 'research', title: 'Estudo coletado ao vivo', publishedAt: '2026-07-29', sourceName: 'OpenAlex', externalId: 'doi:live' })],
      fetchedAt: '2026-07-29T12:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: {}, live: false, persist: false });
    expect(result.liveProvider).toBe(false);
    expect(result.snapshotLive).toBe(true);
    expect(result.stale).toBe(false);
  });

  it('entrega o ato do diário oficial em português legível mesmo sem reescrita editorial', async () => {
    // Reading never calls a model, so the deterministic presentation layer is
    // all a reader gets on a GET. An act must not reach the card shouting its
    // own legal reference.
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'ato',
        section: 'government',
        title: 'PORTARIA SETEC/MEC Nº 1.234, DE 15 DE JULHO DE 2026',
        summaryPt: 'Relação com educação profissional: autoriza cursos técnicos.',
        publishedAt: '2026-07-15',
        sourceName: 'Diário Oficial da União',
        contentType: 'ato oficial',
        externalId: 'dou:ato',
      })],
      fetchedAt: '2026-07-16T12:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });

    expect(result.items[0].displayTitle).toBe('Portaria SETEC/MEC nº 1.234, de 15 de julho de 2026');
    expect(result.items[0].rawSourceText).toBe(true);
    expect(result.items[0].title).toBe('PORTARIA SETEC/MEC Nº 1.234, DE 15 DE JULHO DE 2026');
  });

  it('traduz na leitura o tipo e os temas que a fonte publicou em inglês', async () => {
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'en',
        section: 'research',
        title: 'Vocational pathways in manufacturing',
        summaryPt: 'Estudo sobre percursos de educação profissional na indústria.',
        publishedAt: '2026-07-01',
        sourceName: 'OpenAlex',
        contentType: 'journal-article',
        topics: ['TVET', 'skills development'],
        externalId: 'doi:en',
      })],
      fetchedAt: '2026-07-02T12:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: { section: 'research' }, live: false, persist: false });

    expect(result.items[0].contentType).toBe('artigo científico');
    expect(result.items[0].topics).toEqual(['educação profissional (TVET)', 'desenvolvimento de competências']);
  });

  it('não marca como obsoleto um snapshot válido só porque a leitura não coleta', async () => {
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({ id: 'live', section: 'government', title: 'Política de educação profissional', summaryPt: 'Institui cursos técnicos.', publishedAt: '2026-07-29', sourceName: 'MEC / SETEC', externalId: 'gov:live' })],
      fetchedAt: '2026-07-29T12:00:00.000Z',
      liveProvider: true,
      stale: false,
    });

    const result = await getRadarItems({ filters: {}, live: false, persist: false });

    expect(result.stale).toBe(false);
  });

  it('forca a releitura do snapshot remoto em toda leitura publica', async () => {
    // Serverless instances can stay warm after another instance writes a newer
    // Blob snapshot. A snapshot-only GET must not keep serving the first remote
    // document hydrated by that process for the rest of its lifetime.
    radarStore.configure({ driver: 'memory' });
    const hydrate = vi.spyOn(radarStore, 'hydrate').mockResolvedValue(radarStore.status());

    await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });

    expect(hydrate).toHaveBeenCalledWith({ force: true });
  });

  it('does not claim an undated institutional item belongs to the 12-month window', async () => {
    radarStore.configure({ driver: 'memory' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes('cps.sp.gov.br')) {
        return new Response(
          '<article><a href="/noticias/curso-tecnico-industria">Centro Paula Souza abre inscricoes para cursos tecnicos de EPT</a><p>Vagas em educacao profissional.</p></article>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      return new Response('', { status: 403 });
    });
    await refreshRadarSnapshot();
    const stored = radarStore.getSnapshot();
    const undated = (stored?.items || []).filter((item) => !item.publishedAt);
    expect(undated).toHaveLength(0);
  });

  it('mantém manchete datada recuperada pela API institucional do CPS', async () => {
    // "Funções e Competências" is a permanent page label, not news; it reached
    // the radar because an undated item has no recency signal to contradict it.
    radarStore.configure({ driver: 'memory' });
    enableRadarProvider();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => (String(url).includes('openrouter.ai')
      ? providerReply(request)
      : String(url).includes('cps.sp.gov.br/wp-json/')
      ? new Response(
        JSON.stringify([
          { id: 2, date: '2026-07-20T12:00:00', link: 'https://www.cps.sp.gov.br/n/2', title: { rendered: 'Centro Paula Souza abre inscricoes para cursos tecnicos de educacao profissional' }, excerpt: { rendered: '<p>Vagas abertas.</p>' } },
        ]),
        { status: 200, headers: { 'content-type': 'application/json', 'x-wp-totalpages': '1' } },
      )
      : new Response('', { status: 403 })));

    await refreshRadarSnapshot();
    const titles = (radarStore.getSnapshot()?.items || []).map((item) => item.title);
    expect(titles.some((title) => /abre inscricoes/i.test(title))).toBe(true);
  });

  it('gasta requisicao do DOU nos atos com sinal tematico, nao nos primeiros da lista', async () => {
    // An edition lists thousands of acts and only a handful concern vocational
    // education; taking them in listing order spent every request on unrelated
    // ones. The acts below are ordered so that arrival order and topical signal
    // disagree.
    radarStore.configure({ driver: 'memory' });
    const acts = Array.from({ length: 40 }, (_, index) => ({
      urlTitle: `ato-administrativo-${index}`,
      title: `Alvará de funcionamento número ${index} sem relação com o tema`,
      pubDate: '29/07/2026',
      pubName: 'DO1',
      artCategory: 'Ministério da Gestão',
    }));
    acts.push({
      urlTitle: 'portaria-educacao-profissional-2026',
      title: 'Portaria dispõe sobre a oferta de educação profissional técnica de nível médio',
      pubDate: '29/07/2026',
      pubName: 'DO1',
      artCategory: 'Ministério da Educação/Gabinete do Ministro',
    });

    const requested = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes('leiturajornal')) {
        return new Response(`<html><body><script id="params" type="application/json">${JSON.stringify({ jsonArray: acts })}</script></body></html>`, { status: 200 });
      }
      if (href.includes('/web/dou/')) {
        requested.push(href);
        return new Response('<html><body><article>Ato sobre educação profissional e aprendizagem industrial.</article></body></html>', { status: 200 });
      }
      return new Response('', { status: 403 });
    });

    const result = await fetchDouItems({ limit: 5 });
    expect(requested.some((url) => url.includes('portaria-educacao-profissional-2026'))).toBe(true);
    expect(result.diagnostics.candidates).toBeGreaterThan(result.diagnostics.shortlisted);
  });

  it('resume o DOU pelo trecho que demonstra a relação com educação profissional', async () => {
    const acts = [{
      urlTitle: 'portaria-generica-42', title: 'PORTARIA SETEC Nº 42, DE 29 DE JULHO DE 2026', pubDate: '29/07/2026', pubName: 'DO1', artCategory: 'Ministério da Educação',
    }];
    const boilerplate = `Secretaria de Educação Profissional e Tecnológica. ${Array.from({ length: 120 }, () => 'considerando disposições administrativas gerais').join(' ')}`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes('leiturajornal')) return new Response(`<script id="params" type="application/json">${JSON.stringify({ jsonArray: acts })}</script>`, { status: 200 });
      if (href.includes('/web/dou/')) return new Response(`<article>${boilerplate}. O ato institui itinerário de formação técnica e profissional integrado ao ensino médio, com oferta de cursos técnicos. Disposições finais.</article>`, { status: 200 });
      return new Response('', { status: 404 });
    });

    const result = await fetchDouItems({ limit: 5 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toMatch(/formação técnica e profissional|cursos técnicos/i);
    expect(result.items[0].provenance.originalTitle).toBe('PORTARIA SETEC Nº 42, DE 29 DE JULHO DE 2026');
    expect(result.items[0].summaryPt).toMatch(/^Relação com educação profissional:/);
    expect(result.items[0].summaryPt).toMatch(/formação técnica e profissional|cursos técnicos/i);
    expect(result.items[0].summaryPt).not.toMatch(/Secretaria de Educação Profissional e Tecnológica/i);
    expect(result.items[0].summaryPt).not.toMatch(/^considerando disposições administrativas/i);
  });

  it('descarta atos administrativos rotineiros mesmo quando o orgao pertence a EPT', async () => {
    expect(douRelevance(
      'EXTRATO DE CONTRATO',
      'Ministério da Educação. Secretaria de Educação Profissional e Tecnológica. Contratante: Instituto Federal.',
    ).eligible).toBe(false);
    expect(douRelevance(
      'PORTARIA SETEC Nº 42',
      'Institui programa de educação profissional técnica e regulamenta a oferta de cursos.',
    ).eligible).toBe(true);
    expect(douRelevance(
      'PORTARIA SETEC Nº 43',
      'Secretaria de Educação Profissional e Tecnológica. Autoriza afastamento de servidor para viagem.',
    ).eligible).toBe(false);
    expect(douRelevance(
      'PORTARIA SETEC Nº 44',
      'A Secretaria de Educação Profissional e Tecnológica autoriza o funcionamento da clínica veterinária.',
    ).eligible).toBe(false);
    expect(douRelevance(
      'EXTRATO DE DOAÇÃO',
      'Bens avaliados em trezentos e treze mil e setecentos reais. Autorizado conforme resolução regional.',
    )).toMatchObject({ direct: 0, eligible: false });
    const acts = [
      { urlTitle: 'extrato-contrato-ept', title: 'EXTRATO DE CONTRATO', pubDate: '29/07/2026', pubName: 'DO1', artCategory: 'Secretaria de Educação Profissional e Tecnológica' },
      { urlTitle: 'portaria-oferta-ept', title: 'PORTARIA SETEC Nº 42', pubDate: '29/07/2026', pubName: 'DO1', artCategory: 'Secretaria de Educação Profissional e Tecnológica' },
    ];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes('leiturajornal')) {
        return new Response(`<html><body><script id="params" type="application/json">${JSON.stringify({ jsonArray: acts })}</script></body></html>`, { status: 200 });
      }
      if (href.includes('extrato-contrato-ept')) {
        return new Response('<html><body><article>Ministério da Educação. Secretaria de Educação Profissional e Tecnológica. Contratante: Instituto Federal. Objeto: serviço administrativo continuado.</article></body></html>', { status: 200 });
      }
      if (href.includes('portaria-oferta-ept')) {
        return new Response('<html><body><article>Institui programa de educação profissional técnica e regulamenta a oferta de cursos.</article></body></html>', { status: 200 });
      }
      return new Response('', { status: 403 });
    });

    const result = await fetchDouItems({ limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].provenance.originalTitle).toBe('PORTARIA SETEC Nº 42');
  });

  it('preserva ato do DOU aprovado sobre o texto integral do ato', async () => {
    // Eligibility is decided over the full act, but only an 80-word excerpt is
    // stored. Re-deciding from the excerpt discarded acts that had legitimately
    // qualified, so the collector reported four acts and the reader saw none.
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'dou-aprovado',
        section: 'government',
        title: 'Portaria SETEC nº 42',
        summaryPt: 'Trecho do ato que nao repete o termo tematico.',
        publishedAt: '2026-07-28',
        sourceName: 'Diário Oficial da União',
        provider: 'direct-official',
        externalId: 'dou:aprovado',
        provenance: { eligibility: { version: 5, eligible: 1, direct: 2, strategic: 1 } },
      })],
      fetchedAt: '2026-07-30T00:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });
    expect(result.items.map((item) => item.id)).toContain('dou-aprovado');

    // Without the recorded decision the same excerpt is judged on its own and
    // the act disappears, which is exactly what the reader experienced.
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'dou-sem-registro',
        section: 'government',
        title: 'Despacho nº 42 do Ministério da Gestão',
        summaryPt: 'Trecho do ato que nao repete o termo tematico.',
        publishedAt: '2026-07-28',
        sourceName: 'Diário Oficial da União',
        provider: 'direct-official',
        externalId: 'dou:sem-registro',
      })],
      fetchedAt: '2026-07-30T00:00:00.000Z',
      liveProvider: true,
    });
    const legacy = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });
    expect(legacy.items.map((item) => item.id)).not.toContain('dou-sem-registro');
  });

  it('remove do snapshot o que a regra corrigida nao admitiria mais', async () => {
    // The snapshot carries items across runs, so a mistake admitted once stayed
    // visible even after the rule that let it in was fixed.
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [
        normalizeRadarItem({ id: 'dou-fora', section: 'government', title: 'Imprensa Nacional', summaryPt: 'Habilita estabelecimento para Terapia Renal Substitutiva.', publishedAt: '2026-07-24', sourceName: 'Diário Oficial da União', provider: 'direct-official', externalId: 'dou:1', provenance: { eligibility: { direct: 1, strategic: 1 } } }),
        normalizeRadarItem({ id: 'dou-dentro', section: 'government', title: 'Portaria sobre educação profissional técnica', summaryPt: 'Dispõe sobre a oferta de educação profissional.', publishedAt: '2026-07-24', sourceName: 'Diário Oficial da União', provider: 'direct-official', externalId: 'dou:2' }),
        normalizeRadarItem({ id: 'web-rotulo', section: 'government', title: 'Funções e Competências', sourceName: 'Centro Paula Souza', provider: 'institutional-web', externalId: 'web:1' }),
      ],
      fetchedAt: '2026-07-30T00:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });
    const titles = result.items.map((item) => item.title);
    expect(titles).not.toContain('Imprensa Nacional');
    expect(titles).not.toContain('Funções e Competências');
    expect(titles).not.toContain('Portaria sobre educação profissional técnica');
  });

  it('descarta decisão DOU anterior ao isolamento estrutural mesmo se o resumo parecer elegível', async () => {
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'dou-legado-contaminado',
        section: 'government',
        title: 'Despacho de encerramento de projeto energético',
        summaryPt: 'Projeto de qualificação profissional encerrado.',
        publishedAt: '2026-07-24',
        sourceName: 'Diário Oficial da União',
        provider: 'direct-official',
        externalId: 'dou:legado-contaminado',
        provenance: { eligibility: { version: 1, direct: 1, strategic: 1 } },
      })],
      fetchedAt: '2026-07-30T00:00:00.000Z',
      liveProvider: true,
    });

    const result = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });
    expect(result.items.map((item) => item.id)).not.toContain('dou-legado-contaminado');
  });

  it('schedules the federal and São Paulo institutional sources with explicit coverage contracts', () => {
    const government = RADAR_WEB_POLICY.filter((source) => source.section === 'government').map((source) => source.name);
    expect(government).toEqual(['MEC / SETEC', 'INEP', 'Centro Paula Souza', 'Secretaria da Educação de SP', 'Agência SP', 'Diário Oficial do Estado de São Paulo']);
    expect(RADAR_WEB_POLICY.filter((source) => source.section === 'government').every((source) => (source.maxPages || source.batchPages) > 0)).toBe(true);
  });

  it('normalizes unsupported sections without exposing score calculations', () => {
    const item = normalizeRadarItem({ section: 'unknown', title: 'x', relevanceScore: 120 });
    expect(item.section).toBe('research');
    expect(item).not.toHaveProperty('relevanceScore');
    expect(item).not.toHaveProperty('relevanceBreakdown');
    expect(item).not.toHaveProperty('relevanceExplanation');
    expect(normalizeRadarItem({ title: 'sem data', publishedAt: 'não é data' }).publishedAt).toBeNull();
  });

  it('marks undated hubs as references instead of news', () => {
    const item = normalizeRadarItem({ title: 'Portal permanente de EPT', sourceName: 'MEC', official: true });
    expect(item.noveltyStatus).toBe('reference');
    expect(item.isNews).toBe(false);
  });

  it('keeps curated official government items available when live sources fail', async () => {
    const result = await getRadarItems({ filters: { section: 'government' }, live: false, persist: false });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.section === 'government')).toBe(true);
    expect(result.items.some((item) => item.provider.startsWith('curated-'))).toBe(true);
  });

  it('does not expose placeholder provider labels from the curated seed', async () => {
    const result = await getRadarItems({ filters: {}, live: false, persist: false });
    expect(result.items.some((item) => item.provider === 'seed-placeholder')).toBe(false);
  });

  it('accepts only allowlisted official HTTPS feeds from configuration', () => {
    const previous = process.env.RADAR_EXTRA_FEEDS_JSON;
    process.env.RADAR_EXTRA_FEEDS_JSON = JSON.stringify([
      { name: 'OCDE', section: 'international', url: 'https://www.oecd.org/oecd.xml', official: true, geography: 'Internacional' },
      { name: 'OCDE', section: 'international', url: 'https://example.org/oecd.xml', official: true, geography: 'Internacional' },
      { name: 'Fonte desconhecida', section: 'research', url: 'https://example.org/unknown.xml', official: true },
      { name: 'OIT', section: 'international', url: 'http://insecure.example.org/oit.xml', official: true },
    ]);
    const configured = getRadarFeedPolicy();
    expect(configured).toContainEqual(expect.objectContaining({ name: 'OCDE', url: 'https://www.oecd.org/oecd.xml' }));
    expect(configured.some((feed) => feed.url === 'https://example.org/oecd.xml')).toBe(false);
    expect(configured.some((feed) => feed.name === 'Fonte desconhecida')).toBe(false);
    expect(configured.some((feed) => feed.url.startsWith('http://'))).toBe(false);
    if (previous === undefined) delete process.env.RADAR_EXTRA_FEEDS_JSON;
    else process.env.RADAR_EXTRA_FEEDS_JSON = previous;
  });

  it('advertises only sources backed by a scheduled collector', () => {
    const inactive = ['FAPESP', 'CEE-SP', 'SEADE', 'InvestSP', 'Governo do Estado de São Paulo'];
    const advertised = new Set(RADAR_SOURCE_POLICY.map((source) => source.name));
    const scheduled = new Set([...getRadarFeedPolicy(), ...RADAR_WEB_POLICY].map((source) => source.name));

    inactive.forEach((name) => {
      expect(advertised.has(name)).toBe(false);
      expect(scheduled.has(name)).toBe(false);
    });
    expect(advertised.has('INEP')).toBe(true);
    expect(advertised.has('UNESCO-UNEVOC')).toBe(true);
    expect(getRadarFeedReadiness().sections).toEqual({ research: true, government: true, international: true });
  });

  it('ingests an institutional RSS item with provenance and section', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<rss><channel><item><title>Nova política de EPT</title><link>https://example.org/noticia</link><pubDate>Thu, 16 Jul 2026 12:00:00 GMT</pubDate><description>Educação profissional e aprendizagem.</description><guid>item-1</guid></item></channel></rss>', { status: 200 })));
    const items = await fetchFeedItems({ name: 'Fonte governamental de teste', section: 'government', url: 'https://example.org/feed.xml', official: true, geography: 'Brasil' }, { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ section: 'government', sourceName: 'Fonte governamental de teste', provider: 'rss', publishedAt: '2026-07-16' });
    expect(items[0].provenance.feedUrl).toBe('https://example.org/feed.xml');
  });

  it('rejects recent institutional feed items that are not about EPT or VET', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<rss><channel><item><title>Funcionamento de restaurantes no fim de semana</title><link>https://example.org/servico</link><pubDate>Thu, 16 Jul 2026 12:00:00 GMT</pubDate><description>Confira horários e endereços das unidades.</description><guid>item-geral</guid></item></channel></rss>', { status: 200 })));

    const items = await fetchFeedItems({ name: 'Fonte pública de teste', section: 'government', url: 'https://example.org/feed-geral.xml', official: true, geography: 'Brasil' }, { limit: 5 });

    expect(items).toHaveLength(0);
  });

  it('uses the supported OpenAlex descending sort and returns recent works', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{
      id: 'https://openalex.org/W1',
      display_name: 'Vocational education for advanced manufacturing',
      publication_date: '2026-07-15',
      type: 'article',
      relevance_score: 8.2,
      authorships: [],
      topics: [{ display_name: 'Vocational education' }],
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchOpenAlexItems({ limit: 3 });

    expect(items).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('sort=publication_date%3Adesc');
    expect(fetchMock.mock.calls[0][0]).toContain('to_publication_date');
    expect(items[0]).toMatchObject({ sourceName: 'OpenAlex', publishedAt: '2026-07-15', isNews: true });
  });

  it('retries a transient OpenAlex rate limit instead of reporting a source failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{
        id: 'https://openalex.org/W2', display_name: 'Technical and vocational education policy',
        publication_date: '2026-07-14', type: 'article', authorships: [], topics: [{ display_name: 'Vocational education' }],
      }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchOpenAlexItems({ limit: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(1);
  });

  it('enriches live research items with optional AI summaries before returning the snapshot', async () => {
    enableRadarProvider();
    vi.stubGlobal('fetch', vi.fn(async (url, request) => {
      // Resumo acadêmico e reescrita editorial usam schemas diferentes na mesma
      // rota; responder o schema errado é o que o modo estrito trata como falha.
      if (String(url).includes('openrouter.ai')) return providerReply(request);
      if (String(url).includes('api.openalex.org')) {
        return new Response(JSON.stringify({ results: [{
          id: 'https://openalex.org/W-ai',
          display_name: 'Vocational education for advanced manufacturing',
          publication_date: '2026-07-15',
          type: 'article',
          relevance_score: 8.2,
          authorships: [],
          topics: [{ display_name: 'Vocational education' }],
          abstract_inverted_index: {
            This: [0], study: [1], compares: [2], vocational: [3], education: [4], pathways: [5],
            for: [6], advanced: [7], manufacturing: [8], and: [9], employer: [10], participation: [11],
          },
        }] }), { status: 200 });
      }
      if (String(url).includes('api.crossref.org')) {
        return new Response(JSON.stringify({ message: { items: [] } }), { status: 200 });
      }
      return new Response('<rss><channel></channel></rss>', { status: 200 });
    }));

    const result = await getRadarItems({ filters: { section: 'research' }, live: true, persist: false });
    const enriched = result.items.find((item) => item.externalId === 'https://openalex.org/W-ai');

    expect(enriched).toMatchObject({
      summaryStatus: 'ai',
      summaryProvenance: { provider: 'openrouter', model: 'test/model' },
    });
  });

  it('retrieves OECD VET publications through public DOI metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { items: [{
      DOI: '10.1787/example',
      title: ['Developing Vocational Education and Training with Artificial Intelligence'],
      URL: 'https://doi.org/10.1787/example',
      publisher: 'OECD Publishing',
      published: { 'date-parts': [[2026, 6, 23]] },
      type: 'book',
      author: [{ given: 'OECD', family: 'Publishing' }],
    }] } }), { status: 200 })));

    const items = await fetchOecdItems({ limit: 3 });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ section: 'international', sourceName: 'OCDE', publishedAt: '2026-06-23', isNews: true });
  });

  it('retries a transient OECD metadata rate limit', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: [], 'total-results': 0 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchOecdItems({ limit: 3 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(items.coverage).toMatchObject({ complete: true });
  });

  it('ingests allowlisted institutional HTML pages without accepting external links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><article><a href="/noticia-ept">Nova política de educação profissional</a><time datetime="2026-07-16"></time><p>Atualização sobre formação técnica e competências.</p></article><article><a href="https://external.example/noticia">Link externo irrelevante</a></article></html>', { status: 200 })));
    const items = await fetchWebItems({ name: 'INEP', section: 'government', url: 'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/', official: true, geography: 'Brasil' }, { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceName: 'INEP', provider: 'institutional-paginated', publishedAt: '2026-07-16', section: 'government' });
    expect(items[0].sourceUrl).toBe('https://www.gov.br/noticia-ept');
    expect(items[0].provenance.pageUrl).toContain('inep');
  });

  it('refreshes and exposes a last valid snapshot with source observability', async () => {
    enableRadarProvider();
    vi.stubGlobal('fetch', vi.fn((url, request) => {
      if (String(url).includes('openrouter.ai')) return Promise.resolve(providerReply(request));
      if (String(url).includes('api.openalex.org')) return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
      if (String(url).includes('api.crossref.org')) return Promise.resolve(new Response(JSON.stringify({ message: { items: [] } }), { status: 200 }));
      return Promise.resolve(new Response('<rss><channel><item><title>Atualização VET</title><link>https://example.org/vet</link><pubDate>Thu, 16 Jul 2026 12:00:00 GMT</pubDate><description>Educação profissional.</description><guid>vet-1</guid></item></channel></rss>', { status: 200 }));
    }));
    const result = await refreshRadarSnapshot();
    expect(result.refreshed).toBe(true);
    expect(result.lastRun.status).toBe('ok');
    expect(getRadarStoreStatus().snapshot.itemCount).toBeGreaterThan(0);
    expect(Object.values(result.sourceStatus).some((source) => source.status === 'ok')).toBe(true);
  });

  it('records a reachable DOU window without eligible acts as no_edition', async () => {
    enableRadarProvider();
    vi.stubGlobal('fetch', vi.fn(async (url, request) => (String(url).includes('openrouter.ai')
      ? providerReply(request)
      : new Response('<html><body></body></html>', { status: 200 }))));

    const result = await getRadarItems({ filters: { section: 'government' }, live: true, persist: false });

    expect(result.liveProvider).toBe(true);
    expect(result.sourceStatus.DOU).toMatchObject({
      status: 'no_edition',
      count: 0,
      provider: 'direct-official',
    });
  });

  it('does not spend the academic-summary budget on a government-only refresh', async () => {
    enableRadarProvider();
    const fetchMock = vi.fn(async (url, request) => (String(url).includes('openrouter.ai')
      ? providerReply(request)
      : new Response('<html><body></body></html>', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    await getRadarItems({ filters: { section: 'government' }, live: true, persist: false });

    // The editorial pass may legitimately call the provider on this run — it is
    // what rewrites official acts. The academic summariser must not: it has its
    // own budget and no research item was collected.
    const summaryCalls = fetchMock.mock.calls.filter(([url, request]) => String(url).includes('openrouter.ai')
      && JSON.parse(request.body).response_format?.json_schema?.name === 'radar_research_summaries');
    expect(summaryCalls).toHaveLength(0);
  });

  it('reescreve o snapshot guardado sem consultar nenhuma fonte', async () => {
    // Collection spends the whole function budget before the editorial pass gets
    // a turn, so on a platform whose limit is close to the collection's own
    // duration the rewrites never run. This path exists to be run on its own.
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.OPENROUTER_MODEL = 'test/model';
    process.env.RADAR_EDITORIAL_PROVIDER = 'openrouter';
    radarStore.configure({ driver: 'memory' });
    radarStore.writeSnapshot({
      items: [normalizeRadarItem({
        id: 'ato', section: 'government', title: 'PORTARIA Nº 1, DE 2 DE JANEIRO DE 2026',
        summaryPt: 'Relação com educação profissional: autoriza cursos técnicos.',
        publishedAt: '2026-01-02', sourceName: 'Diário Oficial da União', contentType: 'ato oficial', externalId: 'dou:ato',
      })],
      fetchedAt: '2026-01-03T12:00:00.000Z',
      sourceStatus: { DOU: { name: 'Diário Oficial da União', status: 'ok', count: 1 } },
      liveProvider: true,
    });
    const fetchMock = vi.fn(async (_url, request) => {
      const requested = JSON.parse(JSON.parse(request.body).messages.at(-1).content);
      return {
        ok: true,
        json: async () => ({
          model: 'test/model',
          usage: { total_tokens: 200 },
          choices: [{ message: { content: JSON.stringify({ items: requested.map((item) => ({ id: item.id, title: 'Institutos federais podem abrir cursos técnicos em mecatrônica', summary: 'A portaria autoriza três institutos federais a oferecer cursos técnicos em mecatrônica já no próximo semestre letivo.', topics: item.temas })) }) } }],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshRadarEditorials();

    // Every request went to the model; no collector was touched.
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('openrouter.ai'))).toBe(true);
    expect(result).toMatchObject({ refreshed: true, remaining: 0 });
    expect(result.stats).toMatchObject({ rewritten: 1, candidates: 1 });
    // The collection date belongs to the collection; a rewrite must not claim it.
    expect(radarStore.getSnapshot().fetchedAt).toBe('2026-01-03T12:00:00.000Z');
    expect(radarStore.getSnapshot().items[0].displayTitle).toBe('Institutos federais podem abrir cursos técnicos em mecatrônica');
    expect(radarStore.getSnapshot().sourceStatus.DOU).toMatchObject({ count: 1 });
  });

  it('não reescreve nada quando não há snapshot guardado', async () => {
    radarStore.configure({ driver: 'memory' });
    vi.stubGlobal('fetch', vi.fn());

    const result = await refreshRadarEditorials();

    expect(result).toMatchObject({ refreshed: false, error: 'empty_snapshot' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('derruba o run quando há fila de reescrita e a IA não está configurada', async () => {
    // Antes isto era um run bem-sucedido com todo item exibindo o texto cru da
    // fonte — indistinguível de um run que não tinha o que reescrever. Agora a
    // coleta falha e diz por quê, em vez de entregar conteúdo degradado.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><body></body></html>', { status: 200 })));

    await expect(getRadarItems({ filters: { section: 'government' }, live: true, persist: false }))
      .rejects.toThrow('radar_editorial_provider_disabled');
  });

  it('serves the last snapshot when every live source fails', async () => {
    enableRadarProvider();
    vi.stubGlobal('fetch', vi.fn((url, request) => {
      if (String(url).includes('openrouter.ai')) return Promise.resolve(providerReply(request));
      if (String(url).includes('api.openalex.org')) return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
      if (String(url).includes('api.crossref.org')) return Promise.resolve(new Response(JSON.stringify({ message: { items: [] } }), { status: 200 }));
      return Promise.resolve(new Response('<rss><channel><item><title>Snapshot de VET</title><link>https://example.org/snapshot</link><pubDate>Thu, 16 Jul 2026 12:00:00 GMT</pubDate></item></channel></rss>', { status: 200 }));
    }));
    await refreshRadarSnapshot();
    resetRadarLiveCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network_down')));
    const result = await getRadarItems({ live: true });
    expect(result.stale).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.lastRun.status).toBe('stale');
  });
});
