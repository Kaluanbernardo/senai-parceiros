import { describe, expect, it } from 'vitest';
import { personProfileLinks } from './DetailModal.jsx';

describe('DetailModal person profile links', () => {
  it('keeps every public profile paired with its own label and URL', () => {
    expect(personProfileLinks({
      website: 'https://university.example/people/marina',
      perfil_principal_url: 'https://lab.example/marina',
      linkedin_url: 'https://www.linkedin.com/in/marina',
      scholar: 'https://scholar.google.com/citations?user=abc',
      orcid: '0000-0000-0000-0000',
    })).toEqual([
      { label: 'Website', href: 'https://university.example/people/marina' },
      { label: 'Perfil institucional', href: 'https://lab.example/marina' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/marina' },
      { label: 'Google Scholar', href: 'https://scholar.google.com/citations?user=abc' },
      { label: 'ORCID', href: 'https://orcid.org/0000-0000-0000-0000' },
    ]);
  });

  it('deduplicates repeated destinations and ignores invalid URLs', () => {
    expect(personProfileLinks({
      website: 'https://example.org/profile',
      perfil_principal_url: 'https://example.org/profile',
      linkedin_url: 'não localizado',
      scholar: '',
    })).toEqual([{ label: 'Website', href: 'https://example.org/profile' }]);
  });
});
