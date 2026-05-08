/* Tiny SVG sparkline — replaces Chart.js for inline visuals */
import { cn } from '@/lib/utils';

interface Props {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = '#a3e635',
  showDots = false,
  className,
}: Props) {
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

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)}>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && pts.map((p, i) => p && (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />
      ))}
      {/* highlight last point */}
      {(() => {
        const last = [...pts].reverse().find(p => p) ?? null;
        return last ? <circle cx={last.x} cy={last.y} r={2.5} fill={color} /> : null;
      })()}
    </svg>
  );
}
