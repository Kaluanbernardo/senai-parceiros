import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateRadarRelevance, dedupeRadarItems, fetchFeedItems, fetchOecdItems, fetchOpenAlexItems, fetchWebItems, filterRadarItems, normalizeRadarItem, refreshRadarSnapshot, getRadarFeedPolicy, getRadarItems, getRadarStoreStatus, resetRadarLiveCache } from './radar.js';
import { radarStore } from './radarStore.js';

const baseItems = [
  normalizeRadarItem({ id: 'a', section: 'research', title: 'IA na indústria', summaryPt: 'Competências para manufatura', publishedAt: '2026-07-10', sourceName: 'OpenAlex', contentType: 'artigo', topics: ['IA', 'indústria'], relevanceScore: 90, externalId: 'doi:a' }),
  normalizeRadarItem({ id: 'b', section: 'government', title: 'Política de EPT', summaryPt: 'MEC', publishedAt: '2026-06-10', sourceName: 'MEC / SETEC', contentType: 'notícia oficial', topics: ['EPT'], relevanceScore: 80, externalId: 'gov:b' }),
];

describe('radar domain', () => {
  afterEach(() => { vi.restoreAllMocks(); resetRadarLiveCache(); radarStore.configure({ driver: 'memory' }); delete process.env.RADAR_EXTRA_FEEDS_JSON; });
  it('deduplicates by DOI or external identifier', () => {
    expect(dedupeRadarItems([...baseItems, { ...baseItems[0], id: 'copy' }])).toHaveLength(2);
    expect(dedupeRadarItems([{ title: 'Sem identificador', sourceName: 'Fonte' }, { title: 'Sem identificador', sourceName: 'Fonte' }])).toHaveLength(1);
  });

  it('filters by section, topic and query while sorting by relevance', () => {
    const result = filterRadarItems(baseItems, { section: 'research', topic: 'IA', query: 'manufatura', sort: 'relevance' });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('normalizes unsupported sections and scores safely', () => {
    const item = normalizeRadarItem({ section: 'unknown', title: 'x', relevanceScore: 120 });
    expect(item.section).toBe('research');
    expect(item.relevanceScore).toBe(15);
    expect(item.relevanceScore).toBe(item.relevanceBreakdown.thematic + item.relevanceBreakdown.recency + item.relevanceBreakdown.sourceQuality);
    expect(normalizeRadarItem({ title: 'sem data', publishedAt: 'não é data' }).publishedAt).toBeNull();
  });

  it('explains relevance as theme, recency and source quality', () => {
    const result = calculateRadarRelevance({
      title: 'Nova política de educação profissional para a indústria',
      summaryPt: 'Formação técnica, competências digitais e aprendizagem industrial.',
      publishedAt: '2026-07-10',
      provider: 'institutional-web',
      official: true,
    }, { now: new Date('2026-07-17T12:00:00Z') });

    expect(result.score).toBe(result.breakdown.thematic + result.breakdown.recency + result.breakdown.sourceQuality);
    expect(result.breakdown).toEqual(expect.objectContaining({ thematic: expect.any(Number), recency: 30, sourceQuality: 20 }));
    expect(result.explanation).toMatch(/tema|recência|fonte/i);
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

  it('ingests allowlisted institutional HTML pages without accepting external links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html><article><a href="/noticia-ept">Nova política de educação profissional</a><time datetime="2026-07-16"></time><p>Atualização sobre formação técnica e competências.</p></article><article><a href="https://external.example/noticia">Link externo irrelevante</a></article></html>', { status: 200 })));
    const items = await fetchWebItems({ name: 'INEP', section: 'government', url: 'https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/', official: true, geography: 'Brasil' }, { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sourceName: 'INEP', provider: 'institutional-web', publishedAt: '2026-07-16', section: 'government' });
    expect(items[0].sourceUrl).toBe('https://www.gov.br/noticia-ept');
    expect(items[0].provenance.pageUrl).toContain('inep');
  });

  it('refreshes and exposes a last valid snapshot with source observability', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
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

  it('serves the last snapshot when every live source fails', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
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
