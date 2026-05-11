'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry, NAMES, FIRST_NAME, personColor, ssColor, rhrColor, hrvColor, remColor,
  lastNDays,
} from '@/lib/sleep';
import { fmtDateShort } from '@/lib/utils';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { TeamChart } from '@/components/ui/team-chart';

type Range = '7' | '30' | 'all';
type Metric = 'ss' | 'rem' | 'rhr' | 'hrv';

const METRIC_META: Record<Metric, { label: string; unit: string; target: number; lowerBetter?: boolean }> = {
  ss:  { label: 'Sleep Score', unit: '',    target: 75 },
  rem: { label: 'REM',         unit: 'min', target: 90 },
  rhr: { label: 'RHR',         unit: 'bpm', target: 60, lowerBetter: true },
  hrv: { label: 'HRV',         unit: 'ms',  target: 45 },
};

/**
 * Team history view — the "social" page where you see everyone.
 *
 * Layout (top → bottom):
 *   1. Team Leaderboard (champion banner + rows with medals + fun badges)
 *   2. Stacked Team Chart (one big chart with metric tabs, all 3 users overlaid)
 *   3. Per-user recent activity breakdown (last 14 days, side-by-side mini tables)
 */
export function TeamHistory({ entries, currentUser }: { entries: SleepEntry[]; currentUser: string }) {
  const [range, setRange] = useState<Range>('30');
  const [metric, setMetric] = useState<Metric>('ss');

  const scoped = useMemo(() => {
    if (range === 'all') return entries;
    return lastNDays(entries, parseInt(range));
  }, [entries, range]);

  const allDates = useMemo(
    () => [...new Set(scoped.map(e => e.date))].sort(),
    [scoped],
  );

  const series = useMemo(() => {
    return NAMES.map(n => {
      const personMap = new Map(scoped.filter(e => e.name === n).map(e => [e.date, e]));
      const values = allDates.map(d => {
        const v = personMap.get(d);
        return v ? (v[metric] as number | null) ?? null : null;
      });
      return {
        name: FIRST_NAME[n] ?? n.split(' ')[0],
        color: personColor(n),
        values,
      };
    });
  }, [scoped, allDates, metric]);

  const meta = METRIC_META[metric];

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* 1. LEADERBOARD — medals + champion banner + fun badges */}
      <div id="istoric">
        <Leaderboard entries={entries} currentUser={currentUser} />
      </div>

      {/* 2. STACKED CHART — all 3 users on one big chart */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="label">istoric · toți 3 pe același chart</div>
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
            target {meta.lowerBetter ? '< ' : ''}{meta.target}{meta.unit}
          </span>
        </div>

        <TeamChart
          series={series}
          dates={allDates}
          height={300}
          target={meta.target}
          targetLabel="target"
          unit={meta.unit}
          lowerBetter={meta.lowerBetter}
        />
      </Card>

      {/* 3. PER-USER RECENT ACTIVITY (last 14 days, all 3 columns side by side) */}
      <Card className="p-4 sm:p-5">
        <div className="label mb-3">ultimele 14 zile · pe rând per persoană</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {NAMES.map(n => (
            <UserRecentBlock key={n} name={n} entries={entries} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function UserRecentBlock({ name, entries }: { name: string; entries: SleepEntry[] }) {
  const c = personColor(name);
  const last14 = useMemo(
    () => lastNDays(entries.filter(e => e.name === name), 14).sort((a, b) => b.date.localeCompare(a.date)),
    [entries, name],
  );
  const fn = FIRST_NAME[name] ?? name.split(' ')[0];

  return (
    <div
      className="rounded-xl border p-3 relative overflow-hidden"
      style={{ borderColor: `${c}30`, background: `linear-gradient(135deg, ${c}0a, transparent 60%)` }}
    >
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b" style={{ borderColor: `${c}20` }}>
        <Avi name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: c }}>{fn}</div>
          <div className="text-[9px] text-[var(--color-fg-muted)] num">{last14.length} loguri</div>
        </div>
      </div>

      {last14.length === 0 ? (
        <div className="text-[10px] text-[var(--color-fg-dim)] italic text-center py-4">
          niciun log în 14 zile
        </div>
      ) : (
        <div className="space-y-1 num text-[10px]">
          {last14.slice(0, 10).map(e => (
            <div key={e.date} className="flex items-center gap-1.5">
              <span className="text-[var(--color-fg-muted)] w-14 shrink-0">{fmtDateShort(e.date)}</span>
              <span className="flex-1 flex items-center justify-end gap-1.5 flex-wrap">
                <Chip value={e.ss} unit="SS" color={ssColor(e.ss)} />
                <Chip value={e.rem} unit="m" color={e.rem != null ? remColor(e.rem) : '#52525b'} />
                <Chip value={e.rhr} unit="r" color={rhrColor(e.rhr)} />
                <Chip value={e.hrv} unit="h" color={hrvColor(e.hrv)} />
              </span>
            </div>
          ))}
          {last14.length > 10 && (
            <div className="text-[9px] text-[var(--color-fg-dim)] text-center pt-1">
              +{last14.length - 10} mai vechi
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ value, unit, color }: { value: number | null; unit: string; color: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-0.5 font-bold"
      style={{ color: value == null ? '#52525b' : color }}
    >
      {value ?? '—'}
      <span className="text-[8px] opacity-70 font-normal">{unit}</span>
    </span>
  );
}
