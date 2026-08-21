import { describe, expect, it } from 'vitest';
import { compareValues, getComparator } from './tableSort';

const byColumn = (rows, order, orderBy) => [...rows].sort(getComparator(order, orderBy)).map((row) => row[orderBy]);

describe('ordenação das tabelas administrativas', () => {
  it('ordena números como números, não como texto', () => {
    const rows = [{ id: 1 }, { id: 10 }, { id: 100 }, { id: 11 }, { id: 2 }, { id: 20 }];
    expect(byColumn(rows, 'asc', 'id')).toEqual([1, 2, 10, 11, 20, 100]);
    expect(byColumn(rows, 'desc', 'id')).toEqual([100, 20, 11, 10, 2, 1]);
  });

  it('ordena h-index do maior para o menor sem trazer os vazios para o topo', () => {
    const rows = [{ h_index: 9 }, { h_index: undefined }, { h_index: 41 }, { h_index: '' }, { h_index: 7 }];
    expect(byColumn(rows, 'desc', 'h_index')).toEqual([41, 9, 7, undefined, '']);
  });

  it('mantém os registros sem valor no fim também em ordem crescente', () => {
    const rows = [{ pais: null }, { pais: 'Brasil' }, { pais: 'Alemanha' }];
    expect(byColumn(rows, 'asc', 'pais')).toEqual(['Alemanha', 'Brasil', null]);
  });

  it('ordena texto pela ordenação do português, com acentos no lugar certo', () => {
    const rows = [{ nome: 'Zurique' }, { nome: 'Áustria' }, { nome: 'Argentina' }];
    expect(byColumn(rows, 'asc', 'nome')).toEqual(['Argentina', 'Áustria', 'Zurique']);
  });

  it('compara valores mistos sem tratar texto como zero', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues('Brasil', 'Alemanha')).toBeGreaterThan(0);
    expect(compareValues('10', '9')).toBeGreaterThan(0);
  });
});
