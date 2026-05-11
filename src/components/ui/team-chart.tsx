'use client';
import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Series {
  name: string;
  color: string;
  /** Aligned with `dates` — same length, null = missing */
  values: (number | null)[];
}

interface Props {
  series: Series[];
  dates: string[];                /** YYYY-MM-DD aligned with series.values */
  height?: number;
  className?: string;
  target?: number;                /** Optional horizontal dashed reference */
  targetLabel?: string;
  /** "min", "bpm", "ms", "" etc. */
  unit?: string;
  /** If true, lower values are better (e.g. RHR) — flips the "delta from target" sign */
  lowerBetter?: boolean;
}

/**
 * Polished team-comparison chart.
 *
 *   • Smooth cubic-Bezier curves (no jagged lines)
 *   • Gradient area fill under each line
 *   • Subtle drop-shadow on lines for depth
 *   • Y-axis grid (3-4 ticks) with values
 *   • X-axis calendar date labels (5-7 evenly sampled)
 *   • Optional target horizontal dashed line
 *   • Big inline legend below with avg-value per person
 *
 * Container-responsive (100% width), fixed height. SVG keeps aspect ratio.
 */
export function TeamChart({
  series,
  dates,
  height = 280,
  className,
  target,
  targetLabel,
  unit = '',
  lowerBetter = false,
}: Props) {
  const uid = useId();

  // ─── Compute scales ────────────────────────────────────────
  const allValues = useMemo(
    () => series.flatMap(s => s.values).filter((v): v is number => v != null),
    [series],
  );

  // Plot area dimensions (internal SVG viewBox units)
  const VW = 600;
  const VH = height;
  const ML = 36; // left margin (y-axis labels)
  const MR = 12; // right margin
  const MT = 12; // top margin
  const MB = 28; // bottom margin (x-axis labels)
  const plotW = VW - ML - MR;
  const plotH = VH - MT - MB;

  if (allValues.length < 2 || dates.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-xs italic text-[var(--color-fg-dim)]', className)} style={{ height }}>
        Date insuficiente pentru chart.
      </div>
    );
  }

  // Pad y-range a bit on both ends for breathing room
  const rawMin = Math.min(...allValues, target ?? Infinity);
  const rawMax = Math.max(...allValues, target ?? -Infinity);
  const pad = Math.max(2, (rawMax - rawMin) * 0.1);
  const yMin = Math.floor(rawMin - pad);
  const yMax = Math.ceil(rawMax + pad);
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => ML + (i / Math.max(dates.length - 1, 1)) * plotW;
  const yFor = (v: number) => MT + plotH - ((v - yMin) / yRange) * plotH;

  // ─── Smooth path using cubic Bezier midpoint smoothing ──
  /** Build a smooth path through given (x, y) pts. Breaks at nulls. */
  function buildSmoothPath(pts: Array<{ x: number; y: number } | null>): { line: string; area: string } {
    let line = '';
    let area = '';
    let prev: { x: number; y: number } | null = null;

    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    for (const p of pts) {
      if (p) current.push(p);
      else { if (current.length) segments.push(current); current = []; }
    }
    if (current.length) segments.push(current);

    for (const seg of segments) {
      if (seg.length === 1) {
        // Single point — just draw a dot, no path
        continue;
      }
      let segLine = `M ${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)}`;
      for (let i = 1; i < seg.length; i++) {
        const p0 = seg[i - 1];
        const p1 = seg[i];
        // Control points at the horizontal midpoint, vertically matching each end
        const mx = (p0.x + p1.x) / 2;
        segLine += ` C ${mx.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
      line += (line ? ' ' : '') + segLine;
      // Area: extend line down to baseline, back to start
      const baseline = MT + plotH;
      area += (area ? ' ' : '') + `${segLine} L ${seg[seg.length - 1].x.toFixed(1)} ${baseline} L ${seg[0].x.toFixed(1)} ${baseline} Z`;
      prev = seg[seg.length - 1];
    }
    void prev;
    return { line, area };
  }

  // ─── Per-series geometry ───────────────────────────────────
  const seriesGeom = series.map(s => {
    const pts = s.values.map((v, i) => v == null ? null : { x: xFor(i), y: yFor(v) });
    const { line, area } = buildSmoothPath(pts);
    const visiblePts = pts.filter((p): p is { x: number; y: number } => p !== null);
    const validValues = s.values.filter((v): v is number => v != null);
    const avg = validValues.length ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length) : null;
    return { ...s, pts, line, area, visiblePts, avg };
  });

  // ─── Y-axis ticks (4 evenly spaced) ────────────────────────
  const yTicks: number[] = [];
  for (let i = 0; i <= 3; i++) {
    yTicks.push(yMin + (yRange * i) / 3);
  }

  // ─── X-axis labels (5-7 sampled from dates) ────────────────
  const labelCount = Math.min(7, dates.length);
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i / Math.max(labelCount - 1, 1)) * (dates.length - 1));
    const d = new Date(dates[idx] + 'T12:00:00');
    const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
    const label = `${d.getDate()} ${months[d.getMonth()]}`;
    xLabels.push({ x: xFor(idx), label });
  }

  const targetY = target != null ? yFor(target) : null;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height }}
      >
        <defs>
          {/* Drop-shadow filter for lines */}
          <filter id={`shadow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dy="1.5" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* One gradient per series for area fill */}
          {seriesGeom.map((s, i) => (
            <linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.30" />
              <stop offset="60%" stopColor={s.color} stopOpacity="0.08" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line
                x1={ML} x2={VW - MR}
                y1={y} y2={y}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={ML - 6} y={y + 4}
                fontSize="10"
                textAnchor="end"
                fill="currentColor"
                opacity={0.5}
                fontFamily="monospace"
              >
                {Math.round(t)}
              </text>
            </g>
          );
        })}

        {/* Target line */}
        {targetY != null && (
          <g>
            <line
              x1={ML} x2={VW - MR}
              y1={targetY} y2={targetY}
              stroke="currentColor"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={VW - MR - 4} y={targetY - 4}
              fontSize="9"
              textAnchor="end"
              fill="currentColor"
              opacity={0.6}
              fontFamily="monospace"
            >
              {targetLabel ?? 'target'} {target}
            </text>
          </g>
        )}

        {/* Area fills (under each line) */}
        {seriesGeom.map((s, i) => s.area && (
          <path
            key={`area-${i}`}
            d={s.area}
            fill={`url(#grad-${uid}-${i})`}
          />
        ))}

        {/* Lines with drop shadow */}
        {seriesGeom.map((s, i) => s.line && (
          <path
            key={`line-${i}`}
            d={s.line}
            stroke={s.color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#shadow-${uid})`}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Dots on data points */}
        {seriesGeom.map((s, i) =>
          s.visiblePts.map((p, j) => (
            <circle
              key={`dot-${i}-${j}`}
              cx={p.x} cy={p.y} r={3}
              fill="var(--color-bg)"
              stroke={s.color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )),
        )}

        {/* X-axis date labels */}
        {xLabels.map((l, i) => (
          <text
            key={`xlabel-${i}`}
            x={l.x} y={VH - 8}
            fontSize="10"
            textAnchor="middle"
            fill="currentColor"
            opacity={0.55}
            fontFamily="monospace"
          >
            {l.label}
          </text>
        ))}
      </svg>

      {/* Legend below */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 px-1">
        {seriesGeom.map((s, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="font-bold text-xs" style={{ color: s.color }}>{s.name}</span>
            <span className="num text-[10px] text-[var(--color-fg-muted)]">
              avg {s.avg ?? '—'}{unit && s.avg != null ? unit : ''}
              {target != null && s.avg != null && (() => {
                const delta = lowerBetter ? target - s.avg : s.avg - target;
                if (Math.abs(delta) < 1) return null;
                return (
                  <span className={delta > 0 ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                    {delta > 0 ? '↑' : '↓'}
                  </span>
                );
              })()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
