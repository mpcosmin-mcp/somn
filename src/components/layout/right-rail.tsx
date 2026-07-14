'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { useActivities } from '@/lib/use-activities';
import { FIRST_NAME, personColor, ssColor } from '@/lib/sleep';
import { calcXP, xpLevel, levelProgress, tierFor, streakFor, maxStreakFor } from '@/lib/gamify';
import { attendanceCount, ACTIVITY_TIERS } from '@/lib/activities';
import { Avi } from '@/components/ui/avi';
import { PlayerAchievements } from '@/components/dashboard/player-achievements';

/**
 * Right rail (xl+) — the "Player Hub". Your score of the moment sits next to
 * your name, your medals live here as a showcase (no need to open a leaderboard
 * card), and records collapse into an accordion. Every number is derived from
 * the engine / entries, never hardcoded.
 */
export function RightRail() {
  const { user } = useUser();
  const { entries } = useEntries();
  const { bookings } = useActivities();
  const [recordsOpen, setRecordsOpen] = useState(false);

  if (!user) return null;

  const c = personColor(user);
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const xp = calcXP(entries, user);
  const lvl = xpLevel(xp);
  const tier = tierFor(lvl);
  const streak = streakFor(entries, user);
  const { into, need, pct, maxed } = levelProgress(xp);

  const mine = entries.filter(e => e.name === user).sort((a, b) => a.date.localeCompare(b.date));
  const lastSS = mine.length ? mine[mine.length - 1].ss : null;
  const bestSS = mine.length ? Math.max(...mine.map(e => e.ss)) : 0;
  const remVals = mine.map(e => e.rem).filter((v): v is number => v != null);
  const bestREM = remVals.length ? Math.max(...remVals) : 0;
  const maxStreak = maxStreakFor(entries, user);

  const attended = attendanceCount(bookings, user);
  const nextTier = ACTIVITY_TIERS.find(t => attended < t.threshold) ?? null;
  const curTier = [...ACTIVITY_TIERS].reverse().find(t => attended >= t.threshold) ?? null;

  return (
    <aside className="hidden xl:flex xl:flex-col fixed right-0 top-14 bottom-0 w-[300px] border-l border-[var(--color-border)] bg-[var(--color-bg)]/70 backdrop-blur-sm overflow-y-auto px-4 py-4 gap-4">
      {/* Identity + score of the moment */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: `linear-gradient(135deg, ${c}14, transparent 70%)` }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Avi name={user} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-base truncate" style={{ color: c }}>{fn}</div>
            <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
              <span style={{ color: tier.color }}>{tier.icon}</span>
              <span className="num font-semibold">Lv {lvl}</span>
              <span className="text-[var(--color-fg-dim)]">·</span>
              <span className="truncate">{tier.name}</span>
            </div>
          </div>
          {/* Score of the moment — big, right next to the name */}
          <div className="text-right shrink-0">
            <div className="num font-bold text-3xl leading-none" style={{ color: lastSS != null ? ssColor(lastSS) : 'var(--color-fg-dim)' }}>
              {lastSS ?? '—'}
            </div>
            <div className="text-[8px] uppercase tracking-wider text-[var(--color-fg-dim)]">azi</div>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="num font-bold text-[var(--color-accent)]">{xp} XP</span>
            {streak > 0 && <span className="num font-bold text-[var(--color-accent)]">{streak}d 🔥</span>}
          </div>
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-accent-soft), var(--color-accent))' }} />
          </div>
          <div className="flex justify-between text-[9px] num text-[var(--color-fg-dim)] mt-1">
            {maxed
              ? <><span className="font-bold" style={{ color: tier.color }}>NIVEL MAXIM</span><span>Lv {lvl}</span></>
              : <><span>spre Lv {lvl + 1}</span><span>{into}/{need}</span></>}
          </div>
        </div>
      </div>

      {/* Badges showcase — medals live here, no leaderboard click needed */}
      {mine.length > 0 && <PlayerAchievements entries={entries} name={user} />}

      {/* Records — accordion */}
      {mine.length > 0 && (
        <section>
          <button
            onClick={() => setRecordsOpen(o => !o)}
            aria-expanded={recordsOpen}
            className="w-full flex items-center justify-between group"
          >
            <span className="label">Recorduri</span>
            <span className="flex items-center gap-1.5 text-[10px] num text-[var(--color-fg-muted)]">
              {!recordsOpen && <span>🏆 {bestSS} · 🌙 {bestREM} · 🔥 {maxStreak}</span>}
              <ChevronDown size={14} className={`transition-transform ${recordsOpen ? 'rotate-180' : ''} text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]`} />
            </span>
          </button>
          {recordsOpen && (
            <div className="grid grid-cols-3 gap-2 mt-2 rail-in">
              <RecordCell emoji="🏆" value={bestSS} unit="SS" color={c} />
              <RecordCell emoji="🌙" value={bestREM} unit="min REM" color={c} />
              <RecordCell emoji="🔥" value={maxStreak} unit="zile" color={c} />
            </div>
          )}
        </section>
      )}

      {/* 🏃 Activ badge */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="label">🏃 Activ</span>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="num text-2xl font-bold leading-none" style={{ color: c }}>{attended}</span>
              <span className="text-[10px] text-[var(--color-fg-muted)]">antrenamente</span>
            </div>
            <span className="num text-xs font-bold" style={{ color: curTier?.color ?? 'var(--color-fg-dim)' }}>
              {curTier?.label ?? '—'}
            </span>
          </div>
          {nextTier && (
            <div className="mt-2">
              <div className="h-1 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (attended / nextTier.threshold) * 100)}%`, background: nextTier.color }} />
              </div>
              <div className="text-[9px] num text-[var(--color-fg-dim)] mt-1">
                încă {nextTier.threshold - attended} până la {nextTier.label}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="text-[10px] text-[var(--color-fg-muted)] num mt-auto">
        <span className="font-bold text-[var(--color-fg)]">{mine.length}</span> loguri ·{' '}
        <span className="font-bold text-[var(--color-fg)]">{new Set(mine.map(e => e.date)).size}</span> zile
      </div>
    </aside>
  );
}

function RecordCell({ emoji, value, unit, color }: { emoji: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-xl px-2 py-2 text-center" style={{ background: color + '0d', border: `1px solid ${color}22` }}>
      <div className="text-base leading-none mb-1" aria-hidden>{emoji}</div>
      <div className="num font-bold text-sm leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] text-[var(--color-fg-muted)] mt-0.5 leading-tight">{unit}</div>
    </div>
  );
}
