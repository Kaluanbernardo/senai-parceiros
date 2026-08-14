import { describe, expect, it } from 'vitest';
import { validateCatalogHeaders } from './catalogImportSchema';
import { CATEGORY_SCHEMAS, generateResearchPrompt } from './promptGenerator';

describe('generateResearchPrompt', () => {
  it.each([
    ['person', 'pessoas físicas'],
    ['organization', 'pessoas jurídicas'],
  ])('declares that the selected category is exclusive: %s', (category, label) => {
    const prompt = generateResearchPrompt({ category, context: 'Economia circular', purpose: 'Parceria' });

    expect(prompt).toContain(`PESQUISE SOMENTE ${label.toUpperCase()}.`);
    expect(prompt).toContain('Não misture categorias no mesmo CSV');
  });

  it('carries the selected subtype into the research request', () => {
    const prompt = generateResearchPrompt({ category: 'organization', subtype: 'Instituição de ensino', context: 'Formação dual' });
    expect(prompt).toContain('Subtipo desejado: Instituição de ensino');
    expect(prompt).toContain('Instituições de ensino pertencem a Pessoas Jurídicas');
  });

  it('requires the exact person schema and a portable CSV output', () => {
    const prompt = generateResearchPrompt({
      category: 'person',
      personProfiles: 'indústria; imprensa',
      sourcePreferences: 'LinkedIn; imprensa',
      context: 'Especialistas em IA aplicada à indústria',
      purpose: 'Convidados para evento',
      geography: 'Brasil e exterior',
      quantity: 20,
      extraCriteria: 'Experiência com educação profissional',
    });

    for (const column of CATEGORY_SCHEMAS.person) {
      expect(prompt).toContain(column.name);
    }
    expect(prompt).toContain('CSV UTF-8');
    expect(prompt).toContain('somente um CSV UTF-8');
    expect(prompt).toContain('pelo menos 400 caracteres');
    expect(prompt).toContain('producoes_relevantes');
    expect(prompt).toContain('LinkedIn');
    expect(prompt).toContain('Aplique exigências acadêmicas somente');
    expect(prompt).toContain('Não entregue XLSX');
    expect(prompt).toContain('h_index');
    expect(prompt).toContain('não localizado');
    expect(prompt).toContain('Não invente');
  });

  describe('contrato completo', () => {
    const base = { category: 'person', context: 'IA na indústria', purpose: 'Evento' };

    it('always asks for every researcher column', () => {
      const prompt = generateResearchPrompt({ ...base, columns: ['resumo'] });
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      expect(headerLine).toBe(CATEGORY_SCHEMAS.person.map((column) => column.name).join(' | '));
      expect(prompt).toContain('Use todas as colunas acima');
    });

    it('produces a full header the importer accepts', () => {
      const prompt = generateResearchPrompt(base);
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      expect(validateCatalogHeaders(headerLine.split(' | '), 'person').valid).toBe(true);
    });

    it('falls back to the full schema when no cut is given', () => {
      const prompt = generateResearchPrompt(base);
      for (const column of CATEGORY_SCHEMAS.person) expect(prompt).toContain(column.name);
      expect(prompt).not.toContain('colunas das');
    });
  });
});
