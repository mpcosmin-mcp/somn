'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry,
  NAMES, FIRST_NAME, personColor,
  lastNDays,
} from '@/lib/sleep';
import { Card } from '@/components/ui/card';
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
 * Team Chart Pane — the multi-metric stacked chart with tabs.
 *
 *   ─ Header: metric label · range tabs (7 / 30 / all)
 *   ─ Metric tabs: SS / REM / RHR / HRV (target indicator on the right)
 *   ─ Big chart with all 3 teammates overlaid, target line, smooth Bezier
 *
 * Lives on the main dashboard now (no more /detail page).
 */
export function TeamChartPane({ entries }: { entries: SleepEntry[] }) {
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
    <Card className="p-4 sm:p-5 space-y-4">
      {/* Header — title + range tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="label">istoric echipă · toți pe același chart</div>
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
        height={280}
        target={meta.target}
        targetLabel="target"
        unit={meta.unit}
        lowerBetter={meta.lowerBetter}
      />
    </Card>
  );
}
