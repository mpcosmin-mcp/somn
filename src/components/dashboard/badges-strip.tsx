'use client';
import { type SleepEntry } from '@/lib/sleep';
import { badgesFor } from '@/lib/insights';

/**
 * Earned badges chip row for the current user. Locked badges show dimmed
 * so the user sees what's still on the list (motivator).
 */
export function BadgesStrip({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const badges = badgesFor(entries, user);
  const earnedCount = badges.filter(b => b.earned).length;
  if (earnedCount === 0) return null;

  return (
    <section className="card px-5 py-4 lg:py-5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">Badges</span>
        <span className="text-[10px] num text-[var(--color-fg-dim)]">{earnedCount}/{badges.length} deblocate</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.map(b => (
          <div
            key={b.id}
            title={`${b.label} · ${b.hint}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all"
            style={{
              background: b.earned ? `${b.color}18` : 'rgba(148,163,184,0.05)',
              borderColor: b.earned ? `${b.color}55` : 'rgba(148,163,184,0.14)',
              color: b.earned ? b.color : 'var(--color-fg-dim)',
              opacity: b.earned ? 1 : 0.55,
            }}
          >
            <span className="text-sm leading-none">{b.icon}</span>
            <span className="text-[11px] font-bold tracking-wide">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
