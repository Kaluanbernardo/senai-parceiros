import { describe, expect, it } from 'vitest';
import { validateCatalogHeaders } from './catalogImportSchema';
import { CATEGORY_SCHEMAS, generateResearchPrompt } from './promptGenerator';

describe('generateResearchPrompt', () => {
  it.each([
    ['researcher', 'especialistas (pesquisadores)'],
    ['organization', 'organizações'],
    ['school', 'instituições de educação'],
  ])('declares that the selected category is exclusive: %s', (category, label) => {
    const prompt = generateResearchPrompt({ category, context: 'Economia circular', purpose: 'Parceria' });

    expect(prompt).toContain(`PESQUISE SOMENTE ${label.toUpperCase()}.`);
    expect(prompt).toContain('Não misture categorias no mesmo CSV');
  });

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
    expect(prompt).toContain('CSV UTF-8');
    expect(prompt).toContain('somente um CSV UTF-8');
    expect(prompt).toContain('pelo menos 400 caracteres');
    expect(prompt).toContain('pelo menos 5 publicações relevantes');
    expect(prompt).toContain('5 artigos com mais citações no Google Scholar');
    expect(prompt).toContain('contagem de citações');
    expect(prompt).toContain('URL direta');
    expect(prompt).toContain('Não entregue XLSX');
    expect(prompt).toContain('h_index');
    expect(prompt).toContain('não localizado');
    expect(prompt).toContain('Não invente');
  });

  describe('contrato completo', () => {
    const base = { category: 'researcher', context: 'IA na indústria', purpose: 'Evento' };

    it('always asks for every researcher column', () => {
      const prompt = generateResearchPrompt({ ...base, columns: ['resumo'] });
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      expect(headerLine).toBe(CATEGORY_SCHEMAS.researcher.map((column) => column.name).join(' | '));
      expect(prompt).toContain('Use todas as colunas acima');
    });

    it('produces a full header the importer accepts', () => {
      const prompt = generateResearchPrompt(base);
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      expect(validateCatalogHeaders(headerLine.split(' | '), 'researcher').valid).toBe(true);
    });

    it('falls back to the full schema when no cut is given', () => {
      const prompt = generateResearchPrompt(base);
      for (const column of CATEGORY_SCHEMAS.researcher) expect(prompt).toContain(column.name);
      expect(prompt).not.toContain('colunas das');
    });
  });
});
