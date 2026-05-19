'use client';
import { useEffect, useMemo } from 'react';
import {
  type SleepEntry,
  ssColor, remColor, hrvColor, rhrColor,
  ssTier, remTier, hrvTier, rhrTier,
  lastNDays,
} from '@/lib/sleep';
import { fmtDate } from '@/lib/utils';
import { MultiLineChart } from '@/components/ui/multi-line-chart';

export type MetricKey = 'ss' | 'rem' | 'hrv' | 'rhr';

interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: string;
  target: number;
  higherBetter: boolean;
  color: (v: number | null) => string;
  tier: (v: number | null) => { label: string; color: string };
  /** Pull the metric value off an entry (or null when missing) */
  value: (e: SleepEntry) => number | null;
}

const SPECS: Record<MetricKey, MetricSpec> = {
  ss: {
    key: 'ss',
    label: 'Sleep Score',
    unit: '/100',
    target: 75,
    higherBetter: true,
    color: (v) => (v == null ? 'var(--color-fg-dim)' : ssColor(v)),
    tier: (v) => (v == null ? { label: '—', color: '#52525b' } : ssTier(v)),
    value: (e) => e.ss,
  },
  rem: {
    key: 'rem',
    label: 'REM',
    unit: 'min',
    target: 90,
    higherBetter: true,
    color: (v) => remColor(v),
    tier: (v) => remTier(v),
    value: (e) => e.rem,
  },
  hrv: {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    target: 45,
    higherBetter: true,
    color: (v) => hrvColor(v),
    tier: (v) => hrvTier(v),
    value: (e) => e.hrv,
  },
  rhr: {
    key: 'rhr',
    label: 'RHR',
    unit: 'bpm',
    target: 60,
    higherBetter: false,
    color: (v) => (v == null || v <= 0 ? 'var(--color-fg-dim)' : rhrColor(v)),
    tier: (v) => (v == null || v <= 0 ? { label: '—', color: '#52525b' } : rhrTier(v)),
    value: (e) => (e.rhr > 0 ? e.rhr : null),
  },
};

/**
 * Per-metric detail modal — opens when a KPI card is clicked.
 *
 * Layout: bottom-sheet on mobile, centered card on md+.
 * Sections (from top): header → headline + delta + target pill → 30d trend
 * chart with target line → 4 quick stats (avg 7d / avg 30d / best ever /
 * total logs) → full descending history list.
 */
export function MetricDetailModal({
  metric, entries, user, onClose,
}: {
  metric: MetricKey | null;
  entries: SleepEntry[];
  user: string;
  onClose: () => void;
}) {
  // Lock scroll + listen for Escape while open.
  useEffect(() => {
    if (!metric) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [metric, onClose]);

  const spec = metric ? SPECS[metric] : null;

  const stats = useMemo(() => {
    if (!spec) return null;
    const mine = entries
      .filter((e) => e.name === user)
      .sort((a, b) => a.date.localeCompare(b.date));
    const present = mine
      .map((e) => ({ date: e.date, v: spec.value(e) }))
      .filter((r): r is { date: string; v: number } => r.v != null);

    if (!present.length) {
      return { mine, present, last: null, prev: null, avg7: null, avg30: null, best: null };
    }

    const last = present[present.length - 1];
    const prev = present.length > 1 ? present[present.length - 2] : null;

    const within = (days: number) => {
      const win = lastNDays(
        mine.map((e) => ({ ...e })) as SleepEntry[],
        days,
      );
      const winVals = win
        .map((e) => spec.value(e))
        .filter((v): v is number => v != null);
      return winVals.length
        ? Math.round(winVals.reduce((s, v) => s + v, 0) / winVals.length)
        : null;
    };

    const avg7 = within(7);
    const avg30 = within(30);
    const best = spec.higherBetter
      ? Math.max(...present.map((p) => p.v))
      : Math.min(...present.map((p) => p.v));

    return { mine, present, last, prev, avg7, avg30, best };
  }, [entries, spec, user]);

  if (!metric || !spec || !stats) return null;

  const { present, last, prev, avg7, avg30, best } = stats;

  // Build the 30-day chart series — use the same date axis density.
  const last30 = lastNDays(
    entries.filter((e) => e.name === user) as SleepEntry[],
    30,
  );
  const dates30 = [...new Set(last30.map((e) => e.date))].sort();
  const series30 = dates30.map((d) => {
    const e = last30.find((x) => x.date === d);
    return e ? spec.value(e) : null;
  });

  // Delta vs previous measurement, and target-vs-actual pill maths (same
  // shape as KpiCards so the UX feels consistent).
  const delta = last && prev ? last.v - prev.v : null;
  const deltaPositive = delta != null && (spec.higherBetter ? delta > 0 : delta < 0);
  const deltaNegative = delta != null && (spec.higherBetter ? delta < 0 : delta > 0);
  const deltaColor = deltaPositive
    ? 'var(--color-good)'
    : deltaNegative
    ? 'var(--color-bad)'
    : 'var(--color-fg-muted)';
  const deltaArrow = delta == null ? '·' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  const vsTarget = last
    ? spec.higherBetter ? last.v - spec.target : spec.target - last.v
    : null;
  const onTarget = vsTarget != null && vsTarget >= 0;
  const targetPillBg = vsTarget == null
    ? 'transparent'
    : onTarget
    ? 'color-mix(in srgb, var(--color-good) 14%, transparent)'
    : 'color-mix(in srgb, var(--color-bad) 14%, transparent)';
  const targetPillColor = vsTarget == null
    ? 'var(--color-fg-dim)'
    : onTarget
    ? 'var(--color-good)'
    : 'var(--color-bad)';

  const lastValue = last?.v ?? null;
  const valueColor = spec.color(lastValue);
  const lastTier = spec.tier(lastValue);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 fade-in-up"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-[var(--color-bg)] w-full md:max-w-2xl max-h-[92vh] rounded-t-3xl md:rounded-2xl border border-[var(--color-border)] shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${spec.label} — detalii`}
      >
        {/* Header */}
        <header className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">{spec.label}</h2>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: lastTier.color + '20', color: lastTier.color }}
              >
                {lastTier.label}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-fg-muted)] mt-1 num">
              target {spec.higherBetter ? '≥' : '≤'} {spec.target}{spec.unit}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="shrink-0 w-9 h-9 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          {/* Headline + delta + target pill */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="num font-bold leading-none text-5xl tracking-tight"
                  style={{ color: valueColor }}
                >
                  {lastValue ?? '—'}
                </span>
                <span className="text-sm text-[var(--color-fg-muted)] font-medium">{spec.unit}</span>
              </div>
              <div className="text-[11px] num mt-2 flex items-center gap-1" style={{ color: deltaColor }}>
                <span aria-hidden>{deltaArrow}</span>
                {delta != null ? (
                  <span>{Math.abs(delta)}{spec.key === 'rem' ? 'min' : ''} vs ultima</span>
                ) : (
                  <span className="text-[var(--color-fg-dim)]">prima măsurătoare</span>
                )}
              </div>
            </div>
            {vsTarget != null && (
              <span
                className="num text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: targetPillBg, color: targetPillColor }}
              >
                {onTarget ? '+' : ''}{vsTarget} {onTarget ? '✓ peste target' : 'sub target'}
              </span>
            )}
          </div>

          {/* 30-day trend chart */}
          {present.length >= 2 && (
            <div className="mb-5">
              <div className="label mb-2">Evoluție · ultimele 30 de zile</div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
                <MultiLineChart
                  series={[{ name: spec.label, color: valueColor === 'var(--color-fg-dim)' ? '#a3e635' : valueColor, values: series30 }]}
                  width={560}
                  height={140}
                  className="w-full"
                  showLegend={false}
                  target={spec.target}
                  targetLabel={`target ${spec.higherBetter ? '≥' : '≤'} ${spec.target}`}
                />
              </div>
            </div>
          )}

          {/* Quick stats grid */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCell label="medie 7z" value={avg7} unit={spec.unit} color={spec.color(avg7)} />
            <StatCell label="medie 30z" value={avg30} unit={spec.unit} color={spec.color(avg30)} />
            <StatCell label={spec.higherBetter ? 'best' : 'cel mai mic'} value={best} unit={spec.unit} color={spec.color(best)} />
            <StatCell label="total loguri" value={present.length} unit="" color="var(--color-fg)" />
          </div>

          {/* History list */}
          <div>
            <div className="label mb-2">Toate măsurătorile</div>
            <div className="space-y-1.5">
              {[...present].reverse().map((p) => {
                const tier = spec.tier(p.v);
                return (
                  <div
                    key={p.date}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: tier.color }}
                        aria-hidden
                      />
                      <span className="text-xs text-[var(--color-fg)] truncate">{fmtDate(p.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="num font-bold text-sm" style={{ color: spec.color(p.v) }}>
                        {p.v}<span className="text-[10px] text-[var(--color-fg-dim)] font-normal ml-0.5">{spec.unit}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {present.length === 0 && (
                <div className="text-xs text-[var(--color-fg-muted)] italic text-center py-6">
                  Niciun log încă pentru această metrică.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, unit, color }: {
  label: string; value: number | null; unit: string; color: string;
}) {
  return (
    <div
      className="rounded-xl px-2 py-2.5 text-center"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="num font-bold text-base leading-none" style={{ color: value == null ? 'var(--color-fg-dim)' : color }}>
        {value ?? '—'}
      </div>
      <div className="text-[9px] text-[var(--color-fg-muted)] mt-1 leading-tight">{label}{unit ? ` · ${unit}` : ''}</div>
    </div>
  );
}
