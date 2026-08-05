import { describe, expect, it } from 'vitest';
import { canonicalizeResearchers, resolveResearcherId } from './researcherCatalog';
import researchers from '../data/pesquisadores.json';

describe('researcher catalog', () => {
  it('merges duplicate Scholar identities without losing articles or legacy ids', () => {
    const result = canonicalizeResearchers([
      { id: 15, nome: 'Christopher Winch', instituicao: "King's College London", scholar: 'https://scholar.google.com/citations?user=abc', pesquisa: 'curta', artigos: [{ titulo: 'A', url: 'https://doi.org/a' }] },
      { id: 16, nome: 'Christopher Winch', instituicao: 'Outra instituição', scholar: 'https://scholar.google.com/citations?user=abc', pesquisa: 'biografia mais completa', artigos: [{ titulo: 'B', url: 'https://doi.org/b' }] },
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].id).toBe(15);
    expect(result.records[0].legacyIds).toEqual([16]);
    expect(result.records[0].artigos).toHaveLength(2);
    expect(result.aliases[0]).toMatchObject({ legacyId: 16, canonicalId: 15 });
    expect(result.records[0].mergeEvidence.overlappingArticleCount).toBe(0);
    expect(result.records[0].mergeConfidence).toBe(1);
  });

  it('does not merge different people with the same name when institution differs', () => {
    const result = canonicalizeResearchers([
      { id: 1, nome: 'Alex Silva', instituicao: 'A', pais: 'Brasil' },
      { id: 2, nome: 'Alex Silva', instituicao: 'B', pais: 'Brasil' },
    ]);
    expect(result.records).toHaveLength(2);
  });

  it('unites imported themes when merging the same researcher', () => {
    const result = canonicalizeResearchers([
      { id: 1, nome: 'Julian Kirchherr', instituicao: 'RUC', scholar: 'https://scholar.google.com/citations?user=abc', areas: 'economia circular' },
      { id: 2, nome: 'Julian Kirchherr', instituicao: 'RUC', scholar: 'https://scholar.google.com/citations?user=abc', areas: ['políticas públicas', 'economia circular'] },
    ]);
    expect(result.records[0].areas).toEqual(['economia circular', 'políticas públicas']);
  });

  it('canonicalizes the production catalog and absorbs legacy “Ver acima” rows', () => {
    const result = canonicalizeResearchers(researchers);

    expect(result.records).toHaveLength(88);
    expect(result.aliases).toHaveLength(12);
    expect(result.records.some((record) => record.instituicao === 'Ver acima')).toBe(false);
    expect(resolveResearcherId(result.records, 16)?.id).toBe(15);
  });
});
