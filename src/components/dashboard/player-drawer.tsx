'use client';
import {
  type SleepEntry,
  FIRST_NAME, personColor, personSex,
  ssColor, remColor, hrvColor, rhrColor, durationColor,
  sleepDurationMin, fmtDuration,
} from '@/lib/sleep';
import { coachInsights, type InsightTone } from '@/lib/coach';
import { tierFor, maxStreakFor } from '@/lib/gamify';
import { Avi } from '@/components/ui/avi';
import { PlayerAchievements } from '@/components/dashboard/player-achievements';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/** Minimal shape the drawer needs — a Leaderboard row is structurally compatible. */
export interface PlayerSummary {
  name: string;
  ss: number;
  level: number;
  xp: number;
  streak: number;
  badges: { emoji: string; label: string }[];
  hasData: boolean;
}

const TONE: Record<InsightTone, string> = {
  warn: 'var(--color-warn)',
  good: 'var(--color-good)',
  tip: 'var(--color-accent)',
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);

/** Compact header chip for the Drawer's sticky title bar. */
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

export function PlayerDrawer({ player, entries, currentUser }: {
  player: PlayerSummary;
  entries: SleepEntry[];
  currentUser: string;
}) {
  const c = personColor(player.name);
  const isMe = player.name === currentUser;
  const fn = FIRST_NAME[player.name] ?? player.name.split(' ')[0];

  const mine = entries.filter(e => e.name === player.name).sort((a, b) => a.date.localeCompare(b.date));
  const last = mine[mine.length - 1] ?? null;
  const lastDur = last ? sleepDurationMin(last.start, last.end) : null;

  // Δ vs last week (avg SS of last 7 logs vs the 7 before).
  const last7 = mine.slice(-7);
  const prev7 = mine.slice(-14, -7);
  const wow = (last7.length && prev7.length) ? Math.round(avg(last7.map(e => e.ss)) - avg(prev7.map(e => e.ss))) : null;

  const insights = coachInsights(entries, player.name, 1);
  const maxStreak = maxStreakFor(entries, player.name);

  return (
    <div className="px-5 py-4 flex flex-col gap-5">
      {/* Hero */}
      <div className="flex items-start gap-4">
        <Avi name={player.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold" style={{ color: c }}>{fn}</span>
            {isMe && <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--color-accent)]">tu</span>}
            {player.streak >= 1 && <span className="text-xs num text-[var(--color-fg-muted)]">🔥 {player.streak}z</span>}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="num font-bold leading-none text-4xl tracking-tight" style={{ color: player.hasData ? ssColor(player.ss) : 'var(--color-fg-dim)' }}>
              {player.hasData ? player.ss : '—'}
            </span>
            <span className="text-xs text-[var(--color-fg-muted)]">SS</span>
            {wow != null && wow !== 0 && (
              <span className="num text-xs font-bold ml-1" style={{ color: wow > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                {wow > 0 ? '↑' : '↓'}{Math.abs(wow)} vs săpt. trecută
              </span>
            )}
          </div>
        </div>
      </div>

      {/* TODAY */}
      <section>
        <div className="label mb-2">{last && last.date === todayISO() ? 'Azi' : 'Ultimul log'}</div>
        {last ? (
          <div className="grid grid-cols-3 gap-2">
            <Stat label="SS" value={last.ss} color={ssColor(last.ss)} />
            <Stat label="Somn" value={lastDur != null ? fmtDuration(lastDur) : '—'} color={durationColor(lastDur)} />
            <Stat label="REM" value={last.rem != null ? `${last.rem}m` : '—'} color={remColor(last.rem)} />
            <Stat label="HRV" value={last.hrv != null ? last.hrv : '—'} color={hrvColor(last.hrv)} />
            <Stat label="RHR" value={last.rhr > 0 ? last.rhr : '—'} color={last.rhr > 0 ? rhrColor(last.rhr, personSex(player.name)) : 'var(--color-fg-dim)'} />
          </div>
        ) : (
          <div className="text-xs text-[var(--color-fg-muted)] italic">niciun log încă</div>
        )}
      </section>

      {/* Insights */}
      <section>
        <div className="label mb-2">Insights</div>
        <div className="flex flex-col gap-2">
          {insights.map(i => (
            <div key={i.id} className="rounded-xl border px-3 py-2.5" style={{ background: `color-mix(in srgb, ${TONE[i.tone]} 8%, transparent)`, borderColor: `color-mix(in srgb, ${TONE[i.tone]} 26%, transparent)` }}>
              <div className="text-xs font-medium text-[var(--color-fg)] leading-snug">{i.title}</div>
              <div className="text-[11px] text-[var(--color-fg-muted)] leading-snug mt-0.5">{i.body}</div>
              {i.source && <div className="text-[9px] text-[var(--color-fg-dim)] mt-1">📖 {i.source}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Distincții — cine e #1 în echipă pe fiecare metrică (rămân în modal) */}
      {(player.badges.length > 0 || maxStreak >= 2) && (
        <section>
          <div className="label mb-2">Distincții</div>
          <div className="flex flex-wrap gap-1.5">
            {player.badges.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span aria-hidden>{b.emoji}</span> {b.label}
              </span>
            ))}
            {maxStreak >= 2 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span aria-hidden>🏅</span> record {maxStreak}z streak
              </span>
            )}
          </div>
        </section>
      )}

      <PlayerAchievements entries={entries} name={player.name} />

      {/* XP logic moved out of the modal → the rulebook page */}
      <Link
        href="/ghid"
        className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-xs font-bold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-accent)]/40 transition-colors"
      >
        <BookOpen size={15} /> Cum câștigi XP · reguli & categorii →
      </Link>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-2 text-center">
      <div className="label mb-0.5">{label}</div>
      <div className="num font-bold text-base leading-none" style={{ color }}>{value}</div>
    </div>
  );
}
