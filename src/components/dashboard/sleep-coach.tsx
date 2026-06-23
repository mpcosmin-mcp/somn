'use client';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { coachInsights, type InsightTone } from '@/lib/coach';

/**
 * Sleep Coach — per-person, deterministic insights surfaced as short
 * prescriptive nudges. Pure render of `coachInsights()` (the shared rule
 * engine). No AI, no network — instant, $0 runtime.
 *
 * Reads only Sleep Score / REM / HRV / RHR; wake-time & duration aren't
 * tracked, so the coach is intentionally silent on those.
 */
const TONE: Record<InsightTone, { color: string; label: string }> = {
  warn: { color: 'var(--color-warn)', label: 'atenție' },
  good: { color: 'var(--color-good)', label: 'merge bine' },
  tip:  { color: 'var(--color-accent)', label: 'sugestie' },
};

function ToneIcon({ tone }: { tone: InsightTone }) {
  const c = TONE[tone].color;
  const p = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tone === 'warn') return (<svg {...p} aria-hidden><path d="M3 7l6 6 4-4 8 8" /><path d="M21 17v-4h-4" /></svg>);
  if (tone === 'good') return (<svg {...p} aria-hidden><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v4h-4" /></svg>);
  return (<svg {...p} aria-hidden><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10c.5.5 1 1.4 1 2h6c0-.6.5-1.5 1-2a6 6 0 0 0-4-10z" /></svg>);
}

export function SleepCoach({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const insights = coachInsights(entries, user);
  const first = FIRST_NAME[user] ?? user;

  return (
    <section className="card kpi px-5 py-4 lg:py-5 flex flex-col" style={{ ['--kpi-accent' as string]: 'var(--color-accent)' }}>
      <div className="flex items-center gap-2.5 mb-3.5">
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)', color: 'var(--color-accent)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            <path d="m6.3 6.3 1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </span>
        <div className="flex flex-col">
          <span className="label">Coach de Somn</span>
          <span className="text-[11px] text-[var(--color-fg-dim)] leading-tight">pentru {first} · din datele tale</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {insights.map(i => {
          const t = TONE[i.tone];
          return (
            <div
              key={i.id}
              className="rounded-xl border px-3.5 py-3"
              style={{
                background: `color-mix(in srgb, ${t.color} 8%, transparent)`,
                borderColor: `color-mix(in srgb, ${t.color} 26%, transparent)`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <ToneIcon tone={i.tone} />
                <span className="label" style={{ color: t.color }}>{t.label}</span>
              </div>
              <div className="text-sm font-medium text-[var(--color-fg)] leading-snug">{i.title}</div>
              <div className="text-xs text-[var(--color-fg-muted)] leading-snug mt-1">{i.body}</div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--color-fg-dim)] mt-3 leading-snug">
        Calculate local din scor, REM, HRV și RHR — fără AI. Sugestii de igienă a somnului, nu sfat medical.
      </p>
    </section>
  );
}
