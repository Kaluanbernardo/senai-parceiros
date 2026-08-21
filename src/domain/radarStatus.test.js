import { describe, expect, it } from 'vitest';
import { describeRadarSnapshot, formatCollectedAt, radarCatalogQuery } from './radarStatus';

const NOW = new Date('2026-08-21T12:00:00Z');

describe('quando foi a última coleta', () => {
  it('descreve o tempo decorrido em vez de um carimbo cru', () => {
    expect(formatCollectedAt('2026-08-21T11:59:30Z', NOW)).toBe('agora há pouco');
    expect(formatCollectedAt('2026-08-21T09:00:00Z', NOW)).toBe('há 3 horas');
    expect(formatCollectedAt('2026-08-19T12:00:00Z', NOW)).toBe('há 2 dias');
  });

  it('volta à data completa quando a coleta é antiga', () => {
    expect(formatCollectedAt('2026-06-01T12:00:00Z', NOW)).toMatch(/2026/);
  });

  it('diz que nunca houve coleta em vez de inventar uma data', () => {
    expect(formatCollectedAt(null, NOW)).toBe('sem coleta registrada');
    expect(formatCollectedAt('não é uma data', NOW)).toBe('sem coleta registrada');
  });
});

describe('estado do snapshot do radar', () => {
  const meta = {
    fetchedAt: '2026-08-21T06:00:00Z',
    lastRun: { itemCount: 34, fetchedAt: '2026-08-21T06:00:00Z' },
    sourceStatus: {
      OCDE: { name: 'OCDE', status: 'ok', count: 12 },
      DOU: { name: 'DOU', status: 'ok', count: 22 },
      Cedefop: { name: 'Cedefop', status: 'error', error: 'provider_5xx', httpStatus: 502 },
      Vazia: { name: 'Vazia', status: 'ok', count: 0 },
    },
    store: { driver: 'blob' },
  };

  it('conta apenas as fontes que responderam e trouxeram itens', () => {
    const status = describeRadarSnapshot(meta, { now: NOW });
    expect(status.sourcesOk).toBe(2);
    expect(status.sourcesTotal).toBe(4);
    expect(status.itemCount).toBe(34);
    expect(status.collectedAtLabel).toBe('há 6 horas');
  });

  it('nomeia cada fonte improdutiva com o motivo e o status HTTP', () => {
    const status = describeRadarSnapshot(meta, { now: NOW });
    expect(status.failures).toEqual([
      { name: 'Cedefop', reason: 'provider_5xx', httpStatus: 502 },
      { name: 'Vazia', reason: 'ok', httpStatus: null },
    ]);
  });

  it('avisa quando o snapshot só existe em memória', () => {
    const status = describeRadarSnapshot({ ...meta, store: { driver: 'memory' } }, { now: NOW });
    expect(status.volatile).toBe(true);
  });

  it('reconhece um radar que nunca coletou', () => {
    const status = describeRadarSnapshot({}, { now: NOW });
    expect(status.never).toBe(true);
    expect(status.severity).toBe('warning');
    expect(status.collectedAtLabel).toBe('sem coleta registrada');
  });

  it('marca como atenção um snapshot preservado depois de uma coleta que falhou', () => {
    expect(describeRadarSnapshot({ ...meta, stale: true }, { now: NOW }).severity).toBe('warning');
  });
});

describe('elo do radar para o catálogo', () => {
  it('usa os temas do item como busca no catálogo', () => {
    expect(radarCatalogQuery({ topics: ['Digitalização', 'Indústria 4.0', 'Currículo'] }))
      .toBe('Digitalização Indústria 4.0');
  });

  it('não oferece busca quando o item não tem tema', () => {
    expect(radarCatalogQuery({ topics: [] })).toBe('');
    expect(radarCatalogQuery({})).toBe('');
  });
});
