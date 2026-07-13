'use client';
import { useMemo, useState } from 'react';
import {
  type SleepEntry, type AggEntry, NAMES, FIRST_NAME, ssColor, rhrColor, hrvColor, remColor, personColor, lastNDays, aggregate,
  sleepDurationMin, fmtDuration, durationColor, bedtimeFrom18, personSex, rhrCutoffs,
} from '@/lib/sleep';
import { SleepSchedule, type ScheduleRow } from '@/components/dashboard/sleep-schedule';
import { xpLevel, xpBreakdown, tierFor, streakFor, maxStreakFor, godMode } from '@/lib/gamify';
import { fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { Sparkline } from '@/components/ui/sparkline';
import { Modal } from '@/components/ui/modal';
import { PlayerDrawer, PlayerDrawerTitle } from '@/components/dashboard/player-drawer';
import { EntryReactions } from '@/components/dashboard/entry-reactions';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: 'today', label: 'Azi', days: null },
  { id: 'week', label: '7 zile', days: 7 },
  { id: 'month', label: '30 zile', days: 30 },
  { id: 'quarter', label: '3 luni', days: 90 },
  { id: 'year', label: 'An', days: 365 },
  { id: 'all', label: 'Total', days: null },
];

interface Row {
  name: string;
  ss: number;
  rhr: number;
  hrv: number | null;
  rem: number | null;
  dur: number | null;
  entries: number;
  xp: number;
  level: number;
  streak: number;
  nights90: number;
  nights80: number;
  /** Permanent, all-time distinctions — never flip when you switch tabs. */
  badges: { emoji: string; label: string }[];
  /** Crowns for the SELECTED period — the competitive layer, meant to change hands. */
  periodBadges: { emoji: string; label: string }[];
  godMode: boolean;   // God night (SS ≥ 95) in the last 7 days
  elite: boolean;     // SS ≥ 90 in the last 7 days (but no God night)
  hasData: boolean;
}

export function Leaderboard({ entries, currentUser }: { entries: SleepEntry[]; currentUser: string }) {
  const [period, setPeriod] = useState<Period>('today');
  const [openRow, setOpenRow] = useState<Row | null>(null);

  const { rows, latestDate, periodLabel, schedule, scopedEntries } = useMemo(() => {
    const spec = PERIODS.find(p => p.id === period)!;
    let scoped: SleepEntry[];
    let label = '';
    if (period === 'today') {
      const dates = [...new Set(entries.map(e => e.date))].sort();
      const last = dates[dates.length - 1] || '';
      scoped = entries.filter(e => e.date === last);
      label = last ? fmtDate(last) : '—';
    } else if (spec.days != null) {
      scoped = lastNDays(entries, spec.days);
      label = `ultimele ${spec.days} zile`;
    } else {
      scoped = entries;
      label = 'tot istoricul';
    }
    const aggRows = aggregate(scoped);

    const durByName = new Map<string, number | null>();
    for (const n of NAMES) {
      const ds = scoped
        .filter(e => e.name === n)
        .map(e => sleepDurationMin(e.start, e.end))
        .filter((d): d is number => d != null);
      durByName.set(n, ds.length ? Math.round(ds.reduce((s, v) => s + v, 0) / ds.length) : null);
    }

    const schedule: ScheduleRow[] = [];
    for (const n of NAMES) {
      const es = scoped.filter(e => e.name === n && e.start && e.end);
      const starts = es.map(e => bedtimeFrom18(e.start)).filter((v): v is number => v != null);
      const ends = es.map(e => bedtimeFrom18(e.end)).filter((v): v is number => v != null);
      if (starts.length && ends.length) {
        const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
        schedule.push({ name: n, start: avg(starts), end: avg(ends) });
      }
    }

    // ── Permanent (ALL-TIME) distinctions — computed on the full history so
    // they never flip when you switch the Azi/7z/30z/Total tab. Once earned, kept.
    const allAgg = aggregate(entries);
    const allDur = new Map<string, number>();
    for (const n of NAMES) {
      const ds = entries.filter(e => e.name === n).map(e => sleepDurationMin(e.start, e.end)).filter((d): d is number => d != null);
      allDur.set(n, ds.length ? ds.reduce((s, v) => s + v, 0) / ds.length : -1);
    }
    const remBest = bestBy(allAgg, r => r.rem ?? -1);
    const ssBest = bestBy(allAgg, r => r.ss);
    // RHR is compared against each person's own sex baseline, not raw. Women run
    // ~5 bpm higher at identical fitness, so a raw comparison handed this badge
    // to a man every single time regardless of who was actually fitter.
    const rhrBest = bestBy(allAgg, r => (r.rhr > 0 ? rhrCutoffs(personSex(r.name))[1] - r.rhr : -Infinity));
    const hrvBest = bestBy(allAgg, r => r.hrv ?? -1);
    const durBest = bestBy(NAMES.map(n => ({ name: n, val: allDur.get(n) ?? -1 })), r => r.val);
    const streakBest = bestBy(NAMES.map(n => ({ name: n, val: maxStreakFor(entries, n) })), r => r.val);

    // ── Period leaders — the COMPETITIVE layer, recomputed for the selected tab.
    // Deliberately separate from the permanent all-time distinctions above: those
    // never move, these are this week's / month's crown and are meant to be taken.
    const perDur = new Map<string, number>();
    for (const n of NAMES) {
      const ds = scoped.filter(e => e.name === n).map(e => sleepDurationMin(e.start, e.end)).filter((d): d is number => d != null);
      perDur.set(n, ds.length ? ds.reduce((s, v) => s + v, 0) / ds.length : -1);
    }
    const pSsBest = bestBy(aggRows, r => r.ss);
    const pRemBest = bestBy(aggRows, r => r.rem ?? -1);
    const pHrvBest = bestBy(aggRows, r => r.hrv ?? -1);
    const pRhrBest = bestBy(aggRows, r => (r.rhr > 0 ? rhrCutoffs(personSex(r.name))[1] - r.rhr : -Infinity));
    const pDurBest = bestBy(NAMES.map(n => ({ name: n, val: perDur.get(n) ?? -1 })), r => r.val);
    const pLogBest = bestBy(aggRows, r => r.entries);
    // With one logger there is no contest — a crown nobody competed for is noise.
    const contested = aggRows.length >= 2;

    const built: Row[] = NAMES.map(n => {
      const a = aggRows.find(x => x.name === n);
      const bd = xpBreakdown(entries, n);
      const xp = bd.total;
      const lvl = xpLevel(xp);
      const streak = streakFor(entries, n);
      // The XP bands are exclusive; the row chips read "×90+" / "×80+", so show
      // them cumulatively or the numbers contradict their own label.
      const nights90 = bd.count100 + bd.count95 + bd.count90;
      const nights80 = nights90 + bd.count85 + bd.count80;
      // God Mode flair follows the real mechanic (a God night in the last 7 days),
      // not the selected tab — so it doesn't flip when you switch periods.
      const godActive = godMode(entries, n).active;
      const my7 = lastNDays(entries.filter(e => e.name === n), 7).map(e => e.ss);
      const elite = !godActive && (my7.length ? Math.max(...my7) : 0) >= 90;

      // Permanent all-time distinctions — independent of the scoped period.
      const aAll = allAgg.find(x => x.name === n);
      const recordStreak = maxStreakFor(entries, n);
      const badges: Row['badges'] = [];
      if (aAll) {
        if (ssBest?.name === n) badges.push({ emoji: '👑', label: 'best SS (total)' });
        if (durBest?.name === n && (allDur.get(n) ?? 0) > 0) badges.push({ emoji: '😴', label: 'cel mai mult somn' });
        if (remBest?.name === n && (aAll.rem ?? 0) > 0) badges.push({ emoji: '🌙', label: 'REM master' });
        if (rhrBest?.name === n && aAll.rhr > 0) badges.push({ emoji: '🫀', label: 'cel mai bun RHR (vs. baseline)' });
        if (hrvBest?.name === n && (aAll.hrv ?? 0) > 0) badges.push({ emoji: '⚡', label: 'high HRV' });
      }
      if (streakBest?.name === n && recordStreak >= 3) badges.push({ emoji: '🔥', label: `record ${recordStreak}z` });

      // Period crowns — only when there was actually a contest in this window.
      const periodBadges: Row['badges'] = [];
      if (a && contested) {
        if (pSsBest?.name === n) periodBadges.push({ emoji: '👑', label: 'cel mai bun SS' });
        if (pRemBest?.name === n && (a.rem ?? 0) > 0) periodBadges.push({ emoji: '🌙', label: 'cel mai mult REM' });
        if (pRhrBest?.name === n && a.rhr > 0) periodBadges.push({ emoji: '🫀', label: 'cel mai bun RHR' });
        if (pHrvBest?.name === n && (a.hrv ?? 0) > 0) periodBadges.push({ emoji: '⚡', label: 'cel mai mare HRV' });
        if (pDurBest?.name === n && (perDur.get(n) ?? 0) > 0) periodBadges.push({ emoji: '😴', label: 'cel mai mult somn' });
        if (pLogBest?.name === n) periodBadges.push({ emoji: '📝', label: 'cele mai multe loguri' });
      }

      return {
        name: n,
        ss: a?.ss ?? 0,
        rhr: a?.rhr ?? 0,
        hrv: a?.hrv ?? null,
        rem: a?.rem ?? null,
        dur: durByName.get(n) ?? null,
        entries: a?.entries ?? 0,
        xp,
        level: lvl,
        streak,
        nights90,
        nights80,
        badges,
        periodBadges,
        godMode: godActive,
        elite,
        hasData: !!a,
      };
    }).sort((a, b) => b.ss - a.ss);

    return { rows: built, latestDate: scoped.map(e => e.date).sort().slice(-1)[0] || '', periodLabel: label, schedule, scopedEntries: scoped };
  }, [entries, period]);

  const champion = rows[0]?.hasData ? rows[0] : null;

  return (
    <>
    <Card className="overflow-hidden">
      {champion && (
        <button
          type="button"
          onClick={() => setOpenRow(champion)}
          className="w-full text-left px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-3 hover:bg-[var(--color-surface)]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
          style={{ background: `linear-gradient(90deg, ${personColor(champion.name)}18, transparent 70%)` }}
        >
          <span className="text-2xl shrink-0">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="label truncate" style={{ color: personColor(champion.name) }}>
              campion · {periodLabel}
            </div>
            <div className="font-bold text-sm truncate">
              {FIRST_NAME[champion.name]} <span className="num text-[var(--color-fg-muted)] font-medium">· SS {champion.ss}</span>
            </div>
          </div>
          {champion.rem != null && (
            <div className="text-right shrink-0">
              <div className="label">REM</div>
              <div className="num font-bold text-sm" style={{ color: remColor(champion.rem) }}>{champion.rem}m</div>
            </div>
          )}
        </button>
      )}

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

      <SleepSchedule rows={schedule} currentUser={currentUser} />

      <div className="px-3 pb-3 pt-1 space-y-1">
        {rows.map((r, i) => (
          <LeaderRow key={r.name} row={r} rank={i} isMe={r.name === currentUser} entries={entries} scopedEntries={scopedEntries} currentUser={currentUser} period={period} onOpen={setOpenRow} />
        ))}
      </div>
    </Card>

    <Modal
      open={!!openRow}
      onClose={() => setOpenRow(null)}
      title={openRow ? <PlayerDrawerTitle player={openRow} /> : undefined}
    >
      {openRow && <PlayerDrawer player={openRow} entries={entries} currentUser={currentUser} periodLabel={periodLabel} />}
    </Modal>
    </>
  );
}

function LeaderRow({ row, rank, isMe, entries, scopedEntries, currentUser, period, onOpen }: { row: Row; rank: number; isMe: boolean; entries: SleepEntry[]; scopedEntries: SleepEntry[]; currentUser: string; period: Period; onOpen: (row: Row) => void }) {
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉';
  const tier = tierFor(row.level);
  const c = personColor(row.name);

  // Tiny SS sparkline for last 7 days
  const { sparkValues, sparkDates } = useMemo(() => {
    const personEntries = entries.filter(e => e.name === row.name);
    const last7 = lastNDays(personEntries, 7);
    const dates = [...new Set(last7.map(e => e.date))].sort();
    return {
      sparkValues: dates.map(d => last7.find(e => e.date === d)?.ss ?? null),
      sparkDates: dates,
    };
  }, [entries, row.name]);

  const latestEntry = useMemo(() => {
    const mine = scopedEntries.filter(e => e.name === row.name);
    if (!mine.length) return null;
    return mine.sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [scopedEntries, row.name]);

  return (
    <div
      className={`rounded-xl px-3 py-1.5 transition-all ${
        row.godMode ? 'god-aura' : row.elite ? 'elite-glow' : ''
      } ${isMe ? 'ring-1 ring-[var(--color-accent)]/30' : ''} ${
        isMe && !row.godMode && !row.elite ? 'bg-[var(--color-accent)]/8' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="block w-full text-left cursor-pointer rounded-lg hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base w-5 text-center shrink-0">{medal}</span>
          <Avi name={row.name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color: c }}>
                {FIRST_NAME[row.name]}
              </span>
              {isMe && <span className="text-[8px] uppercase tracking-wider text-[var(--color-accent)] font-bold">tu</span>}
              <span className="text-[9px] num font-bold px-1 py-0.5 rounded shrink-0" style={{ color: tier.color, background: tier.color + '15' }}>
                {tier.icon} Lv{row.level}
              </span>
              {row.godMode && (
                <span className="god-text text-[9px] font-black tracking-wider" title="God Mode activ — a prins o noapte de 95+ în ultimele 7 zile">💯 GOD</span>
              )}
              {row.elite && (
                <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }} title="Noapte de 90+ în ultimele 7 zile">🌟</span>
              )}
              {row.badges.slice(0, 3).map((b, i) => (
                <span key={i} className="text-[10px]" title={b.label} aria-label={b.label}>{b.emoji}</span>
              ))}
              {/* Period crowns sit in a ringed chip so they read as "this window",
                  not as another permanent distinction. */}
              {row.periodBadges.length > 0 && period !== 'today' && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] px-1 py-px rounded-full border border-[#fbbf24]/40 bg-[#fbbf24]/10"
                  title={`Lider ${periodLabelShort(period)}: ${row.periodBadges.map(b => b.label).join(', ')}`}
                  aria-label={`Lider ${periodLabelShort(period)}: ${row.periodBadges.map(b => b.label).join(', ')}`}
                >
                  {row.periodBadges.slice(0, 4).map((b, i) => <span key={i}>{b.emoji}</span>)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1.5 mt-0.5 flex-wrap">
              {row.hasData ? (
                <>
                  <span className="num font-bold" style={{ color: 'var(--color-accent)' }}>{row.xp} XP</span>
                  {row.nights90 > 0 && (
                    <>
                      <span className="text-[var(--color-fg-dim)]">·</span>
                      <span className="num"><strong style={{ color: 'var(--color-good)' }}>{row.nights90}</strong>×90+</span>
                    </>
                  )}
                  {row.nights80 > 0 && (
                    <>
                      <span className="text-[var(--color-fg-dim)]">·</span>
                      <span className="num"><strong style={{ color: 'var(--color-accent)' }}>{row.nights80}</strong>×80+</span>
                    </>
                  )}
                  <span className="text-[var(--color-fg-dim)]">·</span>
                  <span className="num">RHR <strong style={{ color: rhrColor(row.rhr, personSex(row.name)) }}>{row.rhr}</strong></span>
                  {row.hrv != null && (
                    <>
                      <span className="text-[var(--color-fg-dim)]">·</span>
                      <span className="num">HRV <strong style={{ color: hrvColor(row.hrv) }}>{row.hrv}</strong></span>
                    </>
                  )}
                  {row.dur != null && (
                    <>
                      <span className="text-[var(--color-fg-dim)]">·</span>
                      <span className="num"><strong style={{ color: durationColor(row.dur) }}>{fmtDuration(row.dur)}</strong></span>
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
            <div className="num font-bold text-xl leading-none" style={{ color: row.hasData ? ssColor(row.ss) : '#52525b' }}>
              {row.hasData ? row.ss : '—'}
            </div>
            {row.rem != null && period === 'today' && (
              <div className="num text-[9px] mt-0.5" style={{ color: remColor(row.rem) }}>
                {row.rem}m REM
              </div>
            )}
          </div>
          <Sparkline values={sparkValues} dates={sparkDates} width={36} height={18} color={c} className="shrink-0 hidden sm:block" />
        </div>
      </button>

      {latestEntry && (
        <div className="mt-0.5 ml-[34px]">
          <EntryReactions entry={latestEntry} currentUser={currentUser} />
        </div>
      )}
    </div>
  );
}

function periodLabelShort(p: Period): string {
  return PERIODS.find(x => x.id === p)?.label.toLowerCase() ?? '';
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
