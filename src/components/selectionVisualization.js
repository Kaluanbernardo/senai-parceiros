const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

// Offsets are deliberately small so coincident points remain close to their
// true coordinates while still being individually visible.
const CLUSTER_OFFSETS = [
  [0, 0],
  [-18, -18],
  [18, 18],
  [-18, 18],
  [18, -18],
  [0, -24],
  [0, 24],
];

function clusterOffset(position, size) {
  if (position < CLUSTER_OFFSETS.length && size <= CLUSTER_OFFSETS.length) return CLUSTER_OFFSETS[position];
  const angle = (position / Math.max(size, 1)) * Math.PI * 2;
  const radius = 18 + Math.floor(position / CLUSTER_OFFSETS.length) * 6;
  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)];
}

export function getMatrixMarkers(entries = []) {
  const groups = new Map();
  const markers = entries.map((entry, index) => {
    const x = clamp(entry?.viability);
    const y = clamp(entry?.strategicValue);
    // A 5-point bucket catches both exact and nearly coincident points.
    const key = `${Math.round(x / 5)}:${Math.round(y / 5)}`;
    const group = groups.get(key) || [];
    group.push(index);
    groups.set(key, group);
    return { entry, index, x, y, key };
  });

  return markers.map((marker) => {
    const group = groups.get(marker.key) || [marker.index];
    const position = group.indexOf(marker.index);
    const [offsetX, offsetY] = clusterOffset(position, group.length);
    return { ...marker, offsetX, offsetY, clusterSize: group.length };
  });
}

export function getRadarSeries(entries = [], limit = 5) {
  return entries.slice(0, limit).map((entry, index) => ({
    id: String(entry?.candidate?.id ?? index),
    label: entry?.candidate?.nome || entry?.candidate?.instituicao || `Stakeholder ${index + 1}`,
    rank: index + 1,
    dimensions: entry?.dimensions || {},
  }));
}
