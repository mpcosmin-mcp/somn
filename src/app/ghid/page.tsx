'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { FIRST_NAME } from '@/lib/sleep';
import {
  xpBreakdown, xpLevel, xpProgress, XP_PER_LEVEL, tierFor, godMode,
  ACHIEVEMENTS, TIERS, GOD_WINDOW_DAYS,
} from '@/lib/gamify';
import { Card } from '@/components/ui/card';

/**
 * /ghid — the in-app rulebook. Every scoring rule, category and threshold the
 * app uses, in one place users can read. Also hosts the current user's live
 * XP / God Mode status at the top.
 */
export default function GhidPage() {
  const { user } = useUser();
  const { entries } = useEntries();

  const bd = user ? xpBreakdown(entries, user) : null;
  const level = bd ? xpLevel(bd.total) : 1;
  const prog = bd ? xpProgress(bd.total) : 0;
  const tier = tierFor(level);
  const god = user ? godMode(entries, user) : { active: false, daysLeft: 0 };

  return (
    <main className="mx-auto max-w-2xl px-4 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
          <ArrowLeft size={16} /> înapoi
        </Link>
        <h1 className="text-sm font-bold text-[var(--color-fg)]">📖 Ghid & Reguli</h1>
      </div>

      {/* Your status */}
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
            <span className="text-xs text-[var(--color-fg-muted)]">XP · {prog}/{XP_PER_LEVEL} până la Lv {level + 1}</span>
          </div>
          <div className="h-1.5 mt-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${prog}%`, background: 'var(--color-accent)' }} />
          </div>
          {god.active && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 god-aura">
              <Zap size={16} className="shrink-0" style={{ color: '#fbbf24' }} />
              <span className="text-xs font-bold god-text">GOD MODE ACTIV</span>
              <span className="text-[11px] num text-[var(--color-fg-muted)] ml-auto">+20% XP · {god.daysLeft}z rămase</span>
            </div>
          )}
        </Card>
      )}

      {/* God Mode explainer */}
      <Card className="p-4">
        <SectionTitle icon="⚡" title="God Mode" />
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          O noapte cu <strong className="text-[var(--color-fg)]">Sleep Score = 100</strong> (perfectă) îți pornește <span className="god-text font-bold">God Mode</span> pentru
          următoarele <strong className="text-[var(--color-fg)]">{GOD_WINDOW_DAYS} zile</strong>: tot XP-ul câștigat în acea fereastră primește un
          <strong className="text-[var(--color-fg)]"> boost de +20%</strong>. O nouă noapte de 100 reîmprospătează fereastra.
          Noaptea de 100 în sine îți dă deja <strong className="text-[var(--color-fg)]">+500 XP</strong> direct.
        </p>
      </Card>

      {/* XP rules */}
      <Card className="p-4">
        <SectionTitle icon="✨" title="Cum câștigi XP" />
        <ul className="text-xs text-[var(--color-fg-muted)] space-y-1.5">
          <Rule>Loghezi o noapte <Xp v="+10" /></Rule>
          <Rule>Sleep Score = 100 (perfect) <Xp v="+500" c="#fbbf24" /></Rule>
          <Rule>Sleep Score ≥ 95 <Xp v="+200" c="#fbbf24" /></Rule>
          <Rule>Sleep Score ≥ 90 <Xp v="+10" c="var(--color-good)" /></Rule>
          <Rule>Sleep Score ≥ 80 <Xp v="+5" c="var(--color-accent)" /></Rule>
          <Rule>🌙 Culcare înainte de 23:00 <Xp v="+5" c="var(--color-good)" /></Rule>
          <Rule>🔥 Streak 7z / 14z / 30z <Xp v="+50 · +100 · +200" c="#f59e0b" /></Rule>
          <Rule>🏅 Fiecare tier de realizare <Xp v="+25 · +50 · +100 · +200" c="#a3e635" /></Rule>
          <Rule>⚡ God Mode (fereastră de {GOD_WINDOW_DAYS}z) <Xp v="+20% la tot" c="#fbbf24" /></Rule>
        </ul>
      </Card>

      {/* Achievement categories */}
      <Card className="p-4">
        <SectionTitle icon="🏅" title="Realizări (cumulative, personale)" />
        <p className="text-[11px] text-[var(--color-fg-dim)] mb-3 leading-snug">
          Fiecare se numără o dată pentru fiecare noapte care se califică. Praguri: Bronz → Argint → Aur → Platină. Nimeni nu ți le poate „fura" — sunt ale tale.
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
          <Metric name="Durată somn" better="7-9h ideal" bands="<6h slab · 6-7h sub · 7-9h bun · >9h prea mult" />
        </div>
        <p className="text-[10px] text-[var(--color-fg-dim)] mt-3 leading-snug">
          RHR e calibrat pe sex — femeile au un puls de repaus mai mare cu ~5 bpm la bază. Vârsta și fitness-ul contează și ele; o calibrare pe baseline personal va urma.
        </p>
      </Card>

      {/* Tier ladder */}
      <Card className="p-4">
        <SectionTitle icon="🪜" title="Paliere (10 nivele)" />
        <div className="grid grid-cols-2 gap-1.5">
          {TIERS.map(t => (
            <div key={t.name} className="rounded-lg px-2 py-1.5 border flex items-center gap-1.5" style={{ borderColor: t.color + '30', background: t.color + '0d' }}>
              <span className="text-sm shrink-0" style={{ color: t.color }}>{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold truncate" style={{ color: t.color }}>{t.name}</div>
                <div className="text-[9px] num text-[var(--color-fg-dim)] leading-none">Lv {t.minLevel}+</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="text-sm font-bold text-[var(--color-fg)] mb-2 flex items-center gap-1.5"><span aria-hidden>{icon}</span> {title}</div>;
}

function Rule({ children }: { children: ReactNode }) {
  return <li className="flex items-center justify-between gap-2"><span>{children}</span></li>;
}

function Xp({ v, c = 'var(--color-fg)' }: { v: string; c?: string }) {
  return <span className="num font-bold ml-2 shrink-0" style={{ color: c }}>{v}</span>;
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
