'use client';
import { type SleepEntry } from '@/lib/sleep';
import {
  momentumFor, momentumColor, momentumVerdict, MOMENTUM_WINDOW, MOMENTUM_CEILING,
} from '@/lib/momentum';

/**
 * Momentum card — the rate of progress, not the pile of it.
 *
 * Headline is a multiplier against "you logged the night and nothing else"
 * (1.00×). The segmented bar shows where the speed comes from, so it's obvious
 * what to change. The one-off line at the bottom keeps the number honest: badge
 * tiers are a finite reserve, not an engine.
 */
export function PlayerMomentum({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const m = momentumFor(entries, name);
  const c = momentumColor(m.multiplier);
  const trend = m.prevMultiplier != null ? m.multiplier - m.prevMultiplier : null;

  if (!m.hasData) {
    return (
      <section>
        <div className="label mb-1.5">Momentum</div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[11px] text-[var(--color-fg-muted)] italic">
          {momentumVerdict(m)}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="label">Momentum</div>
        <div className="text-[9px] num text-[var(--color-fg-dim)]">ultimele {MOMENTUM_WINDOW} zile</div>
      </div>

      <div
        className="rounded-xl border px-3 py-2.5 flex flex-col gap-2"
        style={{ borderColor: c + '55', background: `color-mix(in srgb, ${c} 7%, var(--color-surface))` }}
      >
        {/* Headline */}
        <div className="flex items-baseline gap-2">
          <span className="num font-bold text-3xl leading-none tracking-tight" style={{ color: c }}>
            {m.multiplier.toFixed(2)}×
          </span>
          {trend != null && Math.abs(trend) >= 0.05 && (
            <span
              className="num text-[11px] font-bold"
              style={{ color: trend > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}
              title="față de cele 30 de zile dinainte"
            >
              {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(2)}
            </span>
          )}
          <span className="num text-[11px] text-[var(--color-fg-muted)] ml-auto">
            {m.perDay.toFixed(1)} XP/zi · {m.nights} nopți
          </span>
        </div>

        {/* Where the speed comes from */}
        <div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-border)]">
            {m.parts.map(p => (
              <div
                key={p.key}
                style={{ width: `${(p.xp / m.recurXP) * 100}%`, background: p.color }}
                title={`${p.label}: ${p.xp} XP`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
            {m.parts.map(p => (
              <span key={p.key} className="inline-flex items-center gap-1 text-[9px] text-[var(--color-fg-muted)]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                {p.label} <span className="num font-bold text-[var(--color-fg)]">{p.xp}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-[var(--color-fg-muted)] leading-snug">{momentumVerdict(m)}</div>

        {/* Projection — levels cost more as you climb, so a flat XP rate is NOT
            a flat rate of levelling. Spell the day-counts out. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-[var(--color-border)] text-[10px]">
          {m.daysToLevel != null && (
            <span className="text-[var(--color-fg-muted)]">
              → Lv {m.level + 1} în <strong className="num text-[var(--color-fg)]">{m.daysToLevel}z</strong>
            </span>
          )}
          {m.nextTier && m.daysToTier != null && (
            <span className="text-[var(--color-fg-muted)]">
              → <strong style={{ color: m.nextTier.color }}>{m.nextTier.name}</strong> în{' '}
              <strong className="num text-[var(--color-fg)]">{fmtDays(m.daysToTier)}</strong>
            </span>
          )}
        </div>

        {/* The honesty line: one-off lumps are a finite reserve, not a rate. */}
        <div className="text-[9px] text-[var(--color-fg-dim)] leading-snug">
          Momentumul numără doar XP-ul care se repetă în fiecare noapte.
          {m.oneOffXP > 0 && (
            <> Praguri de badge prinse în fereastră: <strong className="num text-[var(--color-fg-muted)]">+{m.oneOffXP} XP</strong> — bonus unic, nu ritm.</>
          )}
          {' '}Îți mai rămân <strong className="num text-[var(--color-fg-muted)]">{m.tiersLeft}</strong> din {m.tiersTotal} tieruri.
          {' '}Plafon teoretic: <strong className="num text-[var(--color-fg-muted)]">{MOMENTUM_CEILING.toFixed(1)}×</strong> (95+ în fiecare noapte).
        </div>
      </div>
    </section>
  );
}

/** 8z / 3 luni / 2 ani — a raw "412z" tells nobody anything. */
function fmtDays(d: number): string {
  if (d < 45) return `${d}z`;
  if (d < 365) return `~${Math.round(d / 30)} luni`;
  const y = d / 365;
  return y < 2 ? '~1 an' : `~${y.toFixed(0)} ani`;
}
