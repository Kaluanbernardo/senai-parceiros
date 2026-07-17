import { describe, expect, it } from 'vitest';
import { formatInstitutionName } from './institutionName.js';

describe('institution display names', () => {
  it('places a known acronym before the expanded name', () => {
    expect(formatInstitutionName('Serviço Nacional de Aprendizagem Industrial')).toBe('SENAI (Serviço Nacional de Aprendizagem Industrial)');
    expect(formatInstitutionName('Centro Federal de Educação Tecnológica de Minas Gerais (CEFET-MG)')).toBe('CEFET-MG (Centro Federal de Educação Tecnológica de Minas Gerais)');
  });

  it('normalizes acronym and dash variants without changing names that have no acronym', () => {
    expect(formatInstitutionName('CEFET-RJ — Centro Federal de Educação Tecnológica Celso Suckow da Fonseca')).toBe('CEFET-RJ (Centro Federal de Educação Tecnológica Celso Suckow da Fonseca)');
    expect(formatInstitutionName('Rede Federal de Educação Profissional, Científica e Tecnológica')).toBe('Rede Federal de Educação Profissional, Científica e Tecnológica');
  });
});
