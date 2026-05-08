'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  type SleepEntry, type AggEntry, NAMES, FIRST_NAME, ssColor, rhrColor, hrvColor, remColor, personColor, lastNDays, aggregate,
} from '@/lib/sleep';
import { calcXP, xpLevel, tierFor, streakFor } from '@/lib/gamify';
import { fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { Sparkline } from '@/components/ui/sparkline';

type Period = 'today' | 'week' | 'month' | 'all';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Azi' },
  { id: 'week', label: '7 zile' },
  { id: 'month', label: '30 zile' },
  { id: 'all', label: 'Total' },
];

interface Row {
  name: string;
  ss: number;
  rhr: number;
  hrv: number | null;
  rem: number | null;
  entries: number;
  xp: number;
  level: number;
  streak: number;
  badges: { emoji: string; label: string }[];
  hasData: boolean;
}

export function Leaderboard({ entries, currentUser }: { entries: SleepEntry[]; currentUser: string }) {
  const [period, setPeriod] = useState<Period>('week');

  const { rows, latestDate, periodLabel } = useMemo(() => {
    let scoped: SleepEntry[];
    let label = '';
    if (period === 'today') {
      const dates = [...new Set(entries.map(e => e.date))].sort();
      const last = dates[dates.length - 1] || '';
      scoped = entries.filter(e => e.date === last);
      label = last ? fmtDate(last) : '—';
    } else if (period === 'week') {
      scoped = lastNDays(entries, 7);
      label = 'ultimele 7 zile';
    } else if (period === 'month') {
      scoped = lastNDays(entries, 30);
      label = 'ultimele 30 zile';
    } else {
      scoped = entries;
      label = 'tot istoricul';
    }
    const aggRows = aggregate(scoped);

    // Determine winners across the team for fun badges
    const remBest = bestBy(aggRows, r => r.rem ?? -1);
    const ssBest = bestBy(aggRows, r => r.ss);
    const rhrBest = bestBy(aggRows, r => -r.rhr); // lower better
    const hrvBest = bestBy(aggRows, r => r.hrv ?? -1);
    const streakBest = bestBy(NAMES.map(n => ({ name: n, val: streakFor(entries, n) })), r => r.val);

    const built: Row[] = NAMES.map(n => {
      const a = aggRows.find(x => x.name === n);
      const xp = calcXP(entries, n);
      const lvl = xpLevel(xp);
      const streak = streakFor(entries, n);
      const badges: Row['badges'] = [];
      if (a) {
        if (remBest?.name === n && (a.rem ?? 0) > 0) badges.push({ emoji: '🌙', label: 'REM master' });
        if (ssBest?.name === n) badges.push({ emoji: '👑', label: 'best SS avg' });
        if (rhrBest?.name === n) badges.push({ emoji: '🫀', label: 'low RHR' });
        if (hrvBest?.name === n && (a.hrv ?? 0) > 0) badges.push({ emoji: '⚡', label: 'high HRV' });
      }
      if (streakBest?.name === n && streak >= 3) badges.push({ emoji: '🔥', label: `${streak}d streak` });

      return {
        name: n,
        ss: a?.ss ?? 0,
        rhr: a?.rhr ?? 0,
        hrv: a?.hrv ?? null,
        rem: a?.rem ?? null,
        entries: a?.entries ?? 0,
        xp,
        level: lvl,
        streak,
        badges,
        hasData: !!a,
      };
    }).sort((a, b) => b.ss - a.ss);

    return { rows: built, latestDate: scoped.map(e => e.date).sort().slice(-1)[0] || '', periodLabel: label };
  }, [entries, period]);

  const champion = rows[0]?.hasData ? rows[0] : null;

  return (
    <Card className="overflow-hidden">
      {/* Champion banner */}
      {champion && (
        <div
          className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-3"
          style={{ background: `linear-gradient(90deg, ${personColor(champion.name)}18, transparent 70%)` }}
        >
          <span className="text-2xl">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="label" style={{ color: personColor(champion.name) }}>
              campion · {periodLabel}
            </div>
            <div className="font-bold text-sm">
              {FIRST_NAME[champion.name]} <span className="num text-[var(--color-fg-muted)] font-medium">· SS {champion.ss}</span>
            </div>
          </div>
          {champion.rem != null && (
            <div className="text-right">
              <div className="label">REM</div>
              <div className="num font-bold text-sm" style={{ color: remColor(champion.rem) }}>{champion.rem}m</div>
            </div>
          )}
        </div>
      )}

      {/* Period tabs */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-1 flex-wrap">
        <span className="label mr-1">clasament</span>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
              period === p.id
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {p.label}
          </button>
        ))}
        {latestDate && period === 'today' && (
          <span className="ml-auto text-[9px] num text-[var(--color-fg-muted)]">{fmtDate(latestDate)}</span>
        )}
      </div>

      {/* Rows */}
      <div className="px-3 pb-3 pt-1 space-y-1">
        {rows.map((r, i) => (
          <LeaderRow key={r.name} row={r} rank={i} isMe={r.name === currentUser} entries={entries} period={period} />
        ))}
      </div>
    </Card>
  );
}

function LeaderRow({ row, rank, isMe, entries, period }: { row: Row; rank: number; isMe: boolean; entries: SleepEntry[]; period: Period }) {
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉';
  const tier = tierFor(row.level);
  const c = personColor(row.name);

  // Tiny SS sparkline for last 7 days
  const series = useMemo(() => {
    const personEntries = entries.filter(e => e.name === row.name);
    const last7 = lastNDays(personEntries, 7);
    const dates = [...new Set(last7.map(e => e.date))].sort();
    return dates.map(d => last7.find(e => e.date === d)?.ss ?? null);
  }, [entries, row.name]);

  return (
    <Link
      href={`/detail?u=${encodeURIComponent(row.name)}`}
      className={`block group rounded-xl px-3 py-2.5 transition-all ${
        isMe ? 'bg-[var(--color-accent)]/8 ring-1 ring-[var(--color-accent)]/30' : 'hover:bg-[var(--color-surface)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg w-5 text-center shrink-0">{medal}</span>
        <Avi name={row.name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm truncate" style={{ color: c }}>
              {FIRST_NAME[row.name]}
            </span>
            {isMe && <span className="text-[8px] uppercase tracking-wider text-[var(--color-accent)] font-bold">tu</span>}
            <span className="text-[9px] num font-bold px-1 py-0.5 rounded" style={{ color: tier.color, background: tier.color + '15' }}>
              {tier.icon} Lv{row.level}
            </span>
            {row.badges.slice(0, 2).map((b, i) => (
              <span key={i} className="text-[10px]" title={b.label}>{b.emoji}</span>
            ))}
          </div>
          <div className="text-[9px] text-[var(--color-fg-muted)] flex items-center gap-1.5 mt-0.5">
            {row.hasData ? (
              <>
                <span className="num">RHR <strong style={{ color: rhrColor(row.rhr) }}>{row.rhr}</strong></span>
                {row.hrv != null && (
                  <>
                    <span className="text-[var(--color-fg-dim)]">·</span>
                    <span className="num">HRV <strong style={{ color: hrvColor(row.hrv) }}>{row.hrv}</strong></span>
                  </>
                )}
                {row.rem != null && period !== 'today' && (
                  <>
                    <span className="text-[var(--color-fg-dim)]">·</span>
                    <span className="num">REM <strong style={{ color: remColor(row.rem) }}>{row.rem}m</strong></span>
                  </>
                )}
                <span className="text-[var(--color-fg-dim)] ml-auto">{row.entries}d</span>
              </>
            ) : (
              <span className="italic text-[var(--color-fg-dim)]">niciun log în interval</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="num font-bold text-2xl leading-none" style={{ color: row.hasData ? ssColor(row.ss) : '#52525b' }}>
            {row.hasData ? row.ss : '—'}
          </div>
          {row.rem != null && period === 'today' && (
            <div className="num text-[10px] mt-0.5" style={{ color: remColor(row.rem) }}>
              {row.rem}m REM
            </div>
          )}
        </div>
        <Sparkline values={series} width={40} height={20} color={c} className="shrink-0 hidden sm:block" />
      </div>
    </Link>
  );
}

function bestBy<T>(arr: T[], score: (x: T) => number): T | null {
  if (!arr.length) return null;
  let best = arr[0];
  let bestScore = score(best);
  for (const x of arr.slice(1)) {
    const s = score(x);
    if (s > bestScore) { best = x; bestScore = s; }
  }
  return bestScore > -Infinity ? best : null;
}
