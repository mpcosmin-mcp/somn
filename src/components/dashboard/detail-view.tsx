'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry, NAMES, FIRST_NAME, ssColor, rhrColor, hrvColor, remColor, personColor, lastNDays,
} from '@/lib/sleep';
import { calcXP, xpLevel, xpProgress, XP_PER_LEVEL, tierFor, streakFor } from '@/lib/gamify';
import { fmtDateShort } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { Sparkline } from '@/components/ui/sparkline';
import { Metric } from '@/components/ui/metric';

type Range = '7' | '30' | 'all';

export function DetailView({ entries, user, onUserChange }: { entries: SleepEntry[]; user: string; onUserChange: (n: string) => void }) {
  const [range, setRange] = useState<Range>('30');

  const mine = useMemo(() => entries.filter(e => e.name === user).sort((a, b) => a.date.localeCompare(b.date)), [entries, user]);

  const filtered = useMemo(() => {
    if (range === 'all') return mine;
    return lastNDays(mine, parseInt(range));
  }, [mine, range]);

  // Build day-by-day series (filling gaps with null) for the selected range
  const series = useMemo(() => {
    const dates = [...new Set(filtered.map(e => e.date))].sort();
    return dates.map(d => filtered.find(e => e.date === d) ?? null);
  }, [filtered]);

  const ssVals = series.map(e => e?.ss ?? null);
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

  const xp = calcXP(entries, user);
  const level = xpLevel(xp);
  const tier = tierFor(level);
  const streak = streakFor(entries, user);
  const progress = xpProgress(xp);

  return (
    <div className="space-y-4">
      {/* User switcher */}
      <Card className="px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <span className="label shrink-0">vezi date pentru:</span>
        {NAMES.map(n => (
          <button
            key={n}
            onClick={() => onUserChange(n)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              n === user
                ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 text-[var(--color-fg)]'
                : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Avi name={n} size="xs" />
            {FIRST_NAME[n]}
          </button>
        ))}
      </Card>

      {/* User profile snapshot */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Avi name={user} size="lg" />
          <div className="flex-1">
            <div className="text-xl font-bold">{FIRST_NAME[user]}</div>
            <div className="text-xs text-[var(--color-fg-muted)] flex items-center gap-2 mt-0.5">
              <span style={{ color: tier.color }}>{tier.icon} Lv {level} · {tier.name}</span>
              {streak > 0 && (
                <>
                  <span className="text-[var(--color-fg-dim)]">·</span>
                  <span className="num text-[var(--color-accent)] font-bold">{streak}d streak</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="num text-2xl font-bold text-[var(--color-accent)]">{xp}</div>
            <div className="label">XP</div>
          </div>
        </div>
        {/* XP progress bar */}
        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${(progress / XP_PER_LEVEL) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] num text-[var(--color-fg-muted)] mt-1">
          <span>Lv {level}</span>
          <span>{progress}/{XP_PER_LEVEL}</span>
          <span>Lv {level + 1}</span>
        </div>
      </Card>

      {/* Range tabs */}
      <div className="flex items-center gap-2">
        <span className="label">interval:</span>
        {(['7', '30', 'all'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              range === r ? 'bg-[var(--color-accent)] text-[var(--color-bg)]' : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {r === '7' ? '7 zile' : r === '30' ? '30 zile' : 'tot'}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[var(--color-fg-muted)] num">
          {filtered.length} loguri
        </span>
      </div>

      {/* Metric cards with sparkline + avg + best */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MetricCard title="REM" unit="min" series={remVals} avg={avg(remVals)} best={best(remVals)} color="#a78bfa" />
        <MetricCard title="Sleep Score" unit="/100" series={ssVals} avg={avg(ssVals)} best={best(ssVals)} color={personColor(user)} />
        <MetricCard title="RHR" unit="bpm" series={rhrVals} avg={avg(rhrVals)} best={best(rhrVals, false)} color="#fbbf24" lowerBetter />
        <MetricCard title="HRV" unit="ms" series={hrvVals} avg={avg(hrvVals)} best={best(hrvVals)} color="#60a5fa" />
      </div>

      {/* Recent log table */}
      <Card className="p-5">
        <div className="label mb-3">istoric · ultimele {Math.min(filtered.length, 14)} loguri</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs num">
            <thead>
              <tr className="text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                <th className="text-left font-semibold py-2 pr-3">data</th>
                <th className="text-right font-semibold px-2">SS</th>
                <th className="text-right font-semibold px-2">REM</th>
                <th className="text-right font-semibold px-2">RHR</th>
                <th className="text-right font-semibold pl-2">HRV</th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().slice(0, 14).map(e => (
                <tr key={e.date} className="border-b border-[var(--color-border-subtle)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--color-fg-muted)]">{fmtDateShort(e.date)}</td>
                  <td className="text-right px-2 font-bold" style={{ color: ssColor(e.ss) }}>{e.ss}</td>
                  <td className="text-right px-2 font-bold" style={{ color: e.rem != null ? remColor(e.rem) : '#52525b' }}>{e.rem ?? '—'}</td>
                  <td className="text-right px-2 font-bold" style={{ color: rhrColor(e.rhr) }}>{e.rhr}</td>
                  <td className="text-right pl-2 font-bold" style={{ color: hrvColor(e.hrv) }}>{e.hrv ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-4 text-xs text-[var(--color-fg-dim)] italic">niciun log în acest interval</div>
          )}
        </div>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  unit: string;
  series: (number | null)[];
  avg: number | null;
  best: number | null;
  color: string;
  lowerBetter?: boolean;
}

function MetricCard({ title, unit, series, avg, best, color, lowerBetter }: MetricCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">{title}</div>
        <Sparkline values={series} width={120} height={28} color={color} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="medie" value={avg} unit={unit} color={color} size="md" />
        <Metric label={lowerBetter ? 'minim' : 'maxim'} value={best} unit={unit} color={color} size="md" />
      </div>
    </Card>
  );
}
