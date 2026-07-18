import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { DirectOfficialWebProvider } from './directOfficial.js';

const editionHtml = await readFile(new URL('../fixtures/dou-edition.html', import.meta.url), 'utf8');
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

