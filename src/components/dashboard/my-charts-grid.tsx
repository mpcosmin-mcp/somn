'use client';
import { useMemo, useState } from 'react';
import { type SleepEntry, personColor, lastNDays } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { TeamChart } from '@/components/ui/team-chart';

type Range = '7' | '30' | 'all';

/**
 * 4 polished charts of the user's own data — REM / Sleep Score / RHR / HRV.
 * Each has axes, calendar dates, smooth curves, target line, area gradient.
 *
 * This is the "detailed view of MY data" that lives on the main dashboard now.
 * Less is more — straight to the data, no fluff.
 */
export function MyChartsGrid({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const [range, setRange] = useState<Range>('30');

  const mine = useMemo(
    () => entries.filter(e => e.name === user).sort((a, b) => a.date.localeCompare(b.date)),
    [entries, user],
  );

  const filtered = useMemo(() => {
    if (range === 'all') return mine;
    return lastNDays(mine, parseInt(range));
  }, [mine, range]);

  const dates = useMemo(() => [...new Set(filtered.map(e => e.date))].sort(), [filtered]);
  const series = useMemo(() => dates.map(d => filtered.find(e => e.date === d) ?? null), [dates, filtered]);

  const ssVals  = series.map(e => e?.ss ?? null);
  const remVals = series.map(e => e?.rem ?? null);
  const rhrVals = series.map(e => e?.rhr ?? null);
  const hrvVals = series.map(e => e?.hrv ?? null);

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
  };
  const best = (arr: (number | null)[], higherBetter = true) => {
    const v = arr.filter((x): x is number => x != null);
    if (!v.length) return null;
    return higherBetter ? Math.max(...v) : Math.min(...v);
  };

  const personC = personColor(user);

  if (filtered.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="text-2xl mb-2">📭</div>
        <div className="text-sm text-[var(--color-fg-muted)]">
          niciun log în acest interval — loghează prima dată
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Range tabs */}
      <div className="flex items-center gap-1.5">
        <span className="label">interval:</span>
        {(['7', '30', 'all'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
              range === r
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {r === '7' ? '7 zile' : r === '30' ? '30 zile' : 'tot'}
          </button>
        ))}
        <span className="ml-auto text-[10px] num text-[var(--color-fg-muted)]">{filtered.length} loguri</span>
      </div>

      {/* 2x2 grid of detailed charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricChartCard
          title="Sleep Score" unit="/100" target={75}
          values={ssVals} dates={dates}
          avg={avg(ssVals)} best={best(ssVals)}
          color={personC}
        />
        <MetricChartCard
          title="REM" unit="min" target={90}
          values={remVals} dates={dates}
          avg={avg(remVals)} best={best(remVals)}
          color="#a78bfa"
        />
        <MetricChartCard
          title="RHR" unit="bpm" target={60} lowerBetter
          values={rhrVals} dates={dates}
          avg={avg(rhrVals)} best={best(rhrVals, false)}
          color="#fbbf24"
        />
        <MetricChartCard
          title="HRV" unit="ms" target={45}
          values={hrvVals} dates={dates}
          avg={avg(hrvVals)} best={best(hrvVals)}
          color="#60a5fa"
        />
      </div>
    </div>
  );
}

interface MetricChartCardProps {
  title: string;
  unit: string;
  target: number;
  values: (number | null)[];
  dates: string[];
  avg: number | null;
  best: number | null;
  color: string;
  lowerBetter?: boolean;
}

function MetricChartCard({
  title, unit, target,
  values, dates, avg, best,
  color, lowerBetter,
}: MetricChartCardProps) {
  const present = values.filter((v): v is number => v != null);
  const hasEnough = present.length >= 2;
  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="label">{title}</div>
        <div className="text-[10px] num text-[var(--color-fg-dim)]">
          target {lowerBetter ? '< ' : ''}{target}{unit}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-0.5">medie</div>
          <div className="num font-bold text-2xl leading-none" style={{ color: avg == null ? '#52525b' : color }}>
            {avg ?? '—'}
            <span className="text-[10px] text-[var(--color-fg-muted)] font-normal ml-0.5">{unit}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-0.5">
            {lowerBetter ? 'minim' : 'maxim'}
          </div>
          <div className="num font-bold text-2xl leading-none" style={{ color: best == null ? '#52525b' : color }}>
            {best ?? '—'}
            <span className="text-[10px] text-[var(--color-fg-muted)] font-normal ml-0.5">{unit}</span>
          </div>
        </div>
      </div>

      {hasEnough ? (
        <TeamChart
          series={[{ name: title, color, values }]}
          dates={dates}
          height={180}
          target={target}
          targetLabel="target"
          unit={unit}
          lowerBetter={lowerBetter}
        />
      ) : (
        <div className="h-[180px] flex items-center justify-center text-xs italic text-[var(--color-fg-dim)]">
          insuficiente date pentru chart
        </div>
      )}
    </Card>
  );
}
