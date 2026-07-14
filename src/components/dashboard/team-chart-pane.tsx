'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry,
  NAMES, FIRST_NAME, personColor, personSex, rhrCutoffs,
  sleepDurationMin, fmtDuration, DUR_TARGET,
  lastNDays,
} from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { TeamChart } from '@/components/ui/team-chart';

type Range = '7' | '30' | 'all';
type Metric = 'ss' | 'rem' | 'rhr' | 'hrv' | 'dur';

const METRIC_META: Record<Metric, { label: string; unit: string; target: number; lowerBetter?: boolean }> = {
  ss:  { label: 'Sleep Score', unit: '',    target: 75 },
  rem: { label: 'REM',         unit: 'min', target: 90 },
  rhr: { label: 'RHR',         unit: 'bpm', target: 60, lowerBetter: true },
  hrv: { label: 'HRV',         unit: 'ms',  target: 45 },
  dur: { label: 'Durată',      unit: 'min', target: DUR_TARGET },
};

/**
 * Team Chart Pane — multi-metric chart with tabs + per-person filter.
 *
 *   ─ Header: title · range tabs (7 / 30 / all)
 *   ─ Metric tabs: SS / REM / RHR / HRV + target indicator
 *   ─ Person filter chips: Toți · Clara · Petrica · Cornel (radio-style)
 *   ─ Big chart — when filtered to one person, the Y-axis auto-zooms on
 *     that person's range so personal variance is more legible.
 */
export function TeamChartPane({ entries }: { entries: SleepEntry[] }) {
  const [range, setRange] = useState<Range>('30');
  const [metric, setMetric] = useState<Metric>('ss');
  // Empty = whole team. 1 = focus. 2+ = head-to-head comparison.
  const [focusUsers, setFocusUsers] = useState<string[]>([]);

  const meta = METRIC_META[metric];

  const scoped = useMemo(() => {
    if (range === 'all') return entries;
    return lastNDays(entries, parseInt(range));
  }, [entries, range]);

  const allDates = useMemo(
    () => [...new Set(scoped.map(e => e.date))].sort(),
    [scoped],
  );

  const usersToShow = focusUsers.length ? focusUsers : (NAMES as readonly string[]);

  const series = useMemo(() => {
    return usersToShow.map(n => {
      const personMap = new Map(scoped.filter(e => e.name === n).map(e => [e.date, e]));
      const values = allDates.map(d => {
        const v = personMap.get(d);
        if (!v) return null;
        if (metric === 'dur') return sleepDurationMin(v.start, v.end);
        return (v[metric] as number | null) ?? null;
      });
      return {
        name: FIRST_NAME[n] ?? n.split(' ')[0],
        color: personColor(n),
        values,
      };
    });
  }, [scoped, allDates, metric, usersToShow]);

  // Per-person target — sex-aware for RHR (Clara's band is +5 bpm), so an
  // out-of-target dot is judged against THAT person's real target.
  const seriesTargets = usersToShow.map(n =>
    metric === 'rhr' ? rhrCutoffs(personSex(n))[1] : meta.target,
  );

  // A single shared target LINE only makes sense when it's the same for everyone
  // shown. For RHR that's only when exactly one person is focused.
  const targetLine = metric === 'rhr'
    ? (focusUsers.length === 1 ? rhrCutoffs(personSex(focusUsers[0]))[1] : undefined)
    : meta.target;

  const toggleUser = (n: string) =>
    setFocusUsers(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      {/* Header — title + range tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="label">
            {focusUsers.length === 0
              ? 'istoric echipă · toți pe același chart'
              : focusUsers.length === 1
                ? `${FIRST_NAME[focusUsers[0]] ?? focusUsers[0].split(' ')[0]} · doar el`
                : `${focusUsers.map(n => FIRST_NAME[n] ?? n.split(' ')[0]).join(' vs ')} · comparație`}
          </div>
          <div className="text-base font-bold">{meta.label}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['7', '30', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                range === r
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {r === '7' ? '7 zile' : r === '30' ? '30 zile' : 'tot'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric tabs */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-3 flex-wrap">
        {(Object.keys(METRIC_META) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
              metric === m
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-fg)] ring-1 ring-[var(--color-accent)]/40'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {METRIC_META[m].label}
          </button>
        ))}
        <span className="text-[10px] text-[var(--color-fg-muted)] ml-auto num">
          target {metric === 'dur' ? fmtDuration(meta.target) : `${meta.lowerBetter ? '< ' : ''}${meta.target}${meta.unit}`}
        </span>
      </div>

      {/* Person filter chips — tap two to compare head-to-head */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="label mr-1">filtru:</span>
        <PersonChip
          label="Toți"
          active={focusUsers.length === 0}
          onClick={() => setFocusUsers([])}
        />
        {NAMES.map(n => {
          const fn = FIRST_NAME[n] ?? n.split(' ')[0];
          const c = personColor(n);
          return (
            <PersonChip
              key={n}
              label={fn}
              color={c}
              active={focusUsers.includes(n)}
              onClick={() => toggleUser(n)}
            />
          );
        })}
        <span className="text-[10px] text-[var(--color-fg-dim)] ml-1">
          {focusUsers.length >= 2 ? 'comparație directă' : 'alege 2 pt. comparație'}
        </span>
      </div>

      <TeamChart
        series={series}
        dates={allDates}
        height={280}
        target={targetLine}
        seriesTargets={seriesTargets}
        targetLabel="target"
        unit={meta.unit}
        lowerBetter={meta.lowerBetter}
        colorByTarget={focusUsers.length === 1}
        fmt={metric === 'dur' ? fmtDuration : undefined}
      />
    </Card>
  );
}

/* ─── Person filter chip ──────────────────────────────────── */

function PersonChip({
  label, color, active, onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  // Inactive: muted outline. Active: filled with that person's color (or accent for "Toți").
  const accent = color ?? 'var(--color-accent)';
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
      style={
        active
          ? {
              background: `${accent}22`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}80`,
            }
          : {
              background: 'transparent',
              color: 'var(--color-fg-muted)',
              boxShadow: 'inset 0 0 0 1px var(--color-border)',
            }
      }
    >
      {label}
    </button>
  );
}
