import { describe, expect, it } from 'vitest';
import { abstractInputHash, buildEvidenceFallback, buildSummaryMetadata, extractCrossrefAbstract, mergeResearchItems, reconstructOpenAlexAbstract, validateResearchSummary } from './summaries.js';

describe('radar research summaries', () => {
  it('reconstructs OpenAlex inverted abstracts in word order', () => {
    expect(reconstructOpenAlexAbstract({
      This: [0],
      study: [1],
      evaluates: [2],
      training: [3],
    })).toBe('This study evaluates training');
  });

  it('cleans Crossref HTML/JATS abstracts', () => {
    expect(extractCrossrefAbstract({ abstract: '<jats:p>Skills &amp; training improve <b>industrial</b> transitions.</jats:p>' }))
      .toBe('Skills & training improve industrial transitions.');
  });

  it('rejects summaries that repeat metadata or boilerplate', () => {
    expect(validateResearchSummary('Pesquisa de Ana Silva, publicada em 2026-07-10.', { title: 'Pesquisa', authors: ['Ana Silva'], publishedAt: '2026-07-10' })).toBe(false);
    expect(validateResearchSummary('The study compares technical training pathways and identifies practical differences in curriculum and employer engagement.', { title: 'Outro título', authors: ['Ana Silva'], publishedAt: '2026-07-10' })).toBe(true);
  });

  it('merges duplicate DOI records and preserves richer evidence', () => {
    const merged = mergeResearchItems([
      { doi: '10.1/x', provider: 'openalex', title: 'Study', abstractText: '', authors: ['A'] },
      { doi: '10.1/x', provider: 'crossref', title: 'Study', abstractText: 'A substantive abstract about vocational training and industry.', authors: ['B'] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].abstractText).toContain('substantive abstract');
    expect(merged[0].authors).toEqual(['A', 'B']);
  });

  it('uses an explicit evidence fallback and stable input hash', () => {
    const text = 'The study examines vocational education. It compares curricula and employer partnerships.';
    expect(buildEvidenceFallback(text)).toBe(text);
    expect(abstractInputHash({ id: 'x', title: 'Study', abstractText: text })).toHaveLength(64);
    expect(buildSummaryMetadata({ id: 'x', title: 'Study', sourceText: text, status: 'extractive' })).toMatchObject({ summaryStatus: 'extractive', summaryPt: text });
  });
});
