'use client';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import {
  type AchievementProgress, levelProgress, tierFor, nextTierFor,
  TIERS, TIER_STEP, BASE_XP_PER_LOG, xpBreakdown, MAX_LEVEL, XP_FOR_MAX_LEVEL,
} from '@/lib/gamify';
import { Modal } from '@/components/ui/modal';

/**
 * Drill-downs that open ON TOP of the player modal (the one behind blurs out).
 *
 *  - AchievementDetailModal — tap a badge: what it means, all four thresholds,
 *    where you are, how far to the next one.
 *  - TierLadderModal — tap the level chip: the four-rung ladder, your spot on
 *    it, and the XP still owed to the next rung.
 */

export function AchievementDetailModal({ progress, onClose }: {
  progress: AchievementProgress | null;
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
              {a.hint}
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
                    {reached && (
                      <span className="num text-[11px] font-bold ml-auto shrink-0" style={{ color: t.color }}>✓</span>
                    )}
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

          <p className="text-[10px] text-[var(--color-fg-dim)] leading-snug border-t border-[var(--color-border)] pt-2.5">
            Badge-urile <strong>nu dau XP</strong>. XP-ul vine din cele trei reguli, iar badge-ul arată cât de departe ai dus
            fiecare regulă. Așa suma din clasament rămâne una pe care o poți verifica singur.
          </p>
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
  const cur = tierFor(bd.total);
  const next = nextTierFor(bd.total);
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
                {next && <> · <span className="num font-bold text-[var(--color-fg)]">{Math.max(0, next.minXP - bd.total)}</span> XP până la <strong style={{ color: next.color }}>{next.name}</strong></>}
              </>
            )}
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cur.color }} />
          </div>
        </div>

        <p className="text-xs italic text-[var(--color-fg-muted)] leading-relaxed">„{cur.blurb}"</p>

        {/* Where the XP came from — the three rules, added up in front of you.
            This is the answer to "de unde vine XP-ul", one tap from the level chip. */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
          <div className="label mb-2">De unde vine XP-ul tău</div>
          <div className="flex flex-col gap-1 text-[11px]">
            <XpRow n="1" what={`${bd.logs} nopți logate × ${BASE_XP_PER_LOG}`} xp={bd.base} />
            <XpRow n="2" what="calitatea nopților" xp={bd.qualityXP} />
            {/* The bands, indented under rule 2 — only the ones you've actually hit,
                so nobody reads a wall of zeroes to find their own numbers. */}
            {bd.bands.filter(b => b.count > 0).map(b => (
              <div key={b.min} className="flex items-center gap-2 pl-[22px] text-[10px] text-[var(--color-fg-dim)]">
                <span className="truncate">{b.count} × SS {b.min}+ · {b.xp} XP</span>
                <span className="num ml-auto shrink-0">+{b.total}</span>
              </div>
            ))}
            <XpRow n="3" what={`serie record ${bd.streakMax} zile`} xp={bd.streakBonus} />
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 mt-0.5">
              <span className="font-bold text-[var(--color-fg)]">Total</span>
              <span className="num font-bold" style={{ color: 'var(--color-accent)' }}>{bd.total} XP</span>
            </div>
          </div>
        </section>

        {/* The full ladder */}
        <section>
          <div className="label mb-2">Paliere</div>
          <div className="flex flex-col gap-1">
            {TIERS.map(t => {
              const reached = bd.total >= t.minXP;
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
                  <div className="num text-[10px] font-bold shrink-0 text-[var(--color-fg-muted)]">{t.minXP} XP</div>
                  {isCurrent && <span className="text-[9px] font-bold uppercase tracking-wider shrink-0" style={{ color: t.color }}>aici</span>}
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-[10px] text-[var(--color-fg-dim)] leading-snug">
          Palierele vin din <strong className="text-[var(--color-fg-muted)]">{TIER_STEP} în {TIER_STEP} XP</strong>, deci fiecare treaptă costă
          exact cât cea dinainte. <strong className="text-[var(--color-fg-muted)]">Nivelele</strong> sunt altceva: ele costă tot mai mult pe măsură ce
          urci{!maxed && <> (Lv {level} → {level + 1} costă {need} XP)</>}, iar Lv {MAX_LEVEL} e maximul, la {XP_FOR_MAX_LEVEL} XP.
        </p>
      </div>
    </Modal>
  );
}

/** One rule of the XP economy, with what it paid you. */
function XpRow({ n, what, xp }: { n: string; what: string; xp: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="num text-[9px] font-bold w-3.5 h-3.5 rounded grid place-items-center shrink-0 bg-[var(--color-border)] text-[var(--color-fg-muted)]">{n}</span>
      <span className="text-[var(--color-fg-muted)] truncate">{what}</span>
      <span className="num font-bold ml-auto shrink-0 text-[var(--color-fg)]">+{xp}</span>
    </div>
  );
}
