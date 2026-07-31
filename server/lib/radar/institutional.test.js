import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectDoeSpSource, collectIloSitemapSource, collectPaginatedInstitutionalSource, collectWordPressSource, semanticEvidence } from './institutional.js';

describe('institutional Radar collectors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('walks pagination until the 12-month boundary and exposes complete coverage', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const page = Number(new URL(url).searchParams.get('page') || 0);
      const html = page === 0
        ? '<article><a href="/news/one">New apprenticeship policy for advanced manufacturing</a><time datetime="2026-06-02"></time><p>Vocational education and training policy.</p></article>'
        : '<article><a href="/news/old">Old vocational education report</a><time datetime="2025-06-01"></time><p>Technical and vocational education.</p></article>';
      return new Response(html, { status: 200 });
    }));

    const result = await collectPaginatedInstitutionalSource({
      name: 'Cedefop', section: 'international', url: 'https://example.org/news', official: true,
      geography: 'Internacional', pageParam: 'page', maxPages: 8,
    }, { now: new Date('2026-07-31T12:00:00Z') });

    expect(result.items).toHaveLength(1);
    expect(result.coverage).toMatchObject({ pagesRead: 2, complete: true, reason: 'window_boundary' });
  });

  it('does not label an unrelated publication as EPT merely because it came from an official source', () => {
    expect(semanticEvidence('Hospital recebe novos equipamentos', 'Terapia renal e atendimento clínico.')).toMatchObject({ eligible: false });
    expect(semanticEvidence('Novos cursos técnicos', 'Educação profissional para a indústria paulista.')).toMatchObject({ eligible: true });
    expect(semanticEvidence('Government will vet applications', 'Applications undergo review.')).toMatchObject({ eligible: false });
  });

  it('marks coverage partial when a source reaches its page cap before the cutoff', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<article><a href="/news/recent">Formação profissional e indústria</a><time datetime="2026-05-01"></time></article>', { status: 200 })));

    const result = await collectPaginatedInstitutionalSource({
      name: 'MEC / SETEC', section: 'government', url: 'https://example.org/noticias', official: true,
      geography: 'Brasil', pageParam: 'page', maxPages: 2,
    }, { now: new Date('2026-07-31T12:00:00Z') });

    expect(result.items).toHaveLength(1);
    expect(result.coverage).toMatchObject({ pagesRead: 2, complete: false, reason: 'page_cap' });
  });

  it('extracts an ILO card without mistaking nested card classes for card boundaries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <div class="ilo--card ilo--card__type__feature">
        <a class="ilo--card--link" href="https://www.ilo.org/resource/news/vocational-skills">Vocational skills expand youth employment</a>
        <div class="ilo--card--wrap">
          <img class="ilo--card--image" src="/image.webp">
          <div class="ilo--card--content">
            <p class="ilo--card--title">Vocational skills expand youth employment</p>
            <time class="ilo--card--date" datetime="1785499200">31 July 2026</time>
          </div>
        </div>
      </div>
    `, { status: 200 })));

    const result = await collectPaginatedInstitutionalSource({
      name: 'OIT', section: 'international', url: 'https://www.ilo.org/resource/news', official: true,
      geography: 'Internacional', singlePageComplete: true,
    }, { now: new Date('2026-07-31T12:00:00Z') });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: 'Vocational skills expand youth employment', publishedAt: '2026-07-31' });
  });

  it('continues an incremental source from the prior page cursor', async () => {
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      requests.push(Number(new URL(url).searchParams.get('page')));
      return new Response('<article><a href="/news/recent">FormaÃ§Ã£o profissional para jovens</a><time datetime="2026-05-01"></time></article>', { status: 200 });
    }));

    const result = await collectPaginatedInstitutionalSource({
      name: 'MEC / SETEC', section: 'government', url: 'https://example.org/noticias', official: true,
      geography: 'Brasil', pageParam: 'page', maxPages: 10, incremental: true,
    }, { now: new Date('2026-07-31T12:00:00Z'), maxPages: 2, previousCoverage: { nextPage: 2 } });

    expect(requests).toEqual([2, 3]);
    expect(result.coverage).toMatchObject({ pagesRead: 2, nextPage: 4, complete: false, reason: 'page_batch' });
  });

  it('keeps completed incremental coverage complete while refreshing its newest pages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<article><a href="/news/recent">Formação profissional para jovens</a><time datetime="2026-05-01"></time></article>', { status: 200 })));
    const result = await collectPaginatedInstitutionalSource({
      name: 'MEC / SETEC', section: 'government', url: 'https://example.org/noticias', official: true,
      geography: 'Brasil', pageParam: 'page', maxPages: 10, incremental: true,
    }, { now: new Date('2026-07-31T12:00:00Z'), maxPages: 2, previousCoverage: { complete: true, nextPage: null } });

    expect(result.coverage).toMatchObject({ complete: true, nextPage: null, reason: 'head_refresh' });
  });

  it('preserves a colon in Plone pagination parameter names', async () => {
    let requestedUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      requestedUrl = String(url);
      return new Response('<article><a href="/news/recent">FormaÃ§Ã£o profissional para jovens</a><time datetime="2026-05-01"></time></article>', { status: 200 });
    }));

    await collectPaginatedInstitutionalSource({
      name: 'MEC / SETEC', section: 'government', url: 'https://example.org/noticias', official: true,
      geography: 'Brasil', pageParam: 'b_start:int', pageStep: 15, includeFirstPageParam: true, maxPages: 1,
    }, { now: new Date('2026-07-31T12:00:00Z') });

    expect(requestedUrl).toContain('?b_start:int=0');
  });

  it('uses the public WordPress API to retrieve the whole requested year without scraping rendered cards', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const page = Number(new URL(url).searchParams.get('page'));
      const body = page === 1
        ? [{ id: 1, date: '2026-06-01T12:00:00', link: 'https://example.org/etec', title: { rendered: 'Etec amplia cursos técnicos' }, excerpt: { rendered: '<p>Educação profissional em São Paulo.</p>' } }]
        : [{ id: 2, date: '2025-09-01T12:00:00', link: 'https://example.org/fatec', title: { rendered: 'Fatec abre novas formações' }, excerpt: { rendered: '<p>Formação técnica e profissional.</p>' } }];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'x-wp-totalpages': '2' } });
    }));

    const result = await collectWordPressSource({ name: 'Centro Paula Souza', section: 'government', url: 'https://example.org/noticias/', official: true, geography: 'São Paulo', explicitTopic: true, topicLabel: 'EPT' }, { now: new Date('2026-07-31T12:00:00Z') });

    expect(result.items).toHaveLength(2);
    expect(result.coverage).toMatchObject({ pagesRead: 2, totalPages: 2, complete: true });
  });

  it('walks DOE-SP results backwards from the newest page and exposes its annual cursor', async () => {
    const requested = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const page = Number(new URL(url).searchParams.get('PageNumber'));
      requested.push(page);
      const item = page === 3
        ? { id: 'new', date: '2026-07-20T10:00:00', title: 'PORTARIA Nº 7', excerpt: 'Autoriza curso técnico em administração.', hierarchy: 'Poder Executivo > Educação', slug: '/executivo/portaria-7' }
        : page === 2
          ? { id: 'noise', date: '2026-01-10T10:00:00', title: 'EXTRATO DE CONTRATO', excerpt: 'Aquisição de material para curso técnico.', hierarchy: 'Licitações', slug: '/executivo/contrato' }
          : { id: 'old', date: '2025-08-01T10:00:00', title: 'COMUNICADO GERAL', excerpt: 'Sem conteúdo educacional.', hierarchy: 'Administração', slug: '/executivo/comunicado' };
      return new Response(JSON.stringify({ items: [item], totalPages: 3 }), { status: 200 });
    }));

    const result = await collectDoeSpSource({
      name: 'Diário Oficial do Estado de São Paulo', section: 'government', url: 'https://www.doe.sp.gov.br/',
      apiUrl: 'https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications', official: true,
      geography: 'São Paulo', terms: ['educação profissional', 'curso técnico'], batchPages: 2,
    }, { now: new Date('2026-07-31T12:00:00Z'), maxPages: 2 });

    expect(requested).toEqual([1, 3, 2]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: 'PORTARIA Nº 7', sourceName: 'Diário Oficial do Estado de São Paulo' });
    expect(result.coverage).toMatchObject({ totalPages: 3, complete: false, nextPage: 1, reason: 'page_batch' });
  });

  it('uses the official ILO sitemap as a historical index and advances candidate batches', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const value = String(url);
      if (value === 'https://www.ilo.org/sitemap.xml') {
        return new Response('<sitemapindex><sitemap><loc>https://www.ilo.org/sitemap.xml?page=89</loc></sitemap><sitemap><loc>https://www.ilo.org/sitemap.xml?page=90</loc></sitemap></sitemapindex>', { status: 200 });
      }
      if (value.includes('sitemap.xml?page=')) {
        const suffix = value.endsWith('90') ? 'vocational-skills-for-youth' : 'unrelated-labour-news';
        return new Response(`<urlset><url><loc>https://www.ilo.org/resource/news/${suffix}</loc><lastmod>2026-06-10T09:00:00+00:00</lastmod></url></urlset>`, { status: 200 });
      }
      return new Response('<html><head><meta property="og:title" content="Vocational skills for youth"><meta name="description" content="A new technical and vocational education programme."></head><body><time datetime="2026-06-08"></time></body></html>', { status: 200 });
    }));

    const result = await collectIloSitemapSource({
      name: 'OIT', section: 'international', url: 'https://www.ilo.org/resource/news', official: true,
      geography: 'Internacional', sitemapUrl: 'https://www.ilo.org/sitemap.xml', sitemapTailPages: 2,
    }, { now: new Date('2026-07-31T12:00:00Z'), maxDocuments: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: 'Vocational skills for youth', publishedAt: '2026-06-08' });
    expect(result.coverage).toMatchObject({ sitemapPages: 2, candidates: 2, retrieved: 1, candidateOffset: 1, complete: false, reason: 'candidate_batch' });
  });

  it('does not advance the DOE-SP cursor over a failed page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const page = Number(new URL(url).searchParams.get('PageNumber'));
      if (page === 3) throw new Error('temporary failure');
      return new Response(JSON.stringify({ items: [], totalPages: 3 }), { status: 200 });
    }));
    const result = await collectDoeSpSource({
      name: 'DOE-SP', section: 'government', url: 'https://www.doe.sp.gov.br/', official: true,
      geography: 'São Paulo', terms: ['curso técnico'], batchPages: 2,
    }, { now: new Date('2026-07-31T12:00:00Z'), maxPages: 2 });
    expect(result.coverage).toMatchObject({ complete: false, nextPage: 3, reason: 'request_failed' });
  });
});
