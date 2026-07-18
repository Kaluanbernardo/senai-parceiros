import { describe, expect, it } from 'vitest';
import { buildDouEditionUrls, formatBrazilDate, isDouUrl, normalizeHttpsUrl, validateOfficialUrl } from './urlPolicy.js';

describe('Radar official URL policy', () => {
  it('accepts official HTTPS domains and rejects credentials, ports and HTTP', () => {
    expect(normalizeHttpsUrl('https://www.gov.br/mec/noticia')).toBe('https://www.gov.br/mec/noticia');
    expect(validateOfficialUrl('http://www.gov.br/mec/noticia').ok).toBe(false);
    expect(validateOfficialUrl('https://user:secret@www.gov.br/mec').ok).toBe(false);
    expect(validateOfficialUrl('https://example.org/noticia').ok).toBe(false);
  });

  it('recognizes only DOU edition/article URLs', () => {
    expect(isDouUrl('https://www.in.gov.br/leiturajornal?data=17-07-2026&secao=DO1')).toBe(true);
    expect(isDouUrl('https://www.in.gov.br/web/dou/-/portaria-123', { article: true })).toBe(true);
    expect(isDouUrl('https://example.org/web/dou/-/portaria-123', { article: true })).toBe(false);
  });

  it('builds one official edition URL per date and allowed section', () => {
    const urls = buildDouEditionUrls({ startDate: '2026-07-16', endDate: '2026-07-17', sections: ['DO1', 'DO3', 'DO2'] });
    expect(urls).toHaveLength(4);
    expect(urls[0]).toContain('data=16-07-2026');
    expect(urls[0]).toContain('secao=DO1');
    expect(urls.some((url) => url.includes('DO2'))).toBe(false);
    expect(formatBrazilDate('2026-07-17')).toBe('17-07-2026');
  });

  it('uses São Paulo date for Date objects near UTC midnight', () => {
    const urls = buildDouEditionUrls({
      startDate: new Date('2026-07-18T01:30:00.000Z'),
      endDate: new Date('2026-07-18T01:30:00.000Z'),
      sections: ['DO1'],
    });
    expect(urls[0]).toContain('data=17-07-2026');
  });
});
