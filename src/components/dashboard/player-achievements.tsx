'use client';
import { type SleepEntry } from '@/lib/sleep';
import { computeAchievements, type AchievementProgress } from '@/lib/gamify';

/**
 * Garmin-style achievement grid — 9 badges × 4 tiers.
 * Each card shows current tier, running "×N" count, and progress to next tier.
 * Pure derivation from SleepEntry[] — no persistence, no leader-takes-all.
 */
export function PlayerAchievements({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const progress = computeAchievements(entries, name);
  const totalTiers = progress.reduce((s, p) => s + p.tiersReached, 0);
  const totalXP = progress.reduce((s, p) => s + p.xpEarned, 0);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <div className="label">Realizări</div>
        <div className="text-[10px] num text-[var(--color-fg-muted)]">
          <span className="font-bold text-[var(--color-fg)]">{totalTiers}</span> tieruri · <span className="num font-bold" style={{ color: '#a3e635' }}>+{totalXP} XP</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {progress.map(p => <AchievementCard key={p.achievement.id} p={p} />)}
      </div>
      <div className="text-[9px] text-[var(--color-fg-dim)] mt-2 leading-snug">
        Fiecare badge se numără cumulativ — o dată pentru fiecare noapte care se califică. Când treci un prag (Bronz → Argint → Aur → Platină), primești XP suplimentar. Nimeni nu-ți poate „fura" un badge — sunt personale.
      </div>
    </section>
  );
}

function AchievementCard({ p }: { p: AchievementProgress }) {
  const a = p.achievement;
  const tier = p.currentTier;
  const next = p.nextTier;
  const tint = tier?.color ?? '#3f3f46';
  const locked = p.tiersReached === 0;

  const prevThreshold = tier?.threshold ?? 0;
  const nextThreshold = next?.threshold ?? tier?.threshold ?? 1;
  const span = nextThreshold - prevThreshold || 1;
  const fill = next ? Math.max(0, Math.min(1, (p.count - prevThreshold) / span)) : 1;

  return (
    <div
      className="rounded-xl border px-2.5 py-2 flex flex-col gap-1.5 transition-opacity"
      style={{
        borderColor: locked ? 'var(--color-border)' : tint + '55',
        background: locked ? 'var(--color-surface)' : `color-mix(in srgb, ${tint} 8%, var(--color-surface))`,
        opacity: locked ? 0.55 : 1,
      }}
      title={a.hint}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg leading-none" aria-hidden style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{a.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-[var(--color-fg)] truncate leading-tight">{a.name}</div>
          <div className="text-[9px] text-[var(--color-fg-muted)] truncate leading-tight">{a.hint}</div>
        </div>
        {p.count > 0 && (
          <span className="num text-[10px] font-bold text-[var(--color-fg-muted)] shrink-0">×{p.count}</span>
        )}
      </div>

      {/* Tier ladder — 4 dots colored by whether reached */}
      <div className="flex items-center gap-0.5">
        {a.tiers.map((t, i) => {
          const reached = i < p.tiersReached;
          return (
            <div
              key={i}
              className="flex-1 h-1 rounded-full"
              style={{ background: reached ? t.color : 'var(--color-border)' }}
              title={`${t.label}: ${t.threshold}+ (+${t.xp} XP)`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[9px]">
        {tier ? (
          <span className="font-bold" style={{ color: tint }}>{tier.label}</span>
        ) : (
          <span className="text-[var(--color-fg-dim)] italic">neînceput</span>
        )}
        {next ? (
          <span className="num text-[var(--color-fg-dim)]">
            {p.count}/{next.threshold}
          </span>
        ) : (
          <span className="num font-bold" style={{ color: '#22d3ee' }}>MAX</span>
        )}
      </div>

      {next && (
        <div className="h-0.5 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: next.color }} />
        </div>
      )}
    </div>
  );
}
