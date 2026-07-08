'use client';
import { type SleepEntry } from '@/lib/sleep';
import { tierFor, xpBreakdown, XP_PER_LEVEL, TIERS } from '@/lib/gamify';
import type { PlayerSummary } from '@/components/dashboard/player-drawer';

/**
 * XP + level breakdown for the player drawer.
 * Shows: current tier chip → progress bar → per-line XP breakdown → 10-tier
 * ladder → "Cum câștigi XP" tips → best-at crowns.
 */
export function PlayerXPExplained({ player, entries, prog, maxStreak }: {
  player: PlayerSummary;
  entries: SleepEntry[];
  prog: number;
  maxStreak: number;
}) {
  const bd = xpBreakdown(entries, player.name);
  const tier = tierFor(player.level);
  const nextTier = TIERS.find(t => t.minLevel > player.level);
  const xpToNext = XP_PER_LEVEL - prog;

  return (
    <section>
      <div className="label mb-2">XP & Level</div>

      {/* Level + progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] num font-bold px-1.5 py-0.5 rounded" style={{ color: tier.color, background: tier.color + '18' }}>
              {tier.icon} {tier.name}
            </span>
            <span className="text-[10px] num text-[var(--color-fg-muted)]">Lv {player.level}</span>
          </div>
          <span className="text-[10px] num text-[var(--color-fg-muted)]">{prog}/{XP_PER_LEVEL} XP</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${prog}%`, background: 'var(--color-accent)' }} />
        </div>
        <div className="text-[10px] text-[var(--color-fg-dim)] mt-1">
          {xpToNext} XP până la Lv {player.level + 1}
          {nextTier && <> · {nextTier.icon} {nextTier.name} la Lv {nextTier.minLevel}</>}
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2.5 mb-3">
        <div className="text-[10px] font-bold text-[var(--color-fg-muted)] uppercase tracking-wider mb-2">Cum se calculează</div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[var(--color-fg-muted)]">{bd.logs} loguri × 10</span>
            <span className="num font-bold text-[var(--color-fg)]">+{bd.base}</span>
          </div>
          {bd.count90 > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">{bd.count90} nopți cu SS ≥ 90 × 10</span>
              <span className="num font-bold text-[var(--color-good)]">+{bd.bonus90}</span>
            </div>
          )}
          {bd.count80 > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">{bd.count80} nopți cu SS ≥ 80 × 5</span>
              <span className="num font-bold text-[var(--color-accent)]">+{bd.bonus80}</span>
            </div>
          )}
          {bd.earlyBirdCount > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">🌙 {bd.earlyBirdCount} nopți culcare &lt;23:00 × 5</span>
              <span className="num font-bold text-[var(--color-good)]">+{bd.earlyBirdBonus}</span>
            </div>
          )}
          {bd.streakBonus > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">🔥 streak record {bd.streakMax}z</span>
              <span className="num font-bold" style={{ color: '#f59e0b' }}>+{bd.streakBonus}</span>
            </div>
          )}
          {bd.achievementsBonus > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-fg-muted)]">🏅 {bd.achievementsCount} tieruri de badge</span>
              <span className="num font-bold" style={{ color: '#a3e635' }}>+{bd.achievementsBonus}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-[var(--color-border)]">
            <span className="font-bold text-[var(--color-fg)]">Total XP</span>
            <span className="num font-bold text-[var(--color-fg)]">{bd.total}</span>
          </div>
        </div>
      </div>

      {/* Tier ladder — 10 nivele, cel curent evidențiat */}
      <div className="mb-3">
        <div className="text-[10px] font-bold text-[var(--color-fg-muted)] uppercase tracking-wider mb-1.5">Paliere</div>
        <div className="grid grid-cols-2 gap-1.5">
          {TIERS.map(t => {
            const reached = player.level >= t.minLevel;
            const current = t.name === tier.name;
            return (
              <div
                key={t.name}
                className="rounded-lg px-2 py-1.5 border flex items-center gap-1.5"
                style={{
                  borderColor: current ? t.color : (reached ? t.color + '40' : 'var(--color-border)'),
                  background: current ? t.color + '20' : (reached ? t.color + '10' : 'transparent'),
                  opacity: reached ? 1 : 0.45,
                  boxShadow: current ? `0 0 0 1px ${t.color}66 inset` : 'none',
                }}
              >
                <span className="text-sm shrink-0" style={{ color: t.color }}>{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold truncate" style={{ color: t.color }}>{t.name}</div>
                  <div className="text-[9px] num text-[var(--color-fg-dim)] leading-none">Lv {t.minLevel}+</div>
                </div>
                {current && <span className="text-[8px] uppercase tracking-wider font-bold text-[var(--color-accent)] shrink-0">tu</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-3 py-2.5 mb-3">
        <div className="text-[10px] font-bold text-[var(--color-accent)] mb-1.5">Cum câștigi XP</div>
        <ul className="text-[11px] text-[var(--color-fg-muted)] space-y-1">
          <li>• Loghează o noapte → <span className="num font-bold text-[var(--color-fg)]">+10 XP</span></li>
          <li>• Sleep Score ≥ 80 → bonus <span className="num font-bold text-[var(--color-accent)]">+5 XP</span></li>
          <li>• Sleep Score ≥ 90 → bonus <span className="num font-bold text-[var(--color-good)]">+10 XP</span></li>
          <li>• 🌙 Culcare înainte de 23:00 → bonus <span className="num font-bold text-[var(--color-good)]">+5 XP</span></li>
          <li>• 🔥 Streak 7z → <span className="num font-bold" style={{ color: '#f59e0b' }}>+50</span> · 14z → <span className="num font-bold" style={{ color: '#f59e0b' }}>+100</span> · 30z → <span className="num font-bold" style={{ color: '#f59e0b' }}>+200</span></li>
          <li>• 🏅 Fiecare tier de badge → <span className="num font-bold" style={{ color: '#a3e635' }}>+25 · +50 · +100 · +200</span></li>
        </ul>
        <div className="text-[9px] text-[var(--color-fg-dim)] mt-2 leading-snug">
          XP reflectă logurile distincte curente. Dacă nopți duplicate au fost curățate, XP-ul se recalculează automat.
        </div>
      </div>

      {/* Best-at crowns (this-period leader flair) */}
      {(player.badges.length > 0 || maxStreak >= 2) && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-[var(--color-fg-muted)] uppercase tracking-wider mb-1.5">Distincții</div>
          <div className="flex flex-wrap gap-1.5">
            {player.badges.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span aria-hidden>{b.emoji}</span> {b.label}
              </span>
            ))}
            {maxStreak >= 2 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                <span aria-hidden>🏅</span> record {maxStreak}z streak
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
