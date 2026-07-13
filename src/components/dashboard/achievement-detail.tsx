'use client';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import {
  type AchievementProgress, achievementHint, levelProgress, tierFor, nextTierFor,
  xpForLevel, TIERS, xpBreakdown, MAX_LEVEL, XP_FOR_MAX_LEVEL,
} from '@/lib/gamify';
import { Modal } from '@/components/ui/modal';

/**
 * Drill-downs that open ON TOP of the player modal (the one behind blurs out).
 *
 *  - AchievementDetailModal — tap a badge: what it means, all four tiers with
 *    their thresholds and XP, where you are, what the next tier costs.
 *  - TierLadderModal — tap the level chip: the full 10-tier ladder, your spot
 *    on it, and the XP still owed to the next rung.
 */

export function AchievementDetailModal({ progress, name, onClose }: {
  progress: AchievementProgress | null;
  name: string;
  onClose: () => void;
}) {
  const a = progress?.achievement;
  return (
    <Modal
      open={!!progress}
      onClose={onClose}
      widthClass="md:max-w-sm"
      title={a ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl leading-none" aria-hidden>{a.icon}</span>
          <span className="font-bold text-sm truncate">{a.name}</span>
        </div>
      ) : undefined}
    >
      {progress && a && (
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Headline count */}
          <div className="flex items-end gap-2">
            <span className="num font-bold text-4xl leading-none" style={{ color: progress.currentTier?.color ?? 'var(--color-fg-dim)' }}>
              {progress.count}
            </span>
            <span className="text-xs text-[var(--color-fg-muted)] pb-0.5">
              {achievementHint(a, name)}
            </span>
          </div>

          <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">{a.description}</p>

          {/* Tier ladder — full detail */}
          <section>
            <div className="label mb-2">Praguri</div>
            <div className="flex flex-col gap-1.5">
              {a.tiers.map((t, i) => {
                const reached = i < progress.tiersReached;
                const isNext = progress.nextTier?.label === t.label;
                return (
                  <div
                    key={t.label}
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2"
                    style={{
                      borderColor: reached ? t.color + '66' : isNext ? 'var(--color-accent)' + '55' : 'var(--color-border)',
                      background: reached ? `color-mix(in srgb, ${t.color} 10%, transparent)` : 'transparent',
                      opacity: reached || isNext ? 1 : 0.5,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: reached ? t.color : 'var(--color-border)' }}
                    />
                    <span className="text-xs font-bold shrink-0" style={{ color: reached ? t.color : 'var(--color-fg-muted)' }}>
                      {t.label}
                    </span>
                    <span className="num text-[11px] text-[var(--color-fg-muted)]">{t.threshold}+</span>
                    <span className="num text-[11px] font-bold ml-auto shrink-0" style={{ color: reached ? '#a3e635' : 'var(--color-fg-dim)' }}>
                      +{Math.round(t.pct * 100)}% XP{reached ? ' ✓' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Progress to next */}
          {progress.nextTier ? (
            <section>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] text-[var(--color-fg-muted)]">
                  Încă <strong className="num text-[var(--color-fg)]">{progress.nextTier.threshold - progress.count}</strong> până la{' '}
                  <strong style={{ color: progress.nextTier.color }}>{progress.nextTier.label}</strong>
                </span>
                <span className="num text-[11px] font-bold" style={{ color: progress.nextTier.color }}>
                  {progress.pct > 0 ? `+${Math.round(progress.nextTier.pct * 100)}%` : `+${Math.round(progress.nextTier.pct * 100)}% XP`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(1, (progress.count - (progress.currentTier?.threshold ?? 0)) / ((progress.nextTier.threshold - (progress.currentTier?.threshold ?? 0)) || 1))) * 100}%`,
                    background: progress.nextTier.color,
                  }}
                />
              </div>
            </section>
          ) : (
            <div className="rounded-lg border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-2 text-center">
              <span className="num text-xs font-bold" style={{ color: '#22d3ee' }}>MAX · toate cele 4 tieruri</span>
            </div>
          )}

          <div className="rounded-lg border border-[#a3e635]/30 bg-[#a3e635]/5 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-fg-muted)]">Ce îți dă badge-ul ăsta ACUM</span>
              <span className="num font-bold" style={{ color: '#a3e635' }}>+{Math.round(progress.pct * 100)}% XP</span>
            </div>
            <p className="text-[10px] text-[var(--color-fg-dim)] mt-1 leading-snug">
              Nu e un bonus unic — e un <strong>procent permanent</strong> adăugat la XP-ul fiecărei nopți pe care o loghezi, pentru totdeauna.
              Contează doar tier-ul cel mai înalt (Aur nu se adună peste Bronz). Toate badge-urile la un loc formează <strong>Măiestria</strong> ta.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TierLadderModal({ open, onClose, entries, name }: {
  open: boolean;
  onClose: () => void;
  entries: SleepEntry[];
  name: string;
}) {
  const bd = xpBreakdown(entries, name);
  const { level, into, need, pct, maxed } = levelProgress(bd.total);
  const cur = tierFor(level);
  const next = nextTierFor(level);
  const c = personColor(name);
  const fn = FIRST_NAME[name] ?? name.split(' ')[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="md:max-w-sm"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm truncate" style={{ color: c }}>{fn}</span>
          <span className="text-[9px] num font-bold px-1 py-0.5 rounded shrink-0" style={{ color: cur.color, background: cur.color + '18' }}>
            {cur.icon} Lv{level}
          </span>
        </div>
      }
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Current standing */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="num font-bold text-3xl leading-none" style={{ color: 'var(--color-accent)' }}>{bd.total}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">XP total</span>
          </div>
          <div className="text-[11px] text-[var(--color-fg-muted)] mt-1">
            {maxed ? (
              <span className="font-bold" style={{ color: cur.color }}>NIVEL MAXIM — Lv {MAX_LEVEL}. Capătul drumului.</span>
            ) : (
              <>
                <span className="num font-bold text-[var(--color-fg)]">{into}</span>/<span className="num">{need}</span> până la Lv {level + 1}
                {next && <> · <span className="num font-bold text-[var(--color-fg)]">{Math.max(0, xpForLevel(next.minLevel) - bd.total)}</span> XP până la <strong style={{ color: next.color }}>{next.name}</strong></>}
              </>
            )}
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cur.color }} />
          </div>
        </div>

        <p className="text-xs italic text-[var(--color-fg-muted)] leading-relaxed">„{cur.blurb}"</p>

        {/* The full ladder */}
        <section>
          <div className="label mb-2">Paliere</div>
          <div className="flex flex-col gap-1">
            {TIERS.map(t => {
              const reached = level >= t.minLevel;
              const isCurrent = t.name === cur.name;
              return (
                <div
                  key={t.name}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-1.5"
                  style={{
                    borderColor: isCurrent ? t.color : reached ? t.color + '40' : 'var(--color-border)',
                    background: isCurrent ? `color-mix(in srgb, ${t.color} 14%, transparent)` : 'transparent',
                    opacity: reached ? 1 : 0.45,
                  }}
                >
                  <span className="text-sm shrink-0 w-4 text-center" style={{ color: t.color }}>{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold truncate" style={{ color: t.color }}>{t.name}</div>
                    <div className="text-[9px] text-[var(--color-fg-dim)] truncate leading-tight">{t.blurb}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="num text-[10px] font-bold text-[var(--color-fg-muted)]">Lv {t.minLevel}</div>
                    <div className="num text-[9px] text-[var(--color-fg-dim)] leading-none">{xpForLevel(t.minLevel)} XP</div>
                  </div>
                  {isCurrent && <span className="text-[9px] font-bold uppercase tracking-wider shrink-0" style={{ color: t.color }}>aici</span>}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-[10px] text-[var(--color-fg-dim)] leading-snug">
          Fiecare nivel costă mai mult decât cel dinainte{!maxed && <> (Lv {level} → {level + 1} costă {need} XP)</>}.
          {' '}<strong className="text-[var(--color-fg-muted)]">Lv {MAX_LEVEL} e maximul</strong> — {XP_FOR_MAX_LEVEL} XP, adică vreo doi ani de somn bun. Nu e o cursă de sprint.
        </p>
      </div>
    </Modal>
  );
}
