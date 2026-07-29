import { describe, expect, it } from 'vitest';
import { CATEGORY_SCHEMAS, generateResearchPrompt } from './promptGenerator';

describe('generateResearchPrompt', () => {
  it('requires the exact researcher schema and a portable spreadsheet output', () => {
    const prompt = generateResearchPrompt({
      category: 'researcher',
      context: 'Especialistas em IA aplicada à indústria',
      purpose: 'Convidados para evento',
      geography: 'Brasil e exterior',
      quantity: 20,
      extraCriteria: 'Experiência com educação profissional',
    });

    for (const column of CATEGORY_SCHEMAS.researcher) {
      expect(prompt).toContain(column.name);
    }
    expect(prompt).toContain('XLSX');
    expect(prompt).toContain('CSV UTF-8');
    expect(prompt).toContain('não localizado');
    expect(prompt).toContain('Não invente');
  });
});
