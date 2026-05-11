'use client';
import {
  type SleepEntry,
  ssColor, hrvColor, remColor,
  lastNDays,
} from '@/lib/sleep';
import { Sparkline } from '@/components/ui/sparkline';

/**
 * KPI Cards — Sleep Score / REM / HRV (the "Metrics de Aur").
 *
 * Each card:
 *  - tiny uppercase label up top
 *  - giant number (the headline)
 *  - delta vs yesterday or status indicator
 *  - inline sparkline (last 7 days)
 *  - colored bottom-border accent (data-ink ratio: minimal chrome)
 *
 * The bottom border glows in the metric's semantic color.
 */
export function KpiCards({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const mine = entries
    .filter(e => e.name === user)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = mine[mine.length - 1] ?? null;
  const prev = mine[mine.length - 2] ?? null;

  // 7-day series for sparklines
  const last7 = lastNDays(entries.filter(e => e.name === user), 7);
  const dates = [...new Set(last7.map(e => e.date))].sort();
  const get = (d: string) => last7.find(e => e.date === d) ?? null;
  const ssSeries  = dates.map(d => get(d)?.ss ?? null);
  const remSeries = dates.map(d => get(d)?.rem ?? null);
  const hrvSeries = dates.map(d => get(d)?.hrv ?? null);

  if (!last) {
    return (
      <div className="card flex items-center justify-center px-6 py-10 text-center">
        <div>
          <div className="text-3xl mb-2">🌙</div>
          <div className="text-sm text-[var(--color-fg-muted)]">
            Niciun log încă. Loghează prima dată pentru a vedea KPI-urile.
          </div>
        </div>
      </div>
    );
  }

  const ssDelta  = prev ? last.ss - prev.ss : null;
  const remDelta = (prev && last.rem != null && prev.rem != null) ? last.rem - prev.rem : null;
  const hrvDelta = (prev && last.hrv != null && prev.hrv != null) ? last.hrv - prev.hrv : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
      <KpiCard
        label="Sleep Score"
        value={last.ss}
        unit="/100"
        delta={ssDelta}
        deltaUnit="pts"
        higherBetter
        target={75}
        series={ssSeries}
        color={ssColor(last.ss)}
        accentVar="var(--color-accent)"
      />
      <KpiCard
        label="REM"
        value={last.rem}
        unit="min"
        delta={remDelta}
        deltaUnit="min"
        higherBetter
        target={90}
        series={remSeries}
        color={last.rem != null ? remColor(last.rem) : 'var(--color-fg-dim)'}
        accentVar="#a78bfa"
      />
      <KpiCard
        label="HRV"
        value={last.hrv}
        unit="ms"
        delta={hrvDelta}
        deltaUnit="ms"
        higherBetter
        target={45}
        series={hrvSeries}
        color={hrvColor(last.hrv)}
        accentVar="#fbbf24"
      />
    </div>
  );
}

function KpiCard({
  label, value, unit, delta, deltaUnit,
  higherBetter, target, series, color, accentVar,
}: {
  label: string;
  value: number | null;
  unit: string;
  delta: number | null;
  deltaUnit: string;
  higherBetter: boolean;
  target: number;
  series: (number | null)[];
  color: string;
  accentVar: string;
}) {
  const deltaPositive = delta != null && (higherBetter ? delta > 0 : delta < 0);
  const deltaNegative = delta != null && (higherBetter ? delta < 0 : delta > 0);
  const deltaColor = deltaPositive ? 'var(--color-good)' : deltaNegative ? 'var(--color-bad)' : 'var(--color-fg-muted)';
  const deltaArrow = delta == null ? '·' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const onTarget = value != null && (higherBetter ? value >= target : value <= target);

  return (
    <div
      className="kpi card px-5 py-4 lg:py-5 flex flex-col"
      style={{ ['--kpi-accent' as string]: accentVar }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="label">{label}</span>
        <span className="text-[9px] num text-[var(--color-fg-dim)]">
          target {higherBetter ? '≥' : '≤'} {target}{unit}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="num font-bold leading-none text-5xl lg:text-6xl tracking-tight"
          style={{ color: value == null ? 'var(--color-fg-dim)' : color }}
        >
          {value ?? '—'}
        </span>
        <span className="text-sm text-[var(--color-fg-muted)] font-medium">{unit}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="text-[11px] num font-bold flex items-center gap-1"
          style={{ color: deltaColor }}
        >
          <span>{deltaArrow}</span>
          {delta != null ? (
            <>
              {Math.abs(delta)}{deltaUnit} vs ieri
            </>
          ) : (
            <span className="text-[var(--color-fg-dim)]">{onTarget ? 'în target' : 'sub target'}</span>
          )}
        </span>
        <Sparkline values={series} width={70} height={22} color={color} />
      </div>
    </div>
  );
}
