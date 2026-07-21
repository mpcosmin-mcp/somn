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

      {/* Full detail grid — only when expanded */}
      {expanded && (
        <div className="grid grid-cols-5 gap-1 mt-2 rail-in">
          {progress.map(p => (
            <AchievementCard key={p.achievement.id} p={p} name={name} onOpen={() => setOpen(p)} />
          ))}
        </div>
      )}

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
