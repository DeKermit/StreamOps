import React from 'react';

// Minimal, dependency-free SVG line chart. `points` is an array of
// { label, value }. Kept deliberately simple (no axes library) so the
// dashboard never depends on a chart package that might not be
// installed - this renders with nothing but React + inline SVG.
export default function LineChart({ points, height = 160, color = '#8b5cf6', fillId = 'chartFill' }) {
  if (!points || points.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm opacity-50">No data yet.</div>;
  }

  const width = 600;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = width / Math.max(1, points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.value / max) * (height - 20) - 10;
    return { x, y, value: p.value, label: p.label };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={color} />
      ))}
    </svg>
  );
}
