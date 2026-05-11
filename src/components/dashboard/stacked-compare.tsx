'use client';
import { useMemo, useState } from 'react';
import { type SleepEntry, NAMES, FIRST_NAME, personColor, lastNDays } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { MultiLineChart } from '@/components/ui/multi-line-chart';

type Range = '7' | '30' | 'all';

/**
 * Stacked comparison: all 3 users on the same chart for each metric.
 * Helps spot who improves, who slumps, who's consistent.
 */
export function StackedCompare({ entries }: { entries: SleepEntry[] }) {
  const [range, setRange] = useState<Range>('30');

  const scoped = useMemo(() => {
    if (range === 'all') return entries;
    return lastNDays(entries, parseInt(range));
  }, [entries, range]);

  // Build a date axis across all dates that appear, then one value array per user
  const allDates = useMemo(
    () => [...new Set(scoped.map(e => e.date))].sort(),
    [scoped],
  );

  const seriesFor = (field: 'ss' | 'rhr' | 'hrv' | 'rem'): Array<{ name: string; color: string; values: (number | null)[] }> => {
    return NAMES.map(n => {
      const personMap = new Map(scoped.filter(e => e.name === n).map(e => [e.date, e]));
      const values = allDates.map(d => {
        const v = personMap.get(d);
        return v ? (v[field] as number | null) ?? null : null;
      });
      return {
        name: FIRST_NAME[n] ?? n.split(' ')[0],
        color: personColor(n),
        values,
      };
    });
  };

  // Per-metric stats per person for compact comparison row
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

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="label">comparare echipă</div>
          <div className="text-base font-bold">toți 3, suprapuși</div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['7', '30', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
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

      {/* Compact stats table — averages per person */}
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        <div className="text-[var(--color-fg-muted)] num font-semibold">metric</div>
        {NAMES.map(n => (
          <div key={n} className="text-right font-bold" style={{ color: personColor(n) }}>
            {FIRST_NAME[n]}
          </div>
        ))}

        <Row label="SS"  values={NAMES.map(n => stats[n].ss   || '—')} />
        <Row label="RHR" values={NAMES.map(n => stats[n].rhr  || '—')} />
        <Row label="REM" values={NAMES.map(n => stats[n].rem  ?? '—')} unit="min" />
        <Row label="HRV" values={NAMES.map(n => stats[n].hrv  ?? '—')} unit="ms" />
        <Row label="logs" values={NAMES.map(n => stats[n].entries)} />
      </div>

      {/* 4 stacked charts: SS, REM, RHR, HRV */}
      <div className="space-y-4">
        <ChartRow title="Sleep Score" series={seriesFor('ss')} target={75} targetLabel="target" />
        <ChartRow title="REM (min)"   series={seriesFor('rem')} target={90} targetLabel="target" />
        <ChartRow title="RHR (bpm)"   series={seriesFor('rhr')} target={60} targetLabel="target (sub)" />
        <ChartRow title="HRV (ms)"    series={seriesFor('hrv')} target={45} targetLabel="target" />
      </div>
    </Card>
  );
}

function Row({ label, values, unit }: { label: string; values: (number | string)[]; unit?: string }) {
  return (
    <>
      <div className="num text-[var(--color-fg-muted)]">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="text-right num font-semibold text-[var(--color-fg)]">
          {v}{unit && typeof v === 'number' && <span className="text-[var(--color-fg-muted)] font-normal text-[9px] ml-0.5">{unit}</span>}
        </div>
      ))}
    </>
  );
}

function ChartRow({
  title,
  series,
  target,
  targetLabel,
}: {
  title: string;
  series: { name: string; color: string; values: (number | null)[] }[];
  target?: number;
  targetLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label">{title}</span>
      </div>
      <MultiLineChart series={series} target={target} targetLabel={targetLabel} showLegend={false} />
    </div>
  );
}
