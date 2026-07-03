'use client';
import {
  type SleepEntry,
  FIRST_NAME, personColor,
  ssColor, remColor, hrvColor, rhrColor, durationColor,
  sleepDurationMin, fmtDuration,
} from '@/lib/sleep';
import { coachInsights, type InsightTone } from '@/lib/coach';
import { tierFor, xpProgress, xpBreakdown, XP_PER_LEVEL, TIERS, maxStreakFor } from '@/lib/gamify';
import { Avi } from '@/components/ui/avi';

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
  const prog = xpProgress(player.xp); // 0–99 within the current level

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
            <Stat label="RHR" value={last.rhr > 0 ? last.rhr : '—'} color={last.rhr > 0 ? rhrColor(last.rhr) : 'var(--color-fg-dim)'} />
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

      {/* XP & Level Explained */}
      <XPExplained player={player} entries={entries} prog={prog} maxStreak={maxStreak} />
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

function XPExplained({ player, entries, prog, maxStreak }: {
  player: PlayerSummary;
  entries: SleepEntry[];
  prog: number;
  maxStreak: number;
}) {
  const bd = xpBreakdown(entries, player.name);
  const tier = tierFor(player.level);
  const nextTier = TIERS.find(t => t.minLevel > player.level);
  const xpToNext = XP_PER_LEVEL - prog;

  return (
    <section>
      <div className="label mb-2">XP & Level</div>

      {/* Level + progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] num font-bold px-1.5 py-0.5 rounded" style={{ color: tier.color, background: tier.color + '18' }}>
              {tier.icon} {tier.name}
            </span>
            <span className="text-[10px] num text-[var(--color-fg-muted)]">Lv {player.level}</span>
          </div>
          <span className="text-[10px] num text-[var(--color-fg-muted)]">{prog}/{XP_PER_LEVEL} XP</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${prog}%`, background: 'var(--color-accent)' }} />
        </div>
        <div className="text-[10px] text-[var(--color-fg-dim)] mt-1">
          {xpToNext} XP până la Lv {player.level + 1}
          {nextTier && <> · {nextTier.icon} {nextTier.name} la Lv {nextTier.minLevel}</>}
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2.5 mb-3">
        <div className="text-[10px] font-bold text-[var(--color-fg-muted)] uppercase tracking-wider mb-2">Cum se calculează</div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[var(--color-fg-muted)]">{bd.logs} loguri × 10</span>
            <span className="num font-bold text-[var(--color-fg)]">+{bd.base}</span>
          </div>
          {bd.count90 > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">{bd.count90} nopți cu SS ≥ 90 × 10</span>
              <span className="num font-bold text-[var(--color-good)]">+{bd.bonus90}</span>
            </div>
          )}
          {bd.count80 > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">{bd.count80} nopți cu SS ≥ 80 × 5</span>
              <span className="num font-bold text-[var(--color-accent)]">+{bd.bonus80}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-[var(--color-border)]">
            <span className="font-bold text-[var(--color-fg)]">Total XP</span>
            <span className="num font-bold text-[var(--color-fg)]">{bd.total}</span>
          </div>
        </div>
      </div>

      {/* Tier thresholds */}
      <div className="flex gap-1.5 mb-3">
        {TIERS.map(t => (
          <div
            key={t.name}
            className="flex-1 rounded-lg px-2 py-1.5 text-center border"
            style={{
              borderColor: player.level >= t.minLevel ? t.color + '40' : 'var(--color-border)',
              background: player.level >= t.minLevel ? t.color + '12' : 'transparent',
              opacity: player.level >= t.minLevel ? 1 : 0.5,
            }}
          >
            <div className="text-[10px] font-bold" style={{ color: t.color }}>{t.icon} {t.name}</div>
            <div className="text-[9px] num text-[var(--color-fg-dim)]">Lv {t.minLevel}+</div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-3 py-2.5 mb-3">
        <div className="text-[10px] font-bold text-[var(--color-accent)] mb-1.5">Cum câștigi XP</div>
        <ul className="text-[11px] text-[var(--color-fg-muted)] space-y-1">
          <li>• Loghează o noapte → <span className="num font-bold text-[var(--color-fg)]">+10 XP</span></li>
          <li>• Sleep Score ≥ 80 → bonus <span className="num font-bold text-[var(--color-accent)]">+5 XP</span></li>
          <li>• Sleep Score ≥ 90 → bonus <span className="num font-bold text-[var(--color-good)]">+10 XP</span></li>
        </ul>
        <div className="text-[9px] text-[var(--color-fg-dim)] mt-2 leading-snug">
          XP reflectă logurile distincte curente. Dacă nopți duplicate au fost curățate, XP-ul se recalculează automat.
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {player.badges.length ? player.badges.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span aria-hidden>{b.emoji}</span> {b.label}
          </span>
        )) : <span className="text-xs text-[var(--color-fg-dim)] italic">niciun badge încă</span>}
        {maxStreak >= 2 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span aria-hidden>🏅</span> record {maxStreak}z streak
          </span>
        )}
      </div>
    </section>
  );
}
