import { describe, expect, it } from 'vitest';
import { getEssentialHeaders, getRequiredHeaders, validateCatalogHeaders } from './catalogImportSchema';
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
    expect(prompt).toContain('podem ser importados diretamente');
    expect(prompt).toContain('h_index');
    expect(prompt).toContain('não localizado');
    expect(prompt).toContain('Não invente');
  });

  describe('recorte de colunas', () => {
    const base = { category: 'researcher', context: 'IA na indústria', purpose: 'Evento' };

    it('asks only for the requested columns', () => {
      const columns = ['schema_version', 'tipo_registro', 'nome', 'pais', 'resumo'];
      const prompt = generateResearchPrompt({ ...base, columns });
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      expect(headerLine).toBe('schema_version | tipo_registro | nome | pais | resumo');
      expect(prompt).not.toContain('openalex_id');
      expect(prompt).toContain('5 colunas das');
    });

    it('adds the required columns back when the user leaves them out', () => {
      // Deixar o usuário gerar uma pesquisa inteira que será recusada na
      // importação seria pior do que completar o recorte em silêncio.
      const prompt = generateResearchPrompt({ ...base, columns: ['resumo'] });
      const headerLine = prompt.split('\n').find((line) => line.startsWith('schema_version |'));

      for (const required of getRequiredHeaders('researcher')) expect(headerLine).toContain(required);
    });

    it('produces a header the importer accepts', () => {
      const prompt = generateResearchPrompt({ ...base, columns: getEssentialHeaders('researcher') });
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
