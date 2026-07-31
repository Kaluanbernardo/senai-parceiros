import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectTrackedResearcherStudies } from './researchers.js';

describe('collectTrackedResearcherStudies', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves every catalog researcher to an OpenAlex author id and retrieves their complete 12-month works window in batched pages', async () => {
    const catalog = [
      { id: 1, nome: 'Ana Técnica', instituicao: 'Instituto Federal', pais: 'Brasil' },
      { id: 2, nome: 'John Skills', instituicao: 'University of London', pais: 'Reino Unido' },
    ];
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url));
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/authors')) {
        const name = parsed.searchParams.get('search');
        const author = name === 'Ana Técnica'
          ? { id: 'https://openalex.org/A1', display_name: 'Ana Técnica', affiliations: [{ institution: { display_name: 'Instituto Federal', country_code: 'BR' } }] }
          : { id: 'https://openalex.org/A2', display_name: 'John Skills', affiliations: [{ institution: { display_name: 'University of London', country_code: 'GB' } }] };
        return new Response(JSON.stringify({ results: [author] }), { status: 200 });
      }
      const cursor = parsed.searchParams.get('cursor');
      const results = cursor === '*'
        ? [{ id: 'https://openalex.org/W1', display_name: 'A recent study outside the EPT vocabulary', publication_date: '2026-05-02', type: 'article', authorships: [{ author: { id: 'https://openalex.org/A1', display_name: 'Ana Técnica' }, institutions: [] }], topics: [] }]
        : [{ id: 'https://openalex.org/W2', display_name: 'Recent skills systems study', publication_date: '2026-04-01', type: 'report', authorships: [{ author: { id: 'https://openalex.org/A2', display_name: 'John Skills' }, institutions: [{ display_name: 'University of London' }] }], topics: [] }];
      return new Response(JSON.stringify({ results, meta: { next_cursor: cursor === '*' ? 'next-page' : null } }), { status: 200 });
    }));

    const result = await collectTrackedResearcherStudies({ catalog, now: new Date('2026-07-31T12:00:00Z') });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.provenance.trackedResearchers).sort()).toEqual([['Ana Técnica'], ['John Skills']]);
    expect(result.coverage).toMatchObject({ catalogTotal: 2, authorsResolved: 2, authorsUnresolved: 0, pagesRead: 2, complete: true });
    const worksCall = calls.find((url) => url.includes('/works?'));
    const authorFilter = new URL(worksCall).searchParams.get('filter').split(',')[0];
    expect(new Set(authorFilter.replace('authorships.author.id:', '').split('|'))).toEqual(new Set(['A1', 'A2']));
    expect(worksCall).toContain('from_publication_date%3A2025-07-31');
  });

  it('reports unresolved identities instead of silently claiming complete coverage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })));

    const result = await collectTrackedResearcherStudies({
      catalog: [{ id: 1, nome: 'Pessoa Sem Correspondência', instituicao: 'Instituição X', pais: 'Brasil' }],
      now: new Date('2026-07-31T12:00:00Z'),
    });

    expect(result.items).toEqual([]);
    expect(result.coverage).toMatchObject({ catalogTotal: 1, authorsResolved: 0, authorsUnresolved: 1, complete: false, reason: 'unresolved_authors' });
  });

  it('rotates identity attempts past unresolved researchers on subsequent collections', async () => {
    const searched = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/authors') && parsed.searchParams.has('search')) searched.push(parsed.searchParams.get('search'));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }));
    const catalog = [1, 2, 3].map((id) => ({ id, nome: `Pessoa ${id}`, instituicao: 'Instituição X', pais: 'Brasil' }));

    const first = await collectTrackedResearcherStudies({ catalog, resolutionBudget: 1, resolutionCursor: 0 });
    const second = await collectTrackedResearcherStudies({ catalog, resolutionBudget: 1, resolutionCursor: first.coverage.resolutionCursor });

    expect(searched).toEqual(['Pessoa 1', 'Pessoa 2']);
    expect(second.coverage.resolutionCursor).toBe(2);
  });

  it('persists the OpenAlex works cursor so a capped run resumes on the next page', async () => {
    const catalog = [{ id: 1, nome: 'Ana Técnica', instituicao: 'Instituto Federal', pais: 'Brasil' }];
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url));
      const cursor = new URL(url).searchParams.get('cursor');
      const work = { id: `https://openalex.org/W-${cursor}`, display_name: 'Estudo recente', publication_date: '2026-05-02', type: 'article', authorships: [{ author: { id: 'https://openalex.org/A1', display_name: 'Ana Técnica' }, institutions: [] }], topics: [] };
      return new Response(JSON.stringify({ results: [work], meta: { next_cursor: cursor === '*' ? 'resume-me' : null } }), { status: 200 });
    }));

    const first = await collectTrackedResearcherStudies({ catalog, knownResolutions: [{ catalogId: 1, openAlexId: 'A1' }], maxPages: 1 });
    const second = await collectTrackedResearcherStudies({ catalog, knownResolutions: first.coverage.resolvedAuthorMap, worksCursor: first.coverage.worksCursor, worksCursorAuthorIds: first.coverage.worksCursorAuthorIds, maxPages: 1 });

    expect(first.coverage).toMatchObject({ worksCursor: 'resume-me', complete: false, reason: 'page_cap' });
    expect(new URL(calls.at(-1)).searchParams.get('cursor')).toBe('resume-me');
    expect(second.coverage).toMatchObject({ worksCursor: null, complete: true, reason: 'source_exhausted' });
  });
});
