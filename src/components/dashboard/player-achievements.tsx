'use client';
import { useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { computeAchievements, achievementHint, type AchievementProgress } from '@/lib/gamify';
import { AchievementDetailModal } from '@/components/dashboard/achievement-detail';

/**
 * Garmin-style achievement grid — 12 badges × 4 tiers.
 *
 * Compact 3-up cards so the whole set fits the player modal without scrolling;
 * tapping one opens the full explainer on top (see AchievementDetailModal).
 * Pure derivation from SleepEntry[] — no persistence, no leader-takes-all.
 */
export function PlayerAchievements({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const progress = computeAchievements(entries, name);
  const [open, setOpen] = useState<AchievementProgress | null>(null);
  const totalTiers = progress.reduce((s, p) => s + p.tiersReached, 0);
  const mastery = progress.reduce((s, p) => s + p.pct, 0);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <div className="label">Realizări <span className="text-[var(--color-fg-dim)] normal-case tracking-normal font-normal">· apasă pentru detalii</span></div>
        <div className="text-[10px] num text-[var(--color-fg-muted)]">
          <span className="font-bold text-[var(--color-fg)]">{totalTiers}</span> tieruri
        </div>
      </div>

      {/* Mastery — the whole point of badges now. Not a pile of XP: a permanent
          percentage on every night, forever. */}
      <div
        className="rounded-lg border px-2.5 py-1.5 mb-2 flex items-center gap-2"
        style={{ borderColor: '#a3e63555', background: '#a3e6350d' }}
      >
        <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--color-fg-muted)]">Măiestrie</span>
        <span className="num font-bold text-sm" style={{ color: '#a3e635' }}>+{Math.round(mastery * 100)}%</span>
        <span className="text-[9px] text-[var(--color-fg-dim)] ml-auto text-right leading-tight">
          la XP-ul fiecărei nopți · permanent
        </span>
      </div>

      {/* 13 badges, 5-up = 3 rows. The whole set has to clear the fold inside the
          player modal — the detail lives one tap away, not in this grid. */}
      <div className="grid grid-cols-5 gap-1">
        {progress.map(p => (
          <AchievementCard key={p.achievement.id} p={p} name={name} onOpen={() => setOpen(p)} />
        ))}
      </div>

      <AchievementDetailModal progress={open} name={name} onClose={() => setOpen(null)} />
    </section>
  );
}

function AchievementCard({ p, name, onOpen }: { p: AchievementProgress; name: string; onOpen: () => void }) {
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
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${a.name} — ${achievementHint(a, name)}. ${tier ? `${tier.label}, +${Math.round(tier.pct * 100)}% XP permanent` : 'neînceput'}, ${p.count} nopți.`}
      className="rounded-lg border px-1.5 py-1.5 flex flex-col gap-1 text-left transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      style={{
        borderColor: locked ? 'var(--color-border)' : tint + '55',
        background: locked ? 'var(--color-surface)' : `color-mix(in srgb, ${tint} 8%, var(--color-surface))`,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <div className="flex items-start gap-1">
        <span className="text-base leading-none" aria-hidden style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{a.icon}</span>
        {p.count > 0 && (
          <span className="num text-[9px] font-bold text-[var(--color-fg-muted)] ml-auto shrink-0">×{p.count}</span>
        )}
      </div>

      <div className="text-[9px] font-bold text-[var(--color-fg)] leading-tight truncate">{a.name}</div>

      {/* Tier ladder — 4 segments colored by whether reached */}
      <div className="flex items-center gap-0.5">
        {a.tiers.map((t, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ background: i < p.tiersReached ? t.color : 'var(--color-border)' }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[8px] gap-0.5">
        {tier ? (
          <span className="num font-bold shrink-0" style={{ color: tint }}>+{Math.round(tier.pct * 100)}%</span>
        ) : (
          <span className="text-[var(--color-fg-dim)] italic truncate">—</span>
        )}
        {next ? (
          <span className="num text-[var(--color-fg-dim)] shrink-0">{p.count}/{next.threshold}</span>
        ) : (
          <span className="num font-bold shrink-0" style={{ color: '#22d3ee' }}>MAX</span>
        )}
      </div>

      {next && (
        <div className="h-0.5 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${fill * 100}%`, background: next.color }} />
        </div>
      )}
    </button>
  );
}
