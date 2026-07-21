'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { type SleepEntry } from '@/lib/sleep';
import { computeAchievements, achievementHint, type AchievementProgress } from '@/lib/gamify';
import { AchievementDetailModal } from '@/components/dashboard/achievement-detail';

/**
 * Achievements — minimalist by default, full detail one tap away.
 *
 * Collapsed: just the *current status* — Măiestrie %, how many tiers you've
 * cleared, and a compact strip of the badges you've actually earned. That's the
 * whole "how am I doing" glance, no wall of numbers.
 *
 * Expanded (tap the header): the full 13-badge × 4-tier grid, each card still
 * opening its own explainer on top (see AchievementDetailModal).
 *
 * Pure derivation from SleepEntry[] — no persistence, no leader-takes-all.
 */
export function PlayerAchievements({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const progress = computeAchievements(entries, name);
  const [open, setOpen] = useState<AchievementProgress | null>(null);
  const [expanded, setExpanded] = useState(false);

  const totalTiers = progress.reduce((s, p) => s + p.tiersReached, 0);
  const mastery = progress.reduce((s, p) => s + p.pct, 0);
  const earned = progress.filter(p => p.tiersReached > 0);

  return (
    <section>
      {/* Status header — tap to expand the full grid */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between group mb-1"
      >
        <span className="label">Realizări</span>
        <span className="flex items-center gap-1.5 text-[10px] num text-[var(--color-fg-muted)]">
          <span className="font-bold text-[var(--color-fg)]">{totalTiers}</span> tieruri
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''} text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]`} />
        </span>
      </button>

      {/* Current status — the minimalist glance: mastery + the badges you hold */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-label="Vezi toate realizările"
        className="w-full rounded-lg border px-2.5 py-2 flex items-center gap-2.5 text-left transition-colors hover:border-[#a3e635]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        style={{ borderColor: '#a3e63555', background: '#a3e6350d' }}
      >
        <div className="shrink-0">
          <div className="num font-bold text-lg leading-none" style={{ color: '#a3e635' }}>+{Math.round(mastery * 100)}%</div>
          <div className="text-[8px] uppercase tracking-wider font-bold text-[var(--color-fg-muted)] mt-0.5">Măiestrie</div>
        </div>
        <div className="w-px self-stretch bg-[var(--color-border)]" aria-hidden />
        {earned.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {earned.map(p => (
              <span
                key={p.achievement.id}
                title={`${p.achievement.name} · ${p.currentTier?.label ?? ''} ×${p.count}`}
                className="text-sm leading-none"
                aria-hidden
              >
                {p.achievement.icon}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-[var(--color-fg-dim)] italic">încă niciun tier — loghează câteva nopți</span>
        )}
        <span className="text-[9px] text-[var(--color-fg-dim)] ml-auto shrink-0 hidden sm:block">
          {expanded ? 'ascunde' : 'detalii'}
        </span>
      </button>

      {/* Expanded: just the level per achievement. One tap on a row → full detail. */}
      {expanded && (
        <div className="flex flex-col gap-1 mt-2 rail-in">
          {progress.map(p => (
            <AchievementRow key={p.achievement.id} p={p} name={name} onOpen={() => setOpen(p)} />
          ))}
        </div>
      )}

      <AchievementDetailModal progress={open} name={name} onClose={() => setOpen(null)} />
    </section>
  );
}

/**
 * One row = one achievement, showing only the level you're at (Bronz/Argint/
 * Aur/Platină) or MAX. Everything else — thresholds, XP %, progress — lives in
 * the detail modal, one tap away.
 */
function AchievementRow({ p, name, onOpen }: { p: AchievementProgress; name: string; onOpen: () => void }) {
  const a = p.achievement;
  const tier = p.currentTier;
  const tint = tier?.color ?? '#3f3f46';
  const locked = p.tiersReached === 0;
  const maxed = p.nextTier == null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${a.name} — ${tier ? `nivel ${tier.label}` : 'neînceput'}. ${achievementHint(a, name)}. Apasă pentru detalii.`}
      className="w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      style={{
        borderColor: locked ? 'var(--color-border)' : tint + '55',
        background: locked ? 'var(--color-surface)' : `color-mix(in srgb, ${tint} 8%, var(--color-surface))`,
        opacity: locked ? 0.6 : 1,
      }}
    >
      <span className="text-base leading-none shrink-0" aria-hidden style={{ filter: locked ? 'grayscale(1)' : 'none' }}>{a.icon}</span>
      <span className="text-[11px] font-bold text-[var(--color-fg)] leading-tight truncate flex-1 min-w-0">{a.name}</span>

      {/* The one thing that matters here: what level you're at. */}
      {tier ? (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1"
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
