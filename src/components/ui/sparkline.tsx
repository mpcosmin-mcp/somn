/* Tiny SVG sparkline — replaces Chart.js for inline visuals.
   Optional hover/touch tooltip: pass `dates` to enable an inline value
   label on hover. All hover decoration renders INSIDE the SVG so the
   parent's `overflow: hidden` (e.g. .kpi cards) never clips anything. */
'use client';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  values: (number | null)[];
  /** Optional — when provided, hover/touch shows an inline value+date label */
  dates?: string[];
  /** Optional unit appended to the value label (e.g. 'min', 'bpm') */
  unit?: string;
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

const MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

export function Sparkline({
  values,
  dates,
  unit = '',
  width = 120,
  height = 32,
  color = '#a3e635',
  showDots = false,
  className,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) {
    return (
      <div className={cn('text-[10px] text-zinc-600 italic', className)}>insuficient</div>
    );
  }

  const min = Math.min(...present);
  const max = Math.max(...present);
  const range = max - min || 1;
  const padY = 4;

  const pts = values.map((v, i) => {
    if (v == null) return null;
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y, v };
  });

  // Build a path string, breaking on null
  let d = '';
  let prev: { x: number; y: number } | null = null;
  for (const p of pts) {
    if (!p) { prev = null; continue; }
    d += prev ? ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    prev = p;
  }

  const interactive = !!dates && dates.length === values.length;

  const updateHoverFromClientX = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const xInSvg = (relX / rect.width) * width;
    // Snap to nearest non-null index
    let bestIdx: number | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!p) continue;
      const dist = Math.abs(p.x - xInSvg);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    setHoverIdx(bestIdx);
  };

  const lastVisible = [...pts].reverse().find(p => p) ?? null;
  const hoveredPt = hoverIdx != null ? pts[hoverIdx] : null;
  const hoveredDate = interactive && hoverIdx != null ? dates![hoverIdx] : null;

  // Inline label content: "92m · 15 dec" — short enough to fit beside the dot.
  const labelText = hoveredPt ? (() => {
    let s = `${hoveredPt.v}${unit}`;
    if (hoveredDate) {
      const d2 = new Date(hoveredDate + 'T12:00:00');
      s += ` · ${d2.getDate()} ${MONTHS_SHORT[d2.getMonth()]}`;
    }
    return s;
  })() : '';

  // Anchor the label on the opposite side of the dot so it doesn't go off-screen.
  // If dot is in the right half, label anchors RIGHT (text-anchor:end), placed to the left.
  // Otherwise label anchors LEFT (text-anchor:start), placed to the right.
  const labelOnRight = hoveredPt ? hoveredPt.x < width / 2 : true;
  const labelX = hoveredPt ? (labelOnRight ? hoveredPt.x + 6 : hoveredPt.x - 6) : 0;
  // Center vertically on the dot
  const labelY = hoveredPt ? hoveredPt.y + 3 : 0;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible select-none', interactive && 'cursor-crosshair', className)}
      onMouseMove={interactive ? (e) => updateHoverFromClientX(e.clientX) : undefined}
      onMouseLeave={interactive ? () => setHoverIdx(null) : undefined}
      onTouchStart={interactive ? (e) => {
        const t = e.touches[0]; if (t) updateHoverFromClientX(t.clientX);
      } : undefined}
      onTouchMove={interactive ? (e) => {
        const t = e.touches[0]; if (t) { e.preventDefault(); updateHoverFromClientX(t.clientX); }
      } : undefined}
    >
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && pts.map((p, i) => p && (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />
      ))}

      {/* Last-point emphasis when not actively hovering on it */}
      {lastVisible && hoverIdx !== values.length - 1 && (
        <circle cx={lastVisible.x} cy={lastVisible.y} r={2.5} fill={color} />
      )}

      {/* Hover highlight + inline label */}
      {hoveredPt && (
        <g pointerEvents="none">
          {/* Soft halo + emphasized dot */}
          <circle cx={hoveredPt.x} cy={hoveredPt.y} r={5} fill={color} opacity={0.18} />
          <circle
            cx={hoveredPt.x} cy={hoveredPt.y} r={2.8}
            fill={color}
            stroke="var(--color-bg)"
            strokeWidth={1.2}
          />
          {/* Inline label — stroke trick gives a readable outline against the chart */}
          <text
            x={labelX}
            y={labelY}
            fontSize="9.5"
            fontWeight="700"
            textAnchor={labelOnRight ? 'start' : 'end'}
            fill={color}
            fontFamily="monospace"
            paintOrder="stroke"
            stroke="var(--color-bg)"
            strokeWidth="3"
            strokeLinejoin="round"
          >
            {labelText}
          </text>
        </g>
      )}
    </svg>
  );
}
