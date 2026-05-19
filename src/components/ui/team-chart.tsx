'use client';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  /** Color the line + dots by target status: green where on/above target, red where below
   *  (flipped for lowerBetter). Opt-in — keeps the multi-person team chart on per-person colors. */
  colorByTarget?: boolean;
}

const MONTHS_SHORT = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
const DAYS_SHORT = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

/**
 * Polished team-comparison chart.
 *
 *   • Smooth cubic-Bezier curves (no jagged lines)
 *   • Gradient area fill under each line
 *   • Subtle drop-shadow on lines for depth
 *   • Y-axis grid (3-4 ticks) with values
 *   • X-axis calendar date labels (5-7 evenly sampled)
 *   • Optional target horizontal dashed line
 *   • Hover/touch: crosshair line + tooltip with per-series values
 *   • Big inline legend below with avg-value per person
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
  colorByTarget = false,
}: Props) {
  const uid = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // ─── Track the actual rendered width so viewBox can match it 1:1.
  // This is THE fix for the "inflated zoom" look — with a fixed viewBox
  // and preserveAspectRatio="none", content stretches horizontally on
  // wide containers. By making viewBox width = actual CSS width, content
  // renders at native pixel sizes: text stays 10px, strokes stay 1px,
  // shapes don't distort.
  const [containerWidth, setContainerWidth] = useState(600);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(Math.round(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Compute scales ────────────────────────────────────────
  const allValues = useMemo(
    () => series.flatMap(s => s.values).filter((v): v is number => v != null),
    [series],
  );

  // Plot area dimensions (internal SVG viewBox units — now matched to actual pixels)
  const VW = Math.max(320, containerWidth);
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
  function buildSmoothPath(pts: Array<{ x: number; y: number } | null>): { line: string; area: string } {
    let line = '';
    let area = '';

    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    for (const p of pts) {
      if (p) current.push(p);
      else { if (current.length) segments.push(current); current = []; }
    }
    if (current.length) segments.push(current);

    for (const seg of segments) {
      if (seg.length === 1) continue;
      let segLine = `M ${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)}`;
      for (let i = 1; i < seg.length; i++) {
        const p0 = seg[i - 1];
        const p1 = seg[i];
        const mx = (p0.x + p1.x) / 2;
        segLine += ` C ${mx.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
      line += (line ? ' ' : '') + segLine;
      const baseline = MT + plotH;
      area += (area ? ' ' : '') + `${segLine} L ${seg[seg.length - 1].x.toFixed(1)} ${baseline} L ${seg[0].x.toFixed(1)} ${baseline} Z`;
    }
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
  for (let i = 0; i <= 3; i++) yTicks.push(yMin + (yRange * i) / 3);

  // ─── X-axis labels (5-7 sampled from dates) ────────────────
  const labelCount = Math.min(7, dates.length);
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.floor((i / Math.max(labelCount - 1, 1)) * (dates.length - 1));
    const d = new Date(dates[idx] + 'T12:00:00');
    const label = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`;
    xLabels.push({ x: xFor(idx), label });
  }

  const targetY = target != null ? yFor(target) : null;

  // ─── Threshold coloring ────────────────────────────────────
  // Green where on/above target, red where below (flipped for lowerBetter).
  // The line uses a vertical gradient with a hard color stop exactly at the
  // target's y — so it flips color precisely where it crosses the target line.
  const GOOD = 'var(--color-good)';
  const BAD = 'var(--color-bad)';
  const useThresh = colorByTarget && targetY != null;
  const statusColor = (v: number | null): string | null => {
    if (v == null || target == null) return null;
    const ok = lowerBetter ? v <= target : v >= target;
    return ok ? GOOD : BAD;
  };
  const threshFrac = targetY != null ? Math.max(0, Math.min(1, targetY / VH)) : 0;
  const threshTop = lowerBetter ? BAD : GOOD;   // above the target line (smaller y)
  const threshBot = lowerBetter ? GOOD : BAD;   // below the target line

  // ─── Hover mapping ─────────────────────────────────────────
  // Convert client mouse x → SVG viewBox x → nearest date index.
  // Since viewBox width = CSS width (no scaling), the math is 1:1.
  const updateHoverFromClientX = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    // Map relX (0..rect.width) → SVG x (0..VW). They're equal now, but
    // keep the ratio in case the SVG element is briefly mis-sized during
    // a resize observer cycle.
    const svgX = (relX / rect.width) * VW;
    // Map svgX → date index (snap to nearest)
    const t = (svgX - ML) / plotW;
    const idx = Math.round(t * (dates.length - 1));
    if (idx < 0 || idx > dates.length - 1) { setHoverIdx(null); return; }
    setHoverIdx(idx);
  };

  const onMouseMove = (e: React.MouseEvent) => updateHoverFromClientX(e.clientX);
  const onMouseLeave = () => setHoverIdx(null);
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) {
      e.preventDefault();
      updateHoverFromClientX(t.clientX);
    }
  };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) updateHoverFromClientX(t.clientX);
  };
  // Keep the tooltip visible until next interaction on touch — don't auto-dismiss
  // (mobile users want to read the value).

  // Clamp hoverIdx in case the dates array shrunk under us
  // (e.g. user switched range from "30" to "7" while hovering).
  const safeHoverIdx =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < dates.length ? hoverIdx : null;

  // Tooltip placement % across the container width.
  // viewBox width == actual CSS width → xFor(idx)/VW maps to a real %.
  const hoverX = safeHoverIdx != null ? xFor(safeHoverIdx) : null;
  const hoverPct = hoverX != null ? (hoverX / VW) * 100 : null;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full block select-none"
        style={{ height }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <defs>
          <filter id={`shadow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dy="1.5" />
            <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {seriesGeom.map((s, i) => (
            <linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.30" />
              <stop offset="60%" stopColor={s.color} stopOpacity="0.08" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}

          {useThresh && (
            <>
              {/* Hard-cut line gradient: green above target, red below (flipped for lowerBetter) */}
              <linearGradient id={`thresh-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={VH}>
                <stop offset="0" style={{ stopColor: threshTop }} />
                <stop offset={threshFrac} style={{ stopColor: threshTop }} />
                <stop offset={threshFrac} style={{ stopColor: threshBot }} />
                <stop offset="1" style={{ stopColor: threshBot }} />
              </linearGradient>
              {/* Soft colored glow under the line — green zone above target, red below */}
              <linearGradient id={`thresharea-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={VH}>
                <stop offset="0" style={{ stopColor: threshTop, stopOpacity: 0.24 }} />
                <stop offset={threshFrac} style={{ stopColor: threshTop, stopOpacity: 0.06 }} />
                <stop offset={threshFrac} style={{ stopColor: threshBot, stopOpacity: 0.20 }} />
                <stop offset="1" style={{ stopColor: threshBot, stopOpacity: 0 }} />
              </linearGradient>
            </>
          )}
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
            {/* Target value marked on the y-axis (left), highlighted vs the gray ticks */}
            <text
              x={ML - 6} y={targetY + 3}
              fontSize="10"
              textAnchor="end"
              fill="var(--color-accent)"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {target}
            </text>
          </g>
        )}

        {/* Area fills — threshold colored glow when colorByTarget, else per-series gradient */}
        {seriesGeom.map((s, i) => s.area && (
          <path key={`area-${i}`} d={s.area} fill={useThresh ? `url(#thresharea-${uid})` : `url(#grad-${uid}-${i})`} />
        ))}

        {/* Lines */}
        {seriesGeom.map((s, i) => s.line && (
          <path
            key={`line-${i}`}
            d={s.line}
            stroke={useThresh ? `url(#thresh-${uid})` : s.color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#shadow-${uid})`}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Dots on data points — stroke colored by each point's target status when enabled */}
        {seriesGeom.map((s, i) =>
          s.pts.map((p, idx) => p && (
            <circle
              key={`dot-${i}-${idx}`}
              cx={p.x} cy={p.y} r={3}
              fill="var(--color-bg)"
              stroke={useThresh ? (statusColor(s.values[idx]) ?? s.color) : s.color}
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

        {/* ─── HOVER LAYER ─── crosshair + highlighted dots */}
        {safeHoverIdx !== null && hoverX !== null && (
          <g pointerEvents="none">
            {/* Vertical crosshair */}
            <line
              x1={hoverX} x2={hoverX}
              y1={MT} y2={MT + plotH}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.35}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* Halo + emphasized dot for each series at the hovered index */}
            {seriesGeom.map((s, i) => {
              const p = s.pts[safeHoverIdx];
              if (!p) return null;
              const hc = useThresh ? (statusColor(s.values[safeHoverIdx]) ?? s.color) : s.color;
              return (
                <g key={`hover-${i}`}>
                  <circle cx={p.x} cy={p.y} r={7} fill={hc} opacity={0.18} />
                  <circle
                    cx={p.x} cy={p.y} r={4}
                    fill={hc}
                    stroke="var(--color-bg)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* ─── TOOLTIP ─── HTML overlay so text doesn't stretch with preserveAspectRatio="none" */}
      {safeHoverIdx !== null && hoverPct !== null && (
        <Tooltip
          xPct={hoverPct}
          date={dates[safeHoverIdx]}
          series={seriesGeom.map(s => ({
            name: s.name,
            color: s.color,
            value: s.values[safeHoverIdx],
          }))}
          unit={unit}
          target={target}
          lowerBetter={lowerBetter}
        />
      )}

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

/* ─── Tooltip ─────────────────────────────────────────────── */

function Tooltip({
  xPct, date, series, unit, target, lowerBetter,
}: {
  xPct: number;
  date: string;
  series: Array<{ name: string; color: string; value: number | null }>;
  unit: string;
  target?: number;
  lowerBetter?: boolean;
}) {
  const d = new Date(date + 'T12:00:00');
  const dateLabel = `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} · ${DAYS_SHORT[d.getDay()]}`;

  // Anchor smart so the tooltip doesn't run off either edge.
  // <15%  : pin to the left edge (no translate)
  // >85%  : pin to the right edge (translate -100%)
  // else  : center on the cursor x (translate -50%)
  const nearLeft = xPct < 15;
  const nearRight = xPct > 85;
  const leftStyle = nearLeft ? '0%' : nearRight ? '100%' : `${xPct}%`;
  const transformStyle =
    nearLeft ? 'translateX(0)' :
    nearRight ? 'translateX(-100%)' :
    'translateX(-50%)';

  return (
    <div
      className="absolute top-1.5 z-10 pointer-events-none px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-md shadow-2xl shadow-black/40 min-w-[140px]"
      style={{ left: leftStyle, transform: transformStyle }}
    >
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-fg-muted)] font-bold mb-1.5 num">
        {dateLabel}
      </div>
      <div className="space-y-1">
        {series.map((s, i) => {
          const v = s.value;
          const present = v != null;
          // Mini delta indicator vs target
          const showDelta = present && target != null;
          const delta = present && target != null
            ? (lowerBetter ? target - v : v - target)
            : null;
          return (
            <div key={i} className="flex items-center gap-2 text-xs leading-tight">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} aria-hidden />
              <span className="font-bold" style={{ color: s.color }}>{s.name}</span>
              <span className="num font-bold ml-auto" style={{ color: present ? s.color : 'var(--color-fg-dim)' }}>
                {present ? v : '—'}{present && unit ? unit : ''}
              </span>
              {showDelta && delta != null && Math.abs(delta) >= 1 && (
                <span
                  className="num text-[9px] font-bold"
                  style={{ color: delta > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}
                >
                  {delta > 0 ? '↑' : '↓'}{Math.abs(Math.round(delta))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {target != null && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--color-border)] flex items-center gap-1.5 text-[10px] num text-[var(--color-fg-muted)]">
          <span className="inline-block w-3 border-t border-dashed border-current opacity-70" aria-hidden />
          <span>target {lowerBetter ? '≤' : '≥'} {target}{unit}</span>
        </div>
      )}
    </div>
  );
}
