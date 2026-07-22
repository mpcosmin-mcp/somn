'use client';
import { useMemo, useRef, useState } from 'react';
import {
  type SleepEntry, NAMES, FIRST_NAME, ssColor, rhrColor, hrvColor, remColor, personColor, lastNDays, aggregate,
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

/**
 * Clasament — implements the Claude Design project "Restructurare modul
 * clasament" (Clasament Somn.dc.html):
 *
 *   • JetBrains Mono, rank squares with gold/silver/bronze glow
 *   • one horizontal "banner" per player: avatar+name | diagonal separators |
 *     metric modules | slanted SS block with sparkline
 *   • single-day views (Azi / a calendar-picked day) show that day's journal
 *     quote + reactions + comment thread; period views (7z/30z/3 luni/An/Total)
 *     show ONLY averages — no messages.
 */

type Period = 'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
const PERIODS: { id: Period; label: string; days: number | null }[] = [
  { id: 'today', label: 'Azi', days: null },
  { id: 'week', label: '7 zile', days: 7 },
  { id: 'month', label: '30 zile', days: 30 },
  { id: 'quarter', label: '3 luni', days: 90 },
  { id: 'year', label: 'An', days: 365 },
  { id: 'all', label: 'Total', days: null },
];

/** Rank square looks — straight from the design (RANK map). */
const RANK_LOOK = [
  { bg: 'linear-gradient(135deg,#ffe08a,#f5b722)', glow: '0 0 14px rgba(245,183,34,.35)' },
  { bg: 'linear-gradient(135deg,#eef2f8,#9aa7b8)', glow: '0 0 12px rgba(154,167,184,.3)' },
  { bg: 'linear-gradient(135deg,#e6a06b,#b06a3b)', glow: '0 0 12px rgba(176,106,59,.35)' },
];

const JB_FONT = 'var(--font-jbmono), var(--font-geist-mono), ui-monospace, monospace';

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
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);

  // "Azi" and a calendar-picked day are SINGLE-DAY views — the only ones where
  // journals + reactions belong. Every other tab is an averages view.
  const singleDay = period === 'today' || period === 'day';

  const { minDate, maxDate } = useMemo(() => {
    const dates = [...new Set(entries.map(e => e.date))].sort();
    return { minDate: dates[0] || '', maxDate: dates[dates.length - 1] || '' };
  }, [entries]);

  const { rows, periodLabel, schedule, dayEntries } = useMemo(() => {
    const spec = PERIODS.find(p => p.id === period);
    let scoped: SleepEntry[];
    let label = '';
    if (period === 'today') {
      scoped = entries.filter(e => e.date === maxDate);
      label = maxDate ? fmtDate(maxDate) : '—';
    } else if (period === 'day') {
      scoped = entries.filter(e => e.date === selectedDay);
      label = selectedDay ? fmtDate(selectedDay) : '—';
    } else if (spec?.days != null) {
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
        if (hrvBest?.name === n && (aAll.hrv ?? 0) > 0) badges.push({ emoji: '💓', label: 'high HRV' });
      }
      if (streakBest?.name === n && recordStreak >= 3) badges.push({ emoji: '🔥', label: `record ${recordStreak}z` });

      // Period crowns — only when there was actually a contest in this window.
      const periodBadges: Row['badges'] = [];
      if (a && contested) {
        if (pSsBest?.name === n) periodBadges.push({ emoji: '👑', label: 'cel mai bun SS' });
        if (pRemBest?.name === n && (a.rem ?? 0) > 0) periodBadges.push({ emoji: '🌙', label: 'cel mai mult REM' });
        if (pRhrBest?.name === n && a.rhr > 0) periodBadges.push({ emoji: '🫀', label: 'cel mai bun RHR' });
        if (pHrvBest?.name === n && (a.hrv ?? 0) > 0) periodBadges.push({ emoji: '💓', label: 'cel mai mare HRV' });
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

    // In single-day mode, each player's entry FOR THAT DAY drives the
    // journal + reactions strip. Period views deliberately get none.
    const dayEntries = new Map<string, SleepEntry>();
    if (period === 'today' || period === 'day') {
      for (const e of scoped) dayEntries.set(e.name, e);
    }

    return { rows: built, periodLabel: label, schedule, dayEntries };
  }, [entries, period, selectedDay, maxDate]);

  const champion = rows[0]?.hasData ? rows[0] : null;

  const pickDay = () => {
    const el = dayInputRef.current;
    if (!el) return;
    if ('showPicker' in el && typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  };

  return (
    <>
    <Card className="overflow-hidden">
    <div style={{ fontFamily: JB_FONT }}>
      {/* ===== Champion header ===== */}
      {champion && (
        <button
          type="button"
          onClick={() => setOpenRow(champion)}
          className="w-full text-left px-4 sm:px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-4 hover:brightness-110 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
          style={{ background: `linear-gradient(90deg, rgba(255,200,98,.07), ${personColor(champion.name)}0d 45%, transparent 75%)` }}
        >
          <span
            className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-2xl"
            style={{ background: RANK_LOOK[0].bg, boxShadow: '0 0 18px rgba(245,183,34,.3)' }}
            aria-hidden
          >🏆</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[.16em] uppercase truncate" style={{ color: personColor(champion.name) }}>
              campion · {periodLabel}
            </div>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span className="font-extrabold text-lg leading-none">{FIRST_NAME[champion.name]}</span>
              <span className="text-xs font-semibold text-[var(--color-fg-muted)]">SS</span>
              <span className="font-extrabold text-lg leading-none" style={{ color: ssColor(champion.ss) }}>{champion.ss}</span>
            </div>
          </div>
          {champion.rem != null && (
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold tracking-[.14em] text-[var(--color-fg-muted)]">REM</div>
              <div className="font-extrabold text-[17px]" style={{ color: remColor(champion.rem) }}>{champion.rem}m</div>
            </div>
          )}
        </button>
      )}

      {/* ===== Period tabs + calendar day picker ===== */}
      <div className="flex items-center gap-1.5 px-4 sm:px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 flex-wrap">
        <span className="text-[11px] font-bold tracking-[.14em] text-[var(--color-fg-muted)] mr-1.5">CLASAMENT</span>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              period === p.id
                ? 'text-white'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'
            }`}
            style={period === p.id ? { background: '#5b5bd6' } : undefined}
          >
            {p.label}
          </button>
        ))}
        {/* Calendar — pick ANY day, enters single-day mode (journal + reactions). */}
        <div className="relative">
          <button
            type="button"
            onClick={pickDay}
            aria-label="Alege o zi din calendar"
            title="Alege o zi din calendar"
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              period === 'day'
                ? 'text-white'
                : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'
            }`}
            style={period === 'day' ? { background: '#5b5bd6' } : undefined}
          >
            📅{period === 'day' && selectedDay ? <span className="num">{fmtDate(selectedDay)}</span> : null}
          </button>
          <input
            ref={dayInputRef}
            type="date"
            value={selectedDay}
            min={minDate || undefined}
            max={maxDate || undefined}
            onChange={e => {
              const v = e.target.value;
              if (!v) return;
              setSelectedDay(v);
              setPeriod('day');
            }}
            className="absolute left-0 bottom-0 w-px h-px opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </div>

      <SleepSchedule rows={schedule} currentUser={currentUser} />

      {/* ===== Section title ===== */}
      <div className="flex items-baseline justify-between gap-2 px-4 sm:px-6 pt-3.5 pb-1">
        <span className="text-[11px] font-bold tracking-[.16em] text-[var(--color-fg-muted)] uppercase truncate">
          clasament · {periodLabel}
        </span>
        <span className="hidden sm:block text-[10px] text-[var(--color-fg-dim)] shrink-0">
          {singleDay ? 'ziua selectată · mesaje + reacții' : 'medii pe interval · fără mesaje'}
        </span>
      </div>

      {/* ===== Player rows ===== */}
      <div>
        {rows.map((r, i) => (
          <LeaderRow
            key={r.name}
            row={r}
            rank={i}
            isMe={r.name === currentUser}
            entries={entries}
            dayEntry={singleDay ? dayEntries.get(r.name) ?? null : null}
            singleDay={singleDay}
            currentUser={currentUser}
            onOpen={setOpenRow}
          />
        ))}
      </div>
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

/* ─── One player row: rank square + banner + (single-day) journal/social ── */

function LeaderRow({ row, rank, isMe, entries, dayEntry, singleDay, currentUser, onOpen }: {
  row: Row;
  rank: number;
  isMe: boolean;
  entries: SleepEntry[];
  /** The entry for the selected day — null in period (averages) views. */
  dayEntry: SleepEntry | null;
  singleDay: boolean;
  currentUser: string;
  onOpen: (row: Row) => void;
}) {
  const c = personColor(row.name);
  const tier = tierFor(row.level);
  const look = RANK_LOOK[Math.min(rank, RANK_LOOK.length - 1)];
  const sc = row.hasData ? ssColor(row.ss) : '#52525b';

  // SS sparkline for the last 7 days — lives inside the slanted score block.
  const { sparkValues, sparkDates } = useMemo(() => {
    const last7 = lastNDays(entries.filter(e => e.name === row.name), 7);
    const dates = [...new Set(last7.map(e => e.date))].sort();
    return {
      sparkValues: dates.map(d => last7.find(e => e.date === d)?.ss ?? null),
      sparkDates: dates,
    };
  }, [entries, row.name]);

  // Metric modules — averages/counters on period views, the day's raw numbers
  // on single-day views. (XP/serie are all-time by nature, shown in both.)
  const metrics: { k: string; v: string; c: string }[] = [];
  if (row.hasData) {
    if (!singleDay) {
      metrics.push({ k: 'xp', v: String(row.xp), c: '#a78bfa' });
      if (row.nights90 > 0) metrics.push({ k: '90+', v: `${row.nights90}×`, c: 'var(--color-good)' });
      if (row.nights80 > 0) metrics.push({ k: '80+', v: `${row.nights80}×`, c: '#5aa7ff' });
    } else if (row.rem != null) {
      metrics.push({ k: 'rem', v: `${row.rem}m`, c: remColor(row.rem) });
    }
    if (row.rhr > 0) metrics.push({ k: 'rhr', v: String(row.rhr), c: rhrColor(row.rhr, personSex(row.name)) });
    if (row.hrv != null) metrics.push({ k: 'hrv', v: String(row.hrv), c: hrvColor(row.hrv) });
    if (row.dur != null) metrics.push({ k: 'somn', v: fmtDuration(row.dur), c: durationColor(row.dur) });
    metrics.push({ k: 'serie', v: `${row.streak}d`, c: 'var(--color-fg-muted)' });
  }

  return (
    <div
      className={`flex gap-3 sm:gap-3.5 px-3 sm:px-6 py-4 border-t border-[var(--color-border)]/60 items-start ${
        row.godMode ? 'god-aura' : row.elite ? 'elite-glow' : ''
      }`}
      style={isMe ? { background: 'color-mix(in srgb, var(--color-accent) 4%, transparent)' } : undefined}
    >
      {/* Rank square — gold / silver / bronze with glow */}
      <div
        className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center font-extrabold text-base mt-2"
        style={{ background: look.bg, boxShadow: look.glow, color: '#131320' }}
        aria-label={`locul ${rank + 1}`}
      >
        {rank + 1}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        {/* Banner — identity | diagonal separators | metric modules | slanted SS block */}
        {/* Identity and the SS score stay pinned; only the middle metric strip
            scrolls when there isn't room — the score is never pushed off-screen. */}
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="w-full text-left flex items-stretch rounded-xl overflow-hidden min-h-[56px] bg-[var(--color-surface)] cursor-pointer hover:brightness-110 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          style={{ border: `1px solid ${isMe ? 'color-mix(in srgb, var(--color-accent) 35%, transparent)' : 'var(--color-border)'}` }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2 min-w-0 shrink-0">
            <Avi name={row.name} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-extrabold text-sm" style={{ color: c }}>{FIRST_NAME[row.name]}</span>
                {isMe && (
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}>TU</span>
                )}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: `${tier.color}15`, color: tier.color }}>
                  {tier.icon} Lv{row.level}
                </span>
                {row.godMode && (
                  <span className="god-text text-[9px] font-black tracking-wider" title="God Mode activ — a prins o noapte de 95+ în ultimele 7 zile">💯</span>
                )}
                {row.elite && (
                  <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }} title="Noapte de 90+ în ultimele 7 zile">🌟</span>
                )}
              </div>
              <div className="text-[11px] mt-0.5 tracking-[2px] opacity-90 whitespace-nowrap">
                {row.badges.slice(0, 4).map((b, i) => (
                  <span key={i} title={b.label} aria-label={b.label}>{b.emoji}</span>
                ))}
                {row.periodBadges.length > 0 && !singleDay && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] px-1 py-px ml-1 rounded-full border border-[#fbbf24]/40 bg-[#fbbf24]/10 align-middle"
                    title={`Lider în interval: ${row.periodBadges.map(b => b.label).join(', ')}`}
                  >
                    {row.periodBadges.slice(0, 4).map((b, i) => <span key={i}>{b.emoji}</span>)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metric modules as diagonal parallelograms (skewX -18°): the fill
              runs to the slanted edge, content is counter-skewed back upright.
              Last module fades out to the right. Per the Claude Design handoff. */}
          <span className="flex-1 min-w-0 flex items-stretch overflow-x-auto no-scrollbar">
            {metrics.map((m, i) => (
              <span
                key={i}
                className="self-stretch flex items-center px-3.5 sm:px-4 whitespace-nowrap shrink-0"
                style={{
                  transform: 'skewX(-18deg)',
                  borderLeft: '1px solid color-mix(in srgb, var(--color-fg) 14%, transparent)',
                  background: i === metrics.length - 1
                    ? 'linear-gradient(90deg, color-mix(in srgb, var(--color-fg) 5%, transparent), transparent 88%)'
                    : 'color-mix(in srgb, var(--color-fg) 4%, transparent)',
                }}
              >
                <span className="flex flex-col gap-0.5" style={{ transform: 'skewX(18deg)' }}>
                  <span className="text-[9px] font-bold tracking-[.14em] text-[var(--color-fg-dim)] uppercase">{m.k}</span>
                  <span className="text-[13px] font-bold" style={{ color: m.c }}>{m.v}</span>
                </span>
              </span>
            ))}
          </span>

          {/* Slanted SS score block + sparkline — pinned, always visible */}
          <span
            className="shrink-0 flex items-center gap-2.5 pl-6 pr-4 py-2"
            style={{ background: `${sc}14`, clipPath: 'polygon(16px 0, 100% 0, 100% 100%, 0 100%)' }}
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold tracking-[.14em] text-[var(--color-fg-dim)]">SS</span>
              <span className="font-extrabold text-[22px] leading-none" style={{ color: sc }}>
                {row.hasData ? row.ss : '—'}
              </span>
            </span>
            <Sparkline values={sparkValues} dates={sparkDates} width={54} height={22} color={sc} className="hidden sm:block" />
          </span>
        </button>

        {!row.hasData && !singleDay && (
          <div className="text-xs italic text-[var(--color-fg-dim)] px-1">niciun log în interval</div>
        )}

        {/* Journal + social — ONLY on single-day views. Period tabs show averages. */}
        {singleDay && dayEntry && (
          <div className="px-0.5">
            <div className="text-[10px] text-[var(--color-fg-dim)]">
              {dayLabel(dayEntry.date)}{dayEntry.end ? ` · ${dayEntry.end}` : ''}
            </div>
            {dayEntry.journal && (
              <p className="text-[13px] italic text-[var(--color-fg)]/75 mt-1 whitespace-pre-line break-words">
                “{dayEntry.journal}”
              </p>
            )}
            <EntryReactions entry={dayEntry} currentUser={currentUser} />
          </div>
        )}
        {singleDay && !dayEntry && (
          <div className="text-[11px] italic text-[var(--color-fg-dim)] px-1">fără log în ziua asta</div>
        )}
      </div>
    </div>
  );
}

/** "mie · 22 iul" — the date line under the banner, matching the design. */
function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const wd = d.toLocaleDateString('ro-RO', { weekday: 'short' }).replace('.', '');
  const dm = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }).replace('.', '');
  return `${wd} · ${dm}`;
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
