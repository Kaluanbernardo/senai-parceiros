import React from 'react';

export const DIMENSION_LABELS = {
  impact: 'Impacto',
  alignment: 'Alinhamento',
  credibility: 'Credibilidade',
  collaboration: 'Colaboração',
  feasibility: 'Viabilidade',
  risk: 'Risco controlado',
};

const DIMENSIONS = Object.keys(DIMENSION_LABELS);
const CENTER = 110;
const RADIUS = 78;

function point(index, value) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / DIMENSIONS.length;
  const radius = (Number(value) / 100) * RADIUS;
  return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
}

function polygon(values) {
  return DIMENSIONS.map((key, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / DIMENSIONS.length;
    const value = RADIUS * (Number(values?.[key] ?? 0) / 100);
    return (CENTER + Math.cos(angle) * value) + ',' + (CENTER + Math.sin(angle) * value);
  }).join(' ');
}

export default function ScoreRadar({ dimensions, compact = false }) {
  return (
    <svg viewBox="0 0 220 220" width={compact ? 180 : 220} height={compact ? 180 : 220} role="img" aria-label="Radar de dimensões">
      {[25, 50, 75, 100].map((level) => (
        <polygon key={level} points={polygon(Object.fromEntries(DIMENSIONS.map((key) => [key, level])))} fill="none" stroke="#d9e2ec" strokeWidth="1" />
      ))}
      {DIMENSIONS.map((key, index) => {
        const [x, y] = point(index, 100);
        const [labelX, labelY] = point(index, 118);
        return (
          <g key={key}>
            <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#d9e2ec" strokeWidth="1" />
            {!compact && <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#52606d">{DIMENSION_LABELS[key]}</text>}
          </g>
        );
      })}
      <polygon points={polygon(dimensions || {})} fill="rgba(0, 92, 153, 0.24)" stroke="#005c99" strokeWidth="2.5" />
      {DIMENSIONS.map((key, index) => {
        const [x, y] = point(index, dimensions?.[key] ?? 0);
        return <circle key={key} cx={x} cy={y} r="3" fill="#cc0000" />;
      })}
    </svg>
  );
}
