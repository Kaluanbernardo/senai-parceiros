import { describe, expect, it } from 'vitest';
import {
  approveAllNew,
  compareCatalogRecords,
  countApprovedDecisions,
  countResearchStates,
  filterResearchRows,
  researchRowState,
} from './catalogResearchReview';

const ROWS = [
  { batchId: 'b1', rowNumber: 1, status: 'new' },
  { batchId: 'b1', rowNumber: 2, status: 'possible_duplicate' },
  { batchId: 'b1', rowNumber: 3, status: 'invalid' },
  { batchId: 'b2', rowNumber: 1, status: 'new' },
  { batchId: 'b2', rowNumber: 2, status: 'already_imported' },
];

describe('estados da revisão de pesquisa', () => {
  it('classifica cada resultado pelo tipo de decisão que ele pede', () => {
    expect(ROWS.map(researchRowState)).toEqual(['new', 'duplicate', 'invalid', 'new', 'invalid']);
  });

  it('conta quantos há em cada estado', () => {
    expect(countResearchStates(ROWS)).toEqual({ all: 5, new: 2, duplicate: 1, invalid: 2 });
  });

  it('filtra por estado e devolve tudo quando o filtro é "todos"', () => {
    expect(filterResearchRows(ROWS, 'new')).toHaveLength(2);
    expect(filterResearchRows(ROWS, 'duplicate')).toHaveLength(1);
    expect(filterResearchRows(ROWS, 'all')).toHaveLength(5);
  });
});

describe('aprovação em lote', () => {
  it('aprova apenas os novos e preserva as decisões já tomadas', () => {
    const decisions = approveAllNew(ROWS, { 'b1:2': 'merge' });
    expect(decisions).toEqual({ 'b1:1': 'use_imported', 'b2:1': 'use_imported', 'b1:2': 'merge' });
  });

  it('não toca em duplicatas nem em resultados sem evidência', () => {
    const decisions = approveAllNew(ROWS, {});
    expect(decisions['b1:2']).toBeUndefined();
    expect(decisions['b1:3']).toBeUndefined();
  });

  it('conta quantos serão gravados', () => {
    expect(countApprovedDecisions({ a: 'use_imported', b: 'merge', c: 'ignore', d: 'keep_existing' })).toBe(2);
  });
});

describe('comparação com o registro que já existe', () => {
  const existing = {
    nome: 'Cedefop', pais: 'Grécia', subtipo: 'Organismo internacional',
    descricao: 'x'.repeat(120), areas: 'EPT;Políticas', website: 'https://cedefop.europa.eu',
  };
  const incoming = {
    nome: 'Cedefop', pais: 'Grécia', subtipo: 'Organismo internacional',
    descricao: 'y'.repeat(640), areas: 'EPT;Políticas;Competências digitais',
    fontes: ['https://cedefop.europa.eu', 'https://ec.europa.eu/cedefop'],
  };

  it('mostra o que difere entre os dois registros', () => {
    const rows = compareCatalogRecords(existing, incoming);
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));
    expect(byLabel['País'].differs).toBe(false);
    expect(byLabel['Áreas']).toMatchObject({ existing: '2', incoming: '3', differs: true });
    expect(byLabel['Descrição']).toMatchObject({ existing: '120 caracteres', incoming: '640 caracteres', differs: true });
    expect(byLabel['Links públicos']).toMatchObject({ existing: '1', incoming: '2', differs: true });
  });

  it('omite campos vazios dos dois lados', () => {
    const rows = compareCatalogRecords(existing, incoming);
    expect(rows.some((row) => row.label === 'Cargo')).toBe(false);
  });

  it('não compara nada quando falta um dos lados', () => {
    expect(compareCatalogRecords(null, incoming)).toEqual([]);
    expect(compareCatalogRecords(existing, null)).toEqual([]);
  });
});
