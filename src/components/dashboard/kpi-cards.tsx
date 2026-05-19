'use client';
import { useState } from 'react';
import {
  type SleepEntry,
  ssColor, hrvColor, remColor, rhrColor,
  lastNDays,
} from '@/lib/sleep';
import { Sparkline } from '@/components/ui/sparkline';
import type { MetricKey } from '@/components/dashboard/metric-detail-modal';

/**
 * KPI Cards — Sleep Score / REM / HRV / RHR (the "Metrics de Aur").
 *
 * Each card:
 *  - tiny uppercase label + colored target-vs-actual pill ("+9 ✓" / "-12 sub target")
 *  - giant number (the headline)
 *  - delta vs yesterday + inline sparkline
 *  - colored bottom-border accent (data-ink ratio: minimal chrome)
 *
 * The bottom border glows in the metric's semantic color.
 */
export function KpiCards({ entries, user, onMetricClick }: {
  entries: SleepEntry[];
  user: string;
  onMetricClick?: (metric: MetricKey) => void;
}) {
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
  const rhrSeries = dates.map(d => get(d)?.rhr ?? null);

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
  const rhrDelta = (prev && last.rhr > 0 && prev.rhr > 0) ? last.rhr - prev.rhr : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <KpiCard
        label="Sleep Score"
        value={last.ss}
        unit="/100"
        sparkUnit=""
        delta={ssDelta}
        deltaUnit="pts"
        higherBetter
        target={75}
        series={ssSeries}
        dates={dates}
        color={ssColor(last.ss)}
        accentVar="var(--color-accent)"
        onClick={onMetricClick ? () => onMetricClick('ss') : undefined}
      />
      <KpiCard
        label="REM"
        value={last.rem}
        unit="min"
        sparkUnit="m"
        delta={remDelta}
        deltaUnit="min"
        higherBetter
        target={90}
        series={remSeries}
        dates={dates}
        color={last.rem != null ? remColor(last.rem) : 'var(--color-fg-dim)'}
        accentVar="#a78bfa"
        onClick={onMetricClick ? () => onMetricClick('rem') : undefined}
      />
      <KpiCard
        label="HRV"
        value={last.hrv}
        unit="ms"
        sparkUnit=""
        delta={hrvDelta}
        deltaUnit="ms"
        higherBetter
        target={45}
        series={hrvSeries}
        dates={dates}
        color={hrvColor(last.hrv)}
        accentVar="#fbbf24"
        onClick={onMetricClick ? () => onMetricClick('hrv') : undefined}
      />
      <KpiCard
        label="RHR"
        value={last.rhr > 0 ? last.rhr : null}
        unit="bpm"
        sparkUnit=""
        delta={rhrDelta}
        deltaUnit="bpm"
        higherBetter={false}
        target={60}
        series={rhrSeries}
        dates={dates}
        color={last.rhr > 0 ? rhrColor(last.rhr) : 'var(--color-fg-dim)'}
        accentVar="#fb7185"
        onClick={onMetricClick ? () => onMetricClick('rhr') : undefined}
      />
    </div>
  );
}

function KpiCard({
  label, value, unit, sparkUnit, delta, deltaUnit,
  higherBetter, target, series, dates, color, accentVar, onClick,
}: {
  label: string;
  value: number | null;
  unit: string;
  sparkUnit: string;
  delta: number | null;
  deltaUnit: string;
  higherBetter: boolean;
  target: number;
  series: (number | null)[];
  dates: string[];
  color: string;
  accentVar: string;
  onClick?: () => void;
}) {
  const deltaPositive = delta != null && (higherBetter ? delta > 0 : delta < 0);
  const deltaNegative = delta != null && (higherBetter ? delta < 0 : delta > 0);
  const deltaColor = deltaPositive ? 'var(--color-good)' : deltaNegative ? 'var(--color-bad)' : 'var(--color-fg-muted)';
  const deltaArrow = delta == null ? '·' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  // ─── Target vs actual ───────────────────────────────────
  // Positive `vsTarget` = above target in the "good" direction.
  // For SS/REM/HRV that's value - target.
  // For RHR (lower better) that's target - value.
  const vsTarget = value != null
    ? (higherBetter ? value - target : target - value)
    : null;
  const onTarget = vsTarget != null && vsTarget >= 0;
  const targetPillBg = vsTarget == null
    ? 'transparent'
    : onTarget ? 'color-mix(in srgb, var(--color-good) 14%, transparent)'
               : 'color-mix(in srgb, var(--color-bad) 14%, transparent)';
  const targetPillColor = vsTarget == null
    ? 'var(--color-fg-dim)'
    : onTarget ? 'var(--color-good)' : 'var(--color-bad)';

  const [hovered, setHovered] = useState(false);

  // One-line verdict for the hover preview.
  const verdict = (() => {
    if (delta == null) return { text: 'prima măsurătoare cu date', color: 'var(--color-fg-muted)' };
    if (delta === 0) return { text: 'la fel ca ieri', color: 'var(--color-fg-muted)' };
    const good = higherBetter ? delta > 0 : delta < 0;
    return good
      ? { text: 'în creștere față de ieri', color: 'var(--color-good)' }
      : { text: 'în scădere față de ieri', color: 'var(--color-bad)' };
  })();

  const Tag = onClick ? 'button' : 'div';
  return (
    <div
      className={`relative ${hovered ? 'z-30' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-label={onClick ? `Vezi detalii ${label}` : undefined}
      className={`kpi card w-full px-4 lg:px-5 py-4 lg:py-5 flex flex-col text-left ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.99] transition-all' : ''}`}
      style={{ ['--kpi-accent' as string]: accentVar }}
    >
      {/* Top row — label + target pill */}
      <div className="flex items-center justify-between mb-2 gap-1.5">
        <span className="label">{label}</span>
        {vsTarget != null ? (
          <span
            className="num text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: targetPillBg, color: targetPillColor }}
            title={`target ${higherBetter ? '≥' : '≤'} ${target}${unit}`}
          >
            {onTarget ? '+' : ''}{vsTarget} {onTarget ? '✓' : 'sub'}
          </span>
        ) : (
          <span className="text-[9px] num text-[var(--color-fg-dim)]">
            target {higherBetter ? '≥' : '≤'} {target}
          </span>
        )}
      </div>

      {/* Headline number */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="num font-bold leading-none text-4xl lg:text-5xl tracking-tight"
          style={{ color: value == null ? 'var(--color-fg-dim)' : color }}
        >
          {value ?? '—'}
        </span>
        <span className="text-xs text-[var(--color-fg-muted)] font-medium">{unit}</span>
      </div>

      {/* Bottom row — delta + sparkline */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="text-[11px] num font-bold flex items-center gap-1"
          style={{ color: deltaColor }}
        >
          <span>{deltaArrow}</span>
          {delta != null ? (
            <>{Math.abs(delta)}{deltaUnit} vs ieri</>
          ) : (
            <span className="text-[var(--color-fg-dim)]">prima măsurătoare</span>
          )}
        </span>
        <Sparkline values={series} dates={dates} unit={sparkUnit} width={56} height={20} color={color} />
      </div>
    </Tag>

      {/* Hover preview — desktop peek: bigger chart + delta + target + verdict */}
      {hovered && (
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl shadow-black/40 p-3 pointer-events-none fade-in-up">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="label">{label}</span>
            <span className="num font-bold text-lg leading-none" style={{ color: value == null ? 'var(--color-fg-dim)' : color }}>
              {value ?? '—'}<span className="text-[10px] text-[var(--color-fg-dim)] font-medium ml-0.5">{unit}</span>
            </span>
          </div>
          <Sparkline values={series} dates={dates} unit={sparkUnit} color={color} width={232} height={44} />
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--color-border)]/60 text-[11px] num">
            <span className="flex items-center gap-1 font-bold" style={{ color: deltaColor }}>
              <span aria-hidden>{deltaArrow}</span>
              {delta != null ? <>{Math.abs(delta)}{deltaUnit} vs ieri</> : <span className="text-[var(--color-fg-dim)]">prima</span>}
            </span>
            {vsTarget != null && (
              <span className="num font-bold" style={{ color: targetPillColor }}>
                {onTarget ? '✓ peste' : 'sub'} target {higherBetter ? '≥' : '≤'} {target}
              </span>
            )}
          </div>
          <div className="text-[10px] mt-1.5 leading-snug" style={{ color: verdict.color }}>{verdict.text}</div>
        </div>
      )}
    </div>
  );
}
