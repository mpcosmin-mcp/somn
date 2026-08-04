'use client';
import { useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { computeAchievements, type AchievementProgress } from '@/lib/gamify';
import { AchievementDetailModal } from '@/components/dashboard/achievement-detail';

/**
 * Achievements — three badges, always visible, no accordion.
 *
 * There used to be thirteen badges hiding behind a "Măiestrie +X%" summary card,
 * and that percentage was itself a hidden XP multiplier. Both are gone: badges
 * pay nothing now, so there is nothing to summarise. Three rows fit on screen,
 * which is the whole reason the collapse existed.
 *
 * Each row shows where you stand and the tier you're on; thresholds and the full
 * explainer are one tap away (see AchievementDetailModal).
 *
 * Pure derivation from SleepEntry[] — no persistence, no leader-takes-all.
 */
export function PlayerAchievements({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const progress = computeAchievements(entries, name);
  const [open, setOpen] = useState<AchievementProgress | null>(null);

  const totalTiers = progress.reduce((s, p) => s + p.tiersReached, 0);
  const allTiers = progress.reduce((s, p) => s + p.achievement.tiers.length, 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <span className="label">Realizări</span>
        <span className="text-[10px] num text-[var(--color-fg-muted)]">
          <span className="font-bold text-[var(--color-fg)]">{totalTiers}</span> din {allTiers} tieruri
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {progress.map(p => (
          <AchievementRow key={p.achievement.id} p={p} onOpen={() => setOpen(p)} />
        ))}
      </div>

      <AchievementDetailModal progress={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/**
 * One row = one badge: icon, name, where you stand, tier reached. Thresholds and
 * the long explainer live in the detail modal, one tap away.
 */
function AchievementRow({ p, onOpen }: { p: AchievementProgress; onOpen: () => void }) {
  const a = p.achievement;
  const tier = p.currentTier;
  const tint = tier?.color ?? '#3f3f46';
  const locked = p.tiersReached === 0;
  const maxed = p.nextTier == null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${a.name} — ${p.count} ${a.hint}${tier ? `, nivel ${tier.label}` : ', neînceput'}. Apasă pentru detalii.`}
      className="w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      style={{
        borderColor: locked ? 'var(--color-border)' : tint + '55',
        background: locked ? 'var(--color-surface)' : `color-mix(in srgb, ${tint} 8%, var(--color-surface))`,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <span className="text-base leading-none shrink-0" aria-hidden style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{a.icon}</span>
      <span className="text-[11px] font-bold text-[var(--color-fg)] leading-tight truncate flex-1 min-w-0">{a.name}</span>

      {/* Where you stand, then the tier you're standing on. */}
      <span className="num text-[11px] font-bold shrink-0" style={{ color: locked ? 'var(--color-fg-dim)' : tint }}>{p.count}</span>
      {tier ? (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ color: tint, background: tint + '1f' }}
        >
          {tier.label}{maxed && ' · MAX'}
        </span>
      ) : (
        <span className="text-[10px] text-[var(--color-fg-dim)] shrink-0">blocat</span>
      )}
      <span aria-hidden className="text-[var(--color-fg-dim)] text-[11px] shrink-0">›</span>
    </button>
  );
}
