'use client';
import { type SleepEntry, type AggEntry, NAMES, FIRST_NAME, personColor, aggregate } from '@/lib/sleep';
import { calcXP, xpLevel, xpProgress, XP_PER_LEVEL, tierFor, streakFor } from '@/lib/gamify';
import { Avi } from '@/components/ui/avi';

/**
 * Hover-card preview of a user's profile.
 *
 * Shown next to the user card on the login picker when hovered. Designed as
 * a quick peek — full poster avatar, identity (tier + level + XP bar),
 * current streak, and a "best at" badge computed by comparing this user's
 * aggregates against the team.
 *
 * Hidden on touch viewports (hover doesn't translate). Visual-only — no
 * interactive elements inside, so pointer-events stay off.
 */
export function ProfileHoverCard({
  name,
  entries,
}: {
  name: string;
  entries: SleepEntry[];
}) {
  const c = personColor(name);
  const fn = FIRST_NAME[name] ?? name.split(' ')[0];
  const xp = calcXP(entries, name);
  const lvl = xpLevel(xp);
  const tier = tierFor(lvl);
  const progress = xpProgress(xp);
  const streak = streakFor(entries, name);
  const best = bestAtFor(entries, name);
  const myEntries = entries.filter((e) => e.name === name);
  const lastLog = myEntries.sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div
      className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-3 w-64 z-30 pointer-events-none"
      role="tooltip"
    >
      <div
        className="rounded-2xl border bg-[var(--color-bg)]/95 backdrop-blur-md p-3 shadow-2xl shadow-black/40 fade-in-up"
        style={{ borderColor: c + '40' }}
      >
        <div className="flex items-center gap-3">
          <Avi name={name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate" style={{ color: c }}>
              {fn}
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
              <span style={{ color: tier.color }}>{tier.icon}</span>
              <span className="num font-semibold">Lv {lvl}</span>
              <span className="text-[var(--color-fg-dim)]">·</span>
              <span>{tier.name}</span>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="num font-bold text-[var(--color-accent)]">{xp} XP</span>
            <span className="num text-[var(--color-fg-dim)]">
              {progress}/{XP_PER_LEVEL}
            </span>
          </div>
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${(progress / XP_PER_LEVEL) * 100}%`,
                background: `linear-gradient(90deg, ${c}80, ${c})`,
              }}
            />
          </div>
        </div>

        {/* Streak + Best-at badges. Dedupe: if best-at IS the streak,
            hide the standalone chip (the badge already conveys it). */}
        {(streak > 0 || best) && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {streak > 0 && !best?.label.includes('streak') && (
              <span
                className="text-[10px] num font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-accent)15', color: 'var(--color-accent)' }}
              >
                🔥 {streak}d streak
              </span>
            )}
            {best && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: c + '15', color: c }}
              >
                {best.emoji} {best.label}
              </span>
            )}
          </div>
        )}

        {/* Last log hint */}
        {lastLog && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[10px] text-[var(--color-fg-muted)] flex items-center justify-between">
            <span>ultimul log</span>
            <span className="num font-semibold text-[var(--color-fg)]">
              SS {lastLog.ss}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compute the metric where this user ranks #1 across the team.
 * Returns null when there's no data to compare.
 *
 * Priority: streak > REM > HRV > SS > RHR. Streaks beat raw averages
 * because they reward consistency, which is what we want to celebrate.
 */
function bestAtFor(
  entries: SleepEntry[],
  user: string,
): { emoji: string; label: string } | null {
  if (!entries.length) return null;
  const agg = aggregate(entries);
  const me = agg.find((a) => a.name === user);
  if (!me) return null;

  // Streak first — most impressive form of consistency
  const myStreak = streakFor(entries, user);
  if (myStreak >= 3) {
    const teamStreaks = NAMES.map((n) => streakFor(entries, n));
    if (myStreak === Math.max(...teamStreaks)) {
      return { emoji: '🔥', label: `top streak (${myStreak}d)` };
    }
  }

  // Then average metrics
  const checks: Array<{
    key: keyof Pick<AggEntry, 'rem' | 'hrv' | 'ss' | 'rhr'>;
    better: 'higher' | 'lower';
    emoji: string;
    label: string;
  }> = [
    { key: 'rem', better: 'higher', emoji: '🌙', label: 'REM master' },
    { key: 'hrv', better: 'higher', emoji: '⚡', label: 'top HRV' },
    { key: 'ss', better: 'higher', emoji: '👑', label: 'top SS avg' },
    { key: 'rhr', better: 'lower', emoji: '🫀', label: 'lowest RHR' },
  ];

  for (const c of checks) {
    const myVal = me[c.key];
    if (myVal == null) continue;
    const teamVals = agg
      .map((a) => a[c.key])
      .filter((v): v is number => v != null);
    if (!teamVals.length) continue;
    const best = c.better === 'higher' ? Math.max(...teamVals) : Math.min(...teamVals);
    if (myVal === best) return { emoji: c.emoji, label: c.label };
  }

  return null;
}
