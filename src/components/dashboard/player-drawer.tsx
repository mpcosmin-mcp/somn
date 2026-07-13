'use client';
import { useState } from 'react';
import {
  type SleepEntry,
  FIRST_NAME, personColor, personSex,
  ssColor, remColor, hrvColor, rhrColor, durationColor,
  sleepDurationMin, fmtDuration,
} from '@/lib/sleep';
import { coachInsights, type InsightTone } from '@/lib/coach';
import { tierFor, maxStreakFor, todayISO, MAX_LEVEL } from '@/lib/gamify';
import { Avi } from '@/components/ui/avi';
import { PlayerAchievements } from '@/components/dashboard/player-achievements';
import { PlayerMomentum } from '@/components/dashboard/player-momentum';
import { TierLadderModal } from '@/components/dashboard/achievement-detail';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Player card — deliberately fits without scrolling.
 *
 * Everything that needs a paragraph to explain (Momentum, each badge, the tier
 * ladder) lives behind a tap, in its own modal. What stays here is only what you
 * read at a glance: who, how fast, last night, what you lead, what you've earned.
 */
export interface PlayerSummary {
  name: string;
  ss: number;
  level: number;
  xp: number;
  streak: number;
  /** Permanent all-time distinctions. */
  badges: { emoji: string; label: string }[];
  /** Crowns for the period selected in the leaderboard. */
  periodBadges: { emoji: string; label: string }[];
  hasData: boolean;
}

const TONE: Record<InsightTone, string> = {
  warn: 'var(--color-warn)',
  good: 'var(--color-good)',
  tip: 'var(--color-accent)',
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

/** Compact header chip for the Modal's sticky title bar. */
export function PlayerDrawerTitle({ player }: { player: PlayerSummary }) {
  const c = personColor(player.name);
  const tier = tierFor(player.level);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Avi name={player.name} size="sm" />
      <span className="font-bold text-sm truncate" style={{ color: c }}>{FIRST_NAME[player.name] ?? player.name.split(' ')[0]}</span>
      <span className="text-[9px] num font-bold px-1 py-0.5 rounded shrink-0" style={{ color: tier.color, background: tier.color + '18' }}>
        {tier.icon} Lv{player.level}
      </span>
    </div>
  );
}

export function PlayerDrawer({ player, entries, currentUser, periodLabel }: {
  player: PlayerSummary;
  entries: SleepEntry[];
  currentUser: string;
  periodLabel: string;
}) {
  const [ladderOpen, setLadderOpen] = useState(false);
  const c = personColor(player.name);
  const isMe = player.name === currentUser;
  const fn = FIRST_NAME[player.name] ?? player.name.split(' ')[0];
  const tier = tierFor(player.level);
  const maxed = player.level >= MAX_LEVEL;

  const mine = entries.filter(e => e.name === player.name).sort((a, b) => a.date.localeCompare(b.date));
  const last = mine[mine.length - 1] ?? null;
  const lastDur = last ? sleepDurationMin(last.start, last.end) : null;

  const last7 = mine.slice(-7);
  const prev7 = mine.slice(-14, -7);
  const wow = (last7.length && prev7.length) ? Math.round(avg(last7.map(e => e.ss)) - avg(prev7.map(e => e.ss))) : null;

  const insight = coachInsights(entries, player.name, 1)[0] ?? null;
  const maxStreak = maxStreakFor(entries, player.name);

  // One flat row of chips — period crowns first (they're live), then the
  // permanent ones. Two separate sections cost a heading each and said little.
  const chips = [
    ...player.periodBadges.map(b => ({ ...b, period: true })),
    ...player.badges.map(b => ({ ...b, period: false })),
    ...(maxStreak >= 2 ? [{ emoji: '🏅', label: `record ${maxStreak}z`, period: false }] : []),
  ];

  return (
    <div className="px-5 py-3 flex flex-col gap-2.5">
      {/* Hero — avatar, name, level chip (→ ladder), SS */}
      <div className="flex items-center gap-3">
        <Avi name={player.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-base font-bold" style={{ color: c }}>{fn}</span>
            {isMe && <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--color-accent)]">tu</span>}
            {player.streak >= 1 && <span className="text-[10px] num text-[var(--color-fg-muted)]">🔥 {player.streak}z</span>}
          </div>
          <button
            type="button"
            onClick={() => setLadderOpen(true)}
            className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] num font-bold px-1.5 py-0.5 rounded transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ color: tier.color, background: tier.color + '18' }}
            aria-label={`Nivel ${player.level}, ${tier.name} — vezi toate palierele`}
          >
            {tier.icon} Lv{player.level}{maxed && ' · MAX'} · {tier.name}
            <span className="num text-[var(--color-fg-muted)]">{player.xp} XP</span>
            <span aria-hidden className="text-[var(--color-fg-dim)]">›</span>
          </button>
        </div>
        <div className="text-right shrink-0">
          <div className="num font-bold leading-none text-2xl tracking-tight" style={{ color: player.hasData ? ssColor(player.ss) : 'var(--color-fg-dim)' }}>
            {player.hasData ? player.ss : '—'}
          </div>
          <div className="text-[9px] text-[var(--color-fg-muted)] mt-0.5">
            SS
            {wow != null && wow !== 0 && (
              <span className="num font-bold ml-1" style={{ color: wow > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                {wow > 0 ? '↑' : '↓'}{Math.abs(wow)}
              </span>
            )}
          </div>
        </div>
      </div>

      <PlayerMomentum entries={entries} name={player.name} />

      {/* Last night — five numbers, one row */}
      {last && (
        <section>
          <div className="label mb-1">{last.date === todayISO() ? 'Azi' : 'Ultimul log'}</div>
          <div className="grid grid-cols-5 gap-1.5">
            <Stat label="SS" value={last.ss} color={ssColor(last.ss)} />
            <Stat label="Somn" value={lastDur != null ? fmtDuration(lastDur) : '—'} color={durationColor(lastDur)} />
            <Stat label="REM" value={last.rem != null ? `${last.rem}m` : '—'} color={remColor(last.rem)} />
            <Stat label="HRV" value={last.hrv != null ? last.hrv : '—'} color={hrvColor(last.hrv)} />
            <Stat label="RHR" value={last.rhr > 0 ? last.rhr : '—'} color={last.rhr > 0 ? rhrColor(last.rhr, personSex(player.name)) : 'var(--color-fg-dim)'} />
          </div>
        </section>
      )}

      {/* Distinctions — period crowns ringed gold, permanent ones plain */}
      {chips.length > 0 && (
        <section>
          <div className="label mb-1">
            Distincții <span className="normal-case tracking-normal font-normal text-[var(--color-fg-dim)]">· 🏆 = lider {periodLabel}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {chips.map((b, i) => (
              <span
                key={i}
                title={b.label}
                className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border"
                style={b.period
                  ? { borderColor: '#fbbf2466', background: '#fbbf2414' }
                  : { borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <span aria-hidden>{b.emoji}</span> {b.label}
              </span>
            ))}
          </div>
        </section>
      )}

      <PlayerAchievements entries={entries} name={player.name} />

      {/* One insight, one line */}
      {insight && (
        <div
          className="rounded-lg border px-2.5 py-1.5"
          style={{ background: `color-mix(in srgb, ${TONE[insight.tone]} 8%, transparent)`, borderColor: `color-mix(in srgb, ${TONE[insight.tone]} 26%, transparent)` }}
        >
          <div className="text-[10px] font-medium text-[var(--color-fg)] leading-snug">{insight.title}</div>
          <div className="text-[9px] text-[var(--color-fg-muted)] leading-snug">{insight.body}</div>
        </div>
      )}

      <Link
        href="/ghid"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-accent)]/40 transition-colors"
      >
        <BookOpen size={12} /> Reguli & categorii →
      </Link>

      <TierLadderModal
        open={ladderOpen}
        onClose={() => setLadderOpen(false)}
        entries={entries}
        name={player.name}
      />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-1 py-1 text-center">
      <div className="label mb-0.5">{label}</div>
      <div className="num font-bold text-xs leading-none" style={{ color }}>{value}</div>
    </div>
  );
}
