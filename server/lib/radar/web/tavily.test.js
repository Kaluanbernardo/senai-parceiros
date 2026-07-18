import { describe, expect, it, vi } from 'vitest';
import { TavilyWebProvider } from './tavily.js';

describe('TavilyWebProvider', () => {
  it('is server-only and does not call the network without a key', async () => {
    const fetchImpl = vi.fn();
    const provider = new TavilyWebProvider({ apiKey: '', fetchImpl });
    const result = await provider.discover({ query: 'educação profissional' });
    expect(result.status).toBe('error');
    expect(result.errors[0].error).toBe('tavily_not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('restricts search results to official domains and sends no synthetic answer request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { title: 'Notícia oficial sobre EPT', url: 'https://www.gov.br/mec/pt-br/noticias/ept', content: 'Formação técnica atualizada.', published_date: '2026-07-17' },
        { title: 'Fora da política', url: 'https://example.org/noticia', content: 'não aceitar' },
      ],
    }), { status: 200 }));
    const provider = new TavilyWebProvider({ apiKey: 'test-key', fetchImpl, allowedDomains: ['gov.br'] });
    const result = await provider.discover({ query: 'educação profissional', domains: ['gov.br'], maxResults: 5 });
    expect(result.status).toBe('ok');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ official: true, provider: 'tavily', publishedAt: '2026-07-17' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.include_domains).toEqual(['gov.br']);
    expect(body.include_answer).toBe(false);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key');
  });

  it('extracts only validated HTTPS URLs and reports rejected URLs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ url: 'https://www.gov.br/mec/noticia', title: 'Notícia', raw_content: 'Conteúdo oficial.' }],
    }), { status: 200 }));
    const provider = new TavilyWebProvider({ apiKey: 'test-key', fetchImpl, allowedDomains: ['gov.br'] });
    const result = await provider.retrieve({ urls: ['https://www.gov.br/mec/noticia', 'http://www.gov.br/insecure', 'https://example.org/nope'] });
    expect(result.status).toBe('partial');
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].content).toBe('Conteúdo oficial.');
    expect(result.errors).toEqual(expect.arrayContaining([
      { url: 'http://www.gov.br/insecure', error: 'url_not_allowed' },
      { url: 'https://example.org/nope', error: 'url_not_allowed' },
    ]));
    expect(fetchImpl.mock.calls[0][0]).toContain('/extract');
  });

  it('restricts a DOU fallback to DOU article paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const provider = new TavilyWebProvider({ apiKey: 'test-key', fetchImpl, allowedDomains: ['in.gov.br'] });
    const result = await provider.retrieve({ urls: ['https://www.in.gov.br/web/dou/-/ato-123', 'https://www.in.gov.br/noticia-geral'] });
    expect(result.errors).toContainEqual({ url: 'https://www.in.gov.br/noticia-geral', error: 'url_not_allowed' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.urls).toEqual(['https://www.in.gov.br/web/dou/-/ato-123']);
  });
});
