import { describe, expect, it } from 'vitest';
import {
  buildResearcherImageManifest,
  createResearcherImage,
  isApprovedResearcherImage,
  normalizeResearcherImage,
  summarizeImageCoverage,
  validateResearcherImage,
} from './researcherMedia';

const reviewedImage = {
  path: '/fotos/pesquisador.jpg',
  sourceUrl: 'https://instituicao.example/pesquisador',
  sourceType: 'institutional',
  license: 'permission-granted',
  attribution: 'Instituição do pesquisador',
  retrievedAt: '2026-07-15',
  status: 'approved',
  confidence: 95,
  reviewedAt: '2026-07-15',
};

describe('researcher media contract', () => {
  it('validates approved images only with provenance and known license', () => {
    expect(validateResearcherImage(reviewedImage)).toEqual({ valid: true, errors: [] });
    expect(isApprovedResearcherImage(reviewedImage)).toBe(true);
    expect(validateResearcherImage({ ...reviewedImage, sourceUrl: null }).valid).toBe(false);
    expect(validateResearcherImage({ ...reviewedImage, license: 'unknown' }).valid).toBe(false);
  });

  it('keeps legacy local assets reviewable without inventing provenance', () => {
    const legacy = normalizeResearcherImage({
      path: '/fotos/acacia-kuenzer.jpg',
      sourceType: 'legacy-local',
      license: 'unknown',
      attribution: 'Origem da imagem legada não registrada.',
      status: 'needs-review',
      confidence: 50,
    });
    expect(validateResearcherImage(legacy)).toEqual({ valid: true, errors: [] });
    expect(isApprovedResearcherImage(legacy)).toBe(false);
  });

  it('creates a manifest and reports status coverage', () => {
    const manifest = buildResearcherImageManifest([
      { id: 1, nome: 'A', image: reviewedImage },
      { id: 2, nome: 'B' },
      { id: 3, nome: 'C', image: { ...reviewedImage, status: 'needs-review', sourceUrl: null, license: 'unknown' } },
    ]);
    expect(manifest).toHaveLength(3);
    expect(summarizeImageCoverage(manifest)).toEqual({ total: 3, approved: 1, 'needs-review': 1, missing: 1, blocked: 0 });
  });

  it('rejects malformed paths and dates', () => {
    expect(() => createResearcherImage({ ...reviewedImage, path: 'https://example.com/photo.jpg' })).toThrow('invalid_researcher_image');
    expect(validateResearcherImage({ ...reviewedImage, retrievedAt: '2026-99-99' }).valid).toBe(false);
  });
});
