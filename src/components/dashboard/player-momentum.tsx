'use client';
import { useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import {
  momentumFor, momentumColor, momentumVerdict,
  MOMENTUM_WINDOW, MOMENTUM_CEILING, BASELINE_XP_PER_DAY, type Momentum,
} from '@/lib/momentum';
import { Modal } from '@/components/ui/modal';

/**
 * Momentum — the RATE of progress, not the pile of it.
 *
 * The card stays deliberately small (it has to share the player modal with
 * everything else); tapping it opens the full explainer on top. Every number
 * shown here is defended in that modal — a metric nobody understands is a
 * metric nobody trusts.
 */
export function PlayerMomentum({ entries, name }: { entries: SleepEntry[]; name: string }) {
  const [open, setOpen] = useState(false);
  const m = momentumFor(entries, name);
  const c = momentumColor(m.multiplier);
  const trend = m.prevMultiplier != null ? m.multiplier - m.prevMultiplier : null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="label">Momentum <span className="text-[var(--color-fg-dim)] normal-case tracking-normal font-normal">· apasă pentru explicație</span></div>
        <div className="text-[9px] num text-[var(--color-fg-dim)]">ultimele {MOMENTUM_WINDOW} zile</div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Momentum ${m.multiplier.toFixed(2)}× — vezi explicația`}
        className="w-full text-left rounded-xl border px-3 py-2 flex flex-col gap-1.5 transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        style={{ borderColor: c + '55', background: `color-mix(in srgb, ${c} 7%, var(--color-surface))` }}
      >
        <div className="flex items-baseline gap-2">
          <span className="num font-bold text-2xl leading-none tracking-tight" style={{ color: c }}>
            {m.multiplier.toFixed(2)}×
          </span>
          {trend != null && Math.abs(trend) >= 0.05 && (
            <span
              className="num text-[10px] font-bold"
              style={{ color: trend > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}
            >
              {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(2)}
            </span>
          )}
          <span className="num text-[10px] text-[var(--color-fg-muted)] ml-auto">
            {m.perDay.toFixed(1)} XP/zi
            {m.daysToLevel != null && <> · Lv {m.level + 1} în {m.daysToLevel}z</>}
          </span>
          <span aria-hidden className="text-[var(--color-fg-dim)] text-xs">›</span>
        </div>

        {m.hasData && (
          <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--color-border)]">
            {m.parts.map(p => (
              <div key={p.key} style={{ width: `${(p.xp / m.recurXP) * 100}%`, background: p.color }} />
            ))}
          </div>
        )}
      </button>

      <MomentumModal open={open} onClose={() => setOpen(false)} m={m} />
    </section>
  );
}

/** The full explainer. Long on purpose — this is the number people will argue about. */
function MomentumModal({ open, onClose, m }: { open: boolean; onClose: () => void; m: Momentum }) {
  const c = momentumColor(m.multiplier);
  const trend = m.prevMultiplier != null ? m.multiplier - m.prevMultiplier : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="md:max-w-sm"
      title={<div className="flex items-center gap-2"><span aria-hidden>🚀</span><span className="font-bold text-sm">Momentum</span></div>}
    >
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Where you are */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="num font-bold text-4xl leading-none tracking-tight" style={{ color: c }}>
              {m.multiplier.toFixed(2)}×
            </span>
            {trend != null && Math.abs(trend) >= 0.05 && (
              <span className="num text-xs font-bold" style={{ color: trend > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(2)} vs luna trecută
              </span>
            )}
          </div>
          <div className="text-[11px] text-[var(--color-fg-muted)] mt-1">
            <span className="num font-bold text-[var(--color-fg)]">{m.perDay.toFixed(1)}</span> XP pe zi ·{' '}
            <span className="num font-bold text-[var(--color-fg)]">{m.nights}</span> nopți logate din {MOMENTUM_WINDOW}
          </div>
          <div className="text-[11px] mt-1.5 leading-snug" style={{ color: c }}>{momentumVerdict(m)}</div>
        </div>

        {/* What it means */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
          <div className="label mb-1">Ce înseamnă</div>
          <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
            Clasamentul arată cine a <strong className="text-[var(--color-fg)]">adunat</strong> mai mult.
            Momentumul arată cine <strong className="text-[var(--color-fg)]">merge mai repede acum</strong> — poți fi pe locul 1 din inerție,
            în timp ce altcineva te depășește în viteză.
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed mt-1.5">
            <strong className="num text-[var(--color-fg)]">1.00×</strong> = ai logat noaptea și atât ({BASELINE_XP_PER_DAY} XP/zi).
            Tot ce e peste vine din calitatea somnului, culcarea devreme, God Mode și Ascensiune.
          </p>
          <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed mt-1.5">
            Se împarte la <strong className="text-[var(--color-fg)]">zile calendaristice</strong>, nu la nopți logate — deci nopțile sărite îl trag în jos.
            Un singur număr prinde și <em>consistența</em>, și <em>calitatea</em>: dacă loghezi o zi din două, chiar cu nopți bune, ajungi tot la 1.0×.
          </p>
        </section>

        {/* Breakdown */}
        {m.hasData && (
          <section>
            <div className="label mb-2">De unde vine viteza ta</div>
            <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-border)] mb-2">
              {m.parts.map(p => (
                <div key={p.key} style={{ width: `${(p.xp / m.recurXP) * 100}%`, background: p.color }} />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {m.parts.map(p => (
                <div key={p.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-[var(--color-fg-muted)]">{p.label}</span>
                  <span className="num font-bold ml-auto" style={{ color: p.color }}>{p.xp} XP</span>
                  <span className="num text-[var(--color-fg-dim)] w-9 text-right">{Math.round((p.xp / m.recurXP) * 100)}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* The scale */}
        <section>
          <div className="label mb-2">Scala</div>
          <div className="flex flex-col gap-1 text-[10px]">
            <ScaleRow what="loghezi zilnic, scoruri sub 80" v="1.0×" />
            <ScaleRow what="zilnic, nopți de 80–84" v="2.0×" />
            <ScaleRow what="zilnic, 85–89 + culcare devreme" v="4.0×" />
            <ScaleRow what="zilnic, 90–94 + culcare devreme" v="7.5×" />
            <ScaleRow what="zilnic, 95+ (God Mode permanent)" v={`${MOMENTUM_CEILING.toFixed(1)}×`} hot />
            <ScaleRow what="o zi din două, chiar cu nopți bune" v="1.0×" />
          </div>
          <p className="text-[10px] text-[var(--color-fg-dim)] mt-2 leading-snug">
            💯 <strong>Ascensiunea</strong> (o noapte de 100) e în afara scalei: îți dă un <strong>nivel întreg</strong>, nu un multiplicator.
          </p>
        </section>

        {/* Projections */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
          <div className="label mb-1.5">La ritmul ăsta</div>
          <div className="flex flex-col gap-1 text-[11px]">
            {m.daysToLevel != null && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-fg-muted)]">Lv {m.level + 1}</span>
                <span className="num font-bold text-[var(--color-fg)]">{m.xpToLevel} XP · {m.daysToLevel} zile</span>
              </div>
            )}
            {m.nextTier && m.daysToTier != null && m.xpToTier != null && (
              <div className="flex items-center justify-between">
                <span style={{ color: m.nextTier.color }} className="font-bold">{m.nextTier.name}</span>
                <span className="num font-bold text-[var(--color-fg)]">{m.xpToTier} XP · {fmtDays(m.daysToTier)}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-fg-dim)] mt-2 leading-snug">
            Atenție: nivelele costă tot mai mult pe măsură ce urci, deci <strong>același XP/zi îți dă tot mai puține nivele</strong>.
            De-aia îți arătăm zilele, nu doar multiplicatorul — altfel ai crede că urci mereu la fel de repede.
          </p>
        </section>

        {/* Mastery — badges ARE part of the rate now */}
        <section className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#a3e63540', background: '#a3e6350a' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="label">Măiestrie · din badge-uri</div>
            <span className="num font-bold text-sm" style={{ color: '#a3e635' }}>+{Math.round(m.mastery * 100)}%</span>
          </div>
          <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
            Badge-urile nu-ți mai dau XP o singură dată — îți dau un <strong className="text-[var(--color-fg)]">procent permanent</strong> la
            fiecare noapte pe care o loghezi. Sunt <strong className="text-[var(--color-fg)]">parte din ritmul tău</strong>, nu o rezervă care se
            termină. Cine e cu adevărat bun câștigă mai mult din <em>fiecare</em> noapte — de-aia le vezi în bara de mai sus.
          </p>
          <div className="flex items-center justify-between mt-2 text-[11px]">
            <span className="text-[var(--color-fg-muted)]">tieruri rămase de urcat</span>
            <span className="num font-bold text-[var(--color-fg)]">{m.tiersLeft} din {m.tiersTotal}</span>
          </div>
          {m.oneOffXP > 0 && (
            <p className="text-[10px] text-[var(--color-fg-dim)] mt-1.5 leading-snug">
              Singurul bonus unic rămas sunt milestone-urile de streak: <strong className="num text-[var(--color-fg-muted)]">+{m.oneOffXP} XP</strong> prinse
              în fereastra asta. Alea nu se repetă, deci nu intră în ritm.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

function ScaleRow({ what, v, hot = false }: { what: string; v: string; hot?: boolean }) {
  return (
    <div
      className="rounded-lg border px-2 py-1.5 flex items-center justify-between gap-2"
      style={{
        borderColor: hot ? '#fbbf2455' : 'var(--color-border)',
        background: hot ? '#fbbf240d' : 'transparent',
      }}
    >
      <span className="text-[var(--color-fg-muted)] truncate">{what}</span>
      <span className="num font-bold shrink-0" style={{ color: hot ? '#fbbf24' : 'var(--color-fg)' }}>{v}</span>
    </div>
  );
}

/** 8z / ~3 luni / ~2 ani — a raw "412z" tells nobody anything. */
function fmtDays(d: number): string {
  if (d < 45) return `${d}z`;
  if (d < 365) return `~${Math.round(d / 30)} luni`;
  const y = d / 365;
  return y < 2 ? '~1 an' : `~${y.toFixed(0)} ani`;
}
