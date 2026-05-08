/* Big metric display — the hero number */
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: number | string | null;
  unit?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  trend?: { value: number; positive: boolean };
  className?: string;
}

const SIZE = {
  sm: { num: 'text-2xl', label: 'text-[10px]' },
  md: { num: 'text-4xl', label: 'text-[10px]' },
  lg: { num: 'text-6xl', label: 'text-xs' },
  xl: { num: 'text-7xl md:text-8xl', label: 'text-xs' },
} as const;

export function Metric({ label, value, unit, color = '#fafafa', size = 'md', trend, className }: Props) {
  const display = value == null ? '—' : value;
  const isMissing = value == null;
  const s = SIZE[size];
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className={cn('label', s.label)}>{label}</div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn('num font-bold leading-none', s.num)}
          style={{ color: isMissing ? '#52525b' : color }}
        >
          {display}
        </span>
        {unit && !isMissing && (
          <span className="text-xs text-[var(--color-fg-muted)] font-medium tracking-tight">{unit}</span>
        )}
        {trend && (
          <span className={cn('text-xs num font-bold', trend.positive ? 'text-emerald-400' : 'text-red-400')}>
            {trend.positive ? '↑' : '↓'}{Math.abs(trend.value)}
          </span>
        )}
      </div>
    </div>
  );
}
