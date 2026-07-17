import { afterEach, describe, expect, it, vi } from 'vitest';
import { dedupeRadarItems, fetchFeedItems, filterRadarItems, normalizeRadarItem, refreshRadarSnapshot, getRadarFeedPolicy, getRadarItems, getRadarStoreStatus, resetRadarLiveCache } from './radar.js';
import { radarStore } from './radarStore.js';

const baseItems = [
  normalizeRadarItem({ id: 'a', section: 'research', title: 'IA na indústria', summaryPt: 'Competências para manufatura', publishedAt: '2026-07-10', sourceName: 'OpenAlex', contentType: 'artigo', topics: ['IA', 'indústria'], relevanceScore: 90, externalId: 'doi:a' }),
  normalizeRadarItem({ id: 'b', section: 'government', title: 'Política de EPT', summaryPt: 'MEC', publishedAt: '2026-06-10', sourceName: 'MEC / SETEC', contentType: 'notícia oficial', topics: ['EPT'], relevanceScore: 80, externalId: 'gov:b' }),
];

describe('radar domain', () => {
  afterEach(() => { vi.restoreAllMocks(); radarStore.configure({ driver: 'memory' }); });
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
    expect(item.relevanceScore).toBe(100);
    expect(normalizeRadarItem({ title: 'sem data', publishedAt: 'não é data' }).publishedAt).toBeNull();
  });

  it('accepts only allowlisted official HTTPS feeds from configuration', () => {
    const previous = process.env.RADAR_EXTRA_FEEDS_JSON;
    process.env.RADAR_EXTRA_FEEDS_JSON = JSON.stringify([
      { name: 'OCDE', section: 'international', url: 'https://example.org/oecd.xml', official: true, geography: 'Internacional' },
      { name: 'Fonte desconhecida', section: 'research', url: 'https://example.org/unknown.xml', official: true },
      { name: 'OIT', section: 'international', url: 'http://insecure.example.org/oit.xml', official: true },
    ]);
    const configured = getRadarFeedPolicy();
    expect(configured).toContainEqual(expect.objectContaining({ name: 'OCDE', url: 'https://example.org/oecd.xml' }));
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
