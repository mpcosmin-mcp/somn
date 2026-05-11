'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry, FIRST_NAME, ssColor, rhrColor, hrvColor, remColor, personColor, lastNDays,
} from '@/lib/sleep';
import { calcXP, xpLevel, xpProgress, XP_PER_LEVEL, tierFor, streakFor } from '@/lib/gamify';
import { fmtDateShort } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { TeamChart } from '@/components/ui/team-chart';

type Range = '7' | '30' | 'all';

// onUserChange kept for back-compat with the (now-unused) per-user switcher.
// Logged-in user is locked in; cross-user nav lives at /detail's istoric tab.
export function DetailView({ entries, user, onUserChange: _onUserChange }: { entries: SleepEntry[]; user: string; onUserChange: (n: string) => void }) {
  const [range, setRange] = useState<Range>('30');

  const mine = useMemo(() => entries.filter(e => e.name === user).sort((a, b) => a.date.localeCompare(b.date)), [entries, user]);

  const filtered = useMemo(() => {
    if (range === 'all') return mine;
    return lastNDays(mine, parseInt(range));
  }, [mine, range]);

  // Aligned date axis for all metrics (so charts line up)
  const dates = useMemo(() => [...new Set(filtered.map(e => e.date))].sort(), [filtered]);
  const series = useMemo(() => dates.map(d => filtered.find(e => e.date === d) ?? null), [dates, filtered]);

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

  const personC = personColor(user);

  return (
    <div className="space-y-4">
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

      {/* Metric cards with proper detailed chart (axes, dates, target, smooth curves) */}
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

      {/* Recent log list — with journal entries inline */}
      <Card className="p-5">
        <div className="label mb-3">istoric · ultimele {Math.min(filtered.length, 14)} loguri</div>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--color-fg-muted)]">
            <div className="text-2xl mb-2">📭</div>
            <div className="italic">niciun log în acest interval</div>
            <div className="text-[10px] text-[var(--color-fg-dim)] mt-1">încearcă alt range</div>
          </div>
        ) : (
          <div className="space-y-2">
            {[...filtered].reverse().slice(0, 14).map(e => (
              <HistoryRow key={e.date} entry={e} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function HistoryRow({ entry }: { entry: SleepEntry }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors px-3 py-2">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 num text-xs">
        {/* Date row + journal icon (always visible) */}
        <div className="flex items-center justify-between sm:justify-start sm:w-28 sm:shrink-0">
          <span className="text-[var(--color-fg-muted)] font-semibold">{fmtDateShort(entry.date)}</span>
          {entry.journal && <span className="sm:hidden text-[var(--color-fg-dim)] text-[10px]">📝</span>}
        </div>
        {/* Metrics row — wraps on small screens if needed */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-baseline gap-1">
            <span className="text-[var(--color-fg-muted)] text-[10px]">SS</span>
            <span className="font-bold" style={{ color: ssColor(entry.ss) }}>{entry.ss}</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-[var(--color-fg-muted)] text-[10px]">REM</span>
            <span className="font-bold" style={{ color: entry.rem != null ? remColor(entry.rem) : '#52525b' }}>{entry.rem ?? '—'}</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-[var(--color-fg-muted)] text-[10px]">RHR</span>
            <span className="font-bold" style={{ color: rhrColor(entry.rhr) }}>{entry.rhr}</span>
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-[var(--color-fg-muted)] text-[10px]">HRV</span>
            <span className="font-bold" style={{ color: hrvColor(entry.hrv) }}>{entry.hrv ?? '—'}</span>
          </span>
        </div>
        {entry.journal && <span className="hidden sm:inline ml-auto text-[var(--color-fg-dim)] text-[10px]">📝</span>}
      </div>
      {entry.journal && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[11px] text-[var(--color-fg-muted)] italic leading-relaxed">
          &ldquo;{entry.journal}&rdquo;
        </div>
      )}
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

      {/* Detailed chart with axes + dates + target line + smooth curve */}
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
