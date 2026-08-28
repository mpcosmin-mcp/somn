'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { FIRST_NAME } from '@/lib/sleep';
import {
  xpBreakdown, levelProgress, tierFor, ACHIEVEMENTS, TIERS, TIER_STEP, STREAK_MILESTONES,
  BASE_XP_PER_LOG, SS_BANDS,
  xpToNextLevel, MAX_LEVEL, XP_FOR_MAX_LEVEL,
} from '@/lib/gamify';
import { Card } from '@/components/ui/card';

/**
 * /ghid — the whole rulebook, on one screen you can read in a minute.
 *
 * It used to run eight sections deep (Ascension, God Mode, five score bands,
 * Momentum, Mastery percentages, thirteen badges, ten tiers) and still left
 * people unable to say where their XP came from. Now it's three rules, three
 * badges, four rungs — and your own numbers plugged into them at the top.
 */
export default function GhidPage() {
  const { user } = useUser();
  const { entries } = useEntries();

  const bd = user ? xpBreakdown(entries, user) : null;
  const { level, into, need, pct, maxed } = levelProgress(bd?.total ?? 0);
  const tier = tierFor(bd?.total ?? 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
          <ArrowLeft size={16} /> înapoi
        </Link>
        <h1 className="text-sm font-bold text-[var(--color-fg)]">📖 Ghid</h1>
      </div>

      {/* Your status — the three rules, with YOUR numbers in them. */}
      {bd && user && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="label">Tu · {FIRST_NAME[user] ?? user}</div>
            <span className="text-[10px] num font-bold px-1.5 py-0.5 rounded" style={{ color: tier.color, background: tier.color + '18' }}>
              {tier.icon} {tier.name} · Lv {level}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="num font-bold text-2xl" style={{ color: 'var(--color-accent)' }}>{bd.total}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              {maxed ? `XP · NIVEL MAXIM (Lv ${MAX_LEVEL})` : `XP · ${into}/${need} până la Lv ${level + 1}`}
            </span>
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
          </div>

          <div className="mt-3 flex flex-col gap-1 text-[11px]">
            <Line n="1" what={`${bd.logs} nopți logate × ${BASE_XP_PER_LOG}`} xp={bd.base} />
            <Line n="2" what="calitatea nopților" xp={bd.qualityXP} />
            {bd.bands.filter(b => b.count > 0).map(b => (
              <div key={b.min} className="flex items-center gap-2 pl-[22px] text-[10px] text-[var(--color-fg-dim)]">
                <span className="truncate">{b.count} × SS {b.min}+ · {b.xp} XP</span>
                <span className="num ml-auto shrink-0">+{b.total}</span>
              </div>
            ))}
            <Line n="3" what={`serie record ${bd.streakMax} zile`} xp={bd.streakBonus} />
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 mt-0.5">
              <span className="font-bold text-[var(--color-fg)]">Total</span>
              <span className="num font-bold" style={{ color: 'var(--color-accent)' }}>{bd.total} XP</span>
            </div>
          </div>
        </Card>
      )}

      {/* THE rules — all of them */}
      <Card className="p-4">
        <SectionTitle icon="✨" title="Cele 3 reguli. Astea sunt toate." />
        <p className="text-[11px] text-[var(--color-fg-dim)] mb-3 leading-snug">
          Nu există multiplicatori ascunși, ferestre de bonus sau procente din badge-uri. Poți aduna XP-ul de mai jos cu mâna ta
          și îți dă exact cifra din clasament.
        </p>
        <div className="flex flex-col gap-2">
          <RuleCard
            n="1"
            title="Apari"
            body="Orice noapte logată, indiferent de scor."
            xp={`+${BASE_XP_PER_LOG} XP`}
            color="var(--color-accent)"
          />
          <RuleCard
            n="2"
            title="Dormi bine"
            body="Benzile sunt exclusive — o noapte e plătită o singură dată, de cea mai mare bandă pe care o atinge. Un 100 valorează un palier întreg; recordul echipei e 95, deci nimeni nu l-a prins încă."
            xp={[...SS_BANDS].reverse().map(b => `${b.min}+ → +${b.xp}`).join(' · ')}
            color="var(--color-good)"
          />
          <RuleCard
            n="3"
            title="Nu rupe seria"
            body="Se ia în calcul cea mai lungă serie din istoria ta, deci o pauză nu-ți șterge ce ai construit. Fiecare prag se plătește o singură dată."
            xp={STREAK_MILESTONES.map(m => `${m.days}z → +${m.bonus}`).join(' · ')}
            color="#f59e0b"
          />
        </div>
      </Card>

      {/* Badges — one per rule, paying nothing */}
      <Card className="p-4">
        <SectionTitle icon="🏅" title="Cele 3 realizări" />
        <p className="text-[11px] text-[var(--color-fg-muted)] mb-3 leading-snug">
          Câte una pentru fiecare regulă. <strong className="text-[var(--color-fg)]">Nu dau XP</strong> — arată doar cât de departe ai dus
          fiecare regulă. Sunt personale și cumulative: nimeni nu ți le poate lua.
        </p>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id} className="flex items-center gap-2.5">
              <span className="text-lg shrink-0" aria-hidden>{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--color-fg)]">{a.name}</div>
                <div className="text-[10px] text-[var(--color-fg-muted)]">{a.hint}</div>
              </div>
              <div className="num text-[10px] text-[var(--color-fg-dim)] shrink-0 text-right">
                {a.tiers.map(t => t.threshold).join(' · ')}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-fg-dim)] mt-3 leading-snug">
          Patru praguri fiecare: <strong style={{ color: '#b45309' }}>Bronz</strong> · <strong style={{ color: '#94a3b8' }}>Argint</strong> ·{' '}
          <strong style={{ color: '#eab308' }}>Aur</strong> · <strong style={{ color: '#22d3ee' }}>Platină</strong>.
          Pragurile de la 🔥 Serie sunt aceleași cu bonusurile de la regula 3 — badge-ul ȘI plata sunt același lucru.
        </p>
      </Card>

      {/* Paliere — the ladder people actually watch */}
      <Card className="p-4">
        <SectionTitle icon="🪜" title={`Cele ${TIERS.length} paliere — unul la fiecare ${TIER_STEP} XP`} />
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          Fiecare palier costă exact <strong className="text-[var(--color-fg)]">{TIER_STEP} XP</strong>, de la primul la ultimul. Nicio surpriză,
          nicio curbă: știi mereu cât mai ai de mers.
          {bd && (() => {
            const nx = TIERS.find(t => t.minXP > bd.total);
            return nx ? <> Tu mai ai <strong className="text-[var(--color-fg)]">{nx.minXP - bd.total} XP</strong> până la <strong style={{ color: nx.color }}>{nx.name}</strong>.</> : <> Ești pe ultima treaptă.</>;
          })()}
        </p>
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {TIERS.map(t => {
            const reached = !!bd && bd.total >= t.minXP;
            return (
              <div
                key={t.name}
                className="rounded-lg px-2 py-1.5 border flex items-center gap-1.5"
                style={{ borderColor: t.color + '30', background: t.color + '0d', opacity: reached ? 1 : 0.5 }}
              >
                <span className="text-sm shrink-0" style={{ color: t.color }}>{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold truncate" style={{ color: t.color }}>{t.name}</div>
                  <div className="text-[9px] num text-[var(--color-fg-dim)] leading-none">{t.minXP} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Levels — the slower, separate ladder */}
      <Card className="p-4">
        <SectionTitle icon="📈" title={`Nivelele — altă scară, mai lentă`} />
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          Palierele vin din {TIER_STEP} în {TIER_STEP} XP. <strong className="text-[var(--color-fg)]">Nivelele</strong> nu: fiecare costă mai mult decât
          cel dinainte — <strong className="text-[var(--color-fg)]">Lv 1 → 2</strong> cere {xpToNextLevel(1)} XP, <strong className="text-[var(--color-fg)]">Lv 30 → 31</strong> cere {xpToNextLevel(30)} XP.
          Palierul e recompensa vizibilă; nivelul e cursa lungă.
          {bd && !maxed && <> Tu ești la <strong className="text-[var(--color-fg)]">Lv {level}</strong>, iar următorul costă <strong className="text-[var(--color-fg)]">{need} XP</strong>.</>}
        </p>
        <p className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed mt-2">
          <strong className="text-[var(--color-fg)]">✺ Lv {MAX_LEVEL} e maximul</strong> — <strong className="num text-[var(--color-fg)]">{XP_FOR_MAX_LEVEL} XP</strong>.
          Cine ajunge acolo n-are ce demonstra nimănui.
        </p>
      </Card>

      {/* Metric targets */}
      <Card className="p-4">
        <SectionTitle icon="🎯" title="Ținte pe metrici" />
        <div className="flex flex-col gap-2 text-xs">
          <Metric name="Sleep Score" better="mare e mai bine" bands="≥85 excelent · ≥75 bun · ≥60 sub · <60 slab" />
          <Metric name="RHR — bărbați" better="mic e mai bine" bands="<55 excelent · <60 bun · <70 sub · ≥70 slab" />
          <Metric name="RHR — femei" better="mic e mai bine" bands="<60 excelent · <65 bun · <75 sub · ≥75 slab" />
          <Metric name="HRV" better="mare e mai bine" bands="≥60 excelent · ≥45 bun · ≥30 sub · <30 slab" />
          <Metric name="REM (min)" better="mare e mai bine" bands="≥110 excelent · ≥90 bun · ≥70 sub · <70 slab" />
        </div>
        <p className="text-[10px] text-[var(--color-fg-dim)] mt-3 leading-snug">
          RHR e calibrat pe sex — femeile au un puls de repaus mai mare cu ~5 bpm la bază. Doar Sleep Score-ul intră în XP; restul metricilor
          sunt pentru citit, nu pentru punctat.
        </p>
      </Card>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="text-sm font-bold text-[var(--color-fg)] mb-2 flex items-center gap-1.5"><span aria-hidden>{icon}</span> {title}</div>;
}

/** One rule of the economy — number, name, what it pays. */
function RuleCard({ n, title, body, xp, color }: {
  n: string; title: string; body: string; xp: string; color: string;
}) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: color + '40', background: color + '0a' }}>
      <div className="flex items-center gap-2">
        <span className="num text-[10px] font-black w-5 h-5 rounded-full grid place-items-center shrink-0" style={{ color, background: color + '22' }}>{n}</span>
        <span className="text-xs font-bold text-[var(--color-fg)]">{title}</span>
        <span className="num text-[11px] font-bold ml-auto text-right" style={{ color }}>{xp}</span>
      </div>
      <p className="text-[10px] text-[var(--color-fg-muted)] leading-snug mt-1.5">{body}</p>
    </div>
  );
}

/** A line of the live breakdown at the top. */
function Line({ n, what, xp }: { n: string; what: string; xp: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="num text-[9px] font-bold w-3.5 h-3.5 rounded grid place-items-center shrink-0 bg-[var(--color-border)] text-[var(--color-fg-muted)]">{n}</span>
      <span className="text-[var(--color-fg-muted)] truncate">{what}</span>
      <span className="num font-bold ml-auto shrink-0 text-[var(--color-fg)]">+{xp}</span>
    </div>
  );
}

function Metric({ name, better, bands }: { name: string; better: string; bands: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-[var(--color-fg)]">{name}</span>
        <span className="text-[10px] text-[var(--color-fg-dim)] italic">{better}</span>
      </div>
      <div className="num text-[10px] text-[var(--color-fg-muted)] mt-0.5">{bands}</div>
    </div>
  );
}
