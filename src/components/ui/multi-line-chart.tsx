import { useId } from 'react';
import { cn } from '@/lib/utils';

interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

interface Props {
  series: Series[];
  width?: number;
  height?: number;
  className?: string;
  showLegend?: boolean;
  /** Optional target horizontal line value */
  target?: number;
  targetLabel?: string;
}

/**
 * Multi-line chart for comparing the team. Each series renders as its own
 * colored line. SVG stretches to container via preserveAspectRatio='none'.
 */
export function MultiLineChart({
  series,
  width = 400,
  height = 100,
  className,
  showLegend = true,
  target,
  targetLabel,
}: Props) {
  const id = useId();

  // Find global min/max across all series (for shared y-axis)
  const allValues = series.flatMap(s => s.values).filter((v): v is number => v != null);
  if (allValues.length < 2) {
    return <div className={cn('text-[10px] text-zinc-600 italic', className)}>insuficient</div>;
  }

  const min = Math.min(...allValues, target ?? Infinity);
  const max = Math.max(...allValues, target ?? -Infinity);
  const range = max - min || 1;
  const padY = 12;

  const yFor = (v: number) => height - padY - ((v - min) / range) * (height - padY * 2);

  // Build a path for one series, skipping nulls
  const buildPath = (values: (number | null)[]) => {
    let d = '';
    let prev = false;
    values.forEach((v, i) => {
      if (v == null) { prev = false; return; }
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = yFor(v);
      d += prev ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      prev = true;
    });
    return d;
  };

  const targetY = target != null ? yFor(target) : null;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-32 sm:h-40"
        aria-hidden
      >
        {/* Target horizontal line */}
        {targetY != null && (
          <>
            <line
              x1={0}
              x2={width}
              y1={targetY}
              y2={targetY}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Lines per series */}
        {series.map((s, i) => (
          <path
            key={`${id}-${i}`}
            d={buildPath(s.values)}
            stroke={s.color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
        ))}
      </svg>

      {showLegend && (
        <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
          {target != null && targetLabel && (
            <div className="flex items-center gap-1.5 text-[var(--color-fg-dim)]">
              <span className="inline-block w-3 border-t border-dashed border-current opacity-60" />
              <span className="num">{targetLabel} {target}</span>
            </div>
          )}
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: s.color }} />
              <span className="font-semibold" style={{ color: s.color }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
