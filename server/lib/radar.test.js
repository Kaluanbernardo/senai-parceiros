import { describe, expect, it } from 'vitest';
import { dedupeRadarItems, filterRadarItems, normalizeRadarItem } from './radar.js';

const baseItems = [
  normalizeRadarItem({ id: 'a', section: 'research', title: 'IA na indústria', summaryPt: 'Competências para manufatura', publishedAt: '2026-07-10', sourceName: 'OpenAlex', contentType: 'artigo', topics: ['IA', 'indústria'], relevanceScore: 90, externalId: 'doi:a' }),
  normalizeRadarItem({ id: 'b', section: 'government', title: 'Política de EPT', summaryPt: 'MEC', publishedAt: '2026-06-10', sourceName: 'MEC / SETEC', contentType: 'notícia oficial', topics: ['EPT'], relevanceScore: 80, externalId: 'gov:b' }),
];

describe('radar domain', () => {
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
});
