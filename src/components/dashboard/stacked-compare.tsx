'use client';
import { useMemo, useState } from 'react';
import { type SleepEntry, NAMES, FIRST_NAME, personColor, lastNDays } from '@/lib/sleep';
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
 * Side-by-side team comparison.
 *
 * ONE big polished chart with metric tabs above. Fits in a single screen
 * without scroll. Tabs switch between SS / REM / RHR / HRV.
 */
export function StackedCompare({ entries }: { entries: SleepEntry[] }) {
  const [range, setRange] = useState<Range>('30');
  const [metric, setMetric] = useState<Metric>('ss');

  const scoped = useMemo(() => {
    if (range === 'all') return entries;
    return lastNDays(entries, parseInt(range));
  }, [entries, range]);

  // Build the date axis across all dates that appear
  const allDates = useMemo(
    () => [...new Set(scoped.map(e => e.date))].sort(),
    [scoped],
  );

  // Per-metric series — aligned to allDates
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

  // Per-user stats summary (always all 4 metrics)
  const stats = useMemo(() => {
    const out: Record<string, { ss: number; rhr: number; rem: number | null; hrv: number | null; entries: number }> = {};
    for (const n of NAMES) {
      const theirs = scoped.filter(e => e.name === n);
      if (!theirs.length) { out[n] = { ss: 0, rhr: 0, rem: null, hrv: null, entries: 0 }; continue; }
      const avg = (arr: (number | null)[]) => {
        const v = arr.filter((x): x is number => x != null);
        return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
      };
      out[n] = {
        ss: Math.round(theirs.reduce((s, e) => s + e.ss, 0) / theirs.length),
        rhr: Math.round(theirs.reduce((s, e) => s + e.rhr, 0) / theirs.length),
        rem: avg(theirs.map(e => e.rem)),
        hrv: avg(theirs.map(e => e.hrv)),
        entries: theirs.length,
      };
    }
    return out;
  }, [scoped]);

  const meta = METRIC_META[metric];

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      {/* Header + range tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="label">comparare echipă</div>
          <div className="text-base font-bold">toți 3 pe același chart</div>
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

      {/* Per-user stats summary — compact grid */}
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        <div className="text-[var(--color-fg-muted)] num font-semibold">metric</div>
        {NAMES.map(n => (
          <div key={n} className="text-right font-bold" style={{ color: personColor(n) }}>
            {FIRST_NAME[n]}
          </div>
        ))}

        <StatRow label="SS"   values={NAMES.map(n => stats[n].ss   || '—')} />
        <StatRow label="RHR"  values={NAMES.map(n => stats[n].rhr  || '—')} />
        <StatRow label="REM"  values={NAMES.map(n => stats[n].rem  ?? '—')} unit="min" />
        <StatRow label="HRV"  values={NAMES.map(n => stats[n].hrv  ?? '—')} unit="ms" />
        <StatRow label="logs" values={NAMES.map(n => stats[n].entries)} />
      </div>

      {/* Metric tabs — pick which metric is on the chart */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-3">
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

      {/* THE BIG CHART */}
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
  );
}

function StatRow({ label, values, unit }: { label: string; values: (number | string)[]; unit?: string }) {
  return (
    <>
      <div className="num text-[var(--color-fg-muted)]">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="text-right num font-semibold text-[var(--color-fg)]">
          {v}{unit && typeof v === 'number' && (
            <span className="text-[var(--color-fg-muted)] font-normal text-[9px] ml-0.5">{unit}</span>
          )}
        </div>
      ))}
    </>
  );
}
