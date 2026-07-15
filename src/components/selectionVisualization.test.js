import { describe, expect, it } from 'vitest';
import { getMatrixMarkers, getRadarSeries } from './selectionVisualization';

describe('selection visualizations', () => {
  it('keeps coincident matrix entries separately addressable', () => {
    const entries = [
      { viability: 70, strategicValue: 80, candidate: { id: 1 } },
      { viability: 70, strategicValue: 80, candidate: { id: 2 } },
      { viability: 71, strategicValue: 81, candidate: { id: 3 } },
    ];
    const markers = getMatrixMarkers(entries);

    expect(markers).toHaveLength(3);
    expect(new Set(markers.map((marker) => `${marker.offsetX}:${marker.offsetY}`)).size).toBeGreaterThan(1);
    expect(markers.every((marker) => marker.clusterSize === 3)).toBe(true);
  });

  it('builds a comparison series for at most the first five entries', () => {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      candidate: { id: index + 1, nome: `Pessoa ${index + 1}` },
      dimensions: { impact: index * 10 },
    }));
    const series = getRadarSeries(entries);

    expect(series).toHaveLength(5);
    expect(series[0]).toEqual(expect.objectContaining({ id: '1', rank: 1, label: 'Pessoa 1' }));
    expect(series[4].rank).toBe(5);
  });
});
