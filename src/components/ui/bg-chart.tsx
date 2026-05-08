/* Background area chart — fills its parent absolutely with a soft
   gradient + line. Designed to live BEHIND content (numbers/labels)
   in metric cards. preserveAspectRatio='none' lets it stretch to
   fit the parent without leaving whitespace.

   Use inside a `position: relative` parent with overflow hidden. */
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  values: (number | null)[];
  color?: string;
  className?: string;
  /** 0-1, multiplies the line opacity and area gradient. Default 1. */
  intensity?: number;
}

export function BgChart({ values, color = '#a3e635', className, intensity = 1 }: Props) {
  const gradId = useId();
  const present = values.filter((v): v is number => v != null);
  if (present.length < 2) return null;

  // Internal viewBox; preserveAspectRatio='none' stretches to parent
  const W = 400;
  const H = 100;
  const padY = 8;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    if (v == null) return null;
    const x = (i / Math.max(values.length - 1, 1)) * W;
    const y = H - padY - ((v - min) / range) * (H - padY * 2);
    return { x, y };
  });

  // Build paths — line through valid points, area = line + bottom edge
  let line = '';
  let prev: { x: number; y: number } | null = null;
  for (const p of pts) {
    if (!p) { prev = null; continue; }
    line += prev ? ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    prev = p;
  }

  // Close area down to bottom for the fill
  const validPts = pts.filter((p): p is { x: number; y: number } => p !== null);
  const firstX = validPts[0]?.x ?? 0;
  const lastX = validPts[validPts.length - 1]?.x ?? 0;
  const area = line ? `${line} L ${lastX.toFixed(1)} ${H} L ${firstX.toFixed(1)} ${H} Z` : '';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('absolute inset-0 w-full h-full pointer-events-none', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35 * intensity} />
          <stop offset="60%" stopColor={color} stopOpacity={0.10 * intensity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.65 * intensity}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
