'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useActivities } from '@/lib/use-activities';
import { attendanceCount, ACTIVITY_TIERS } from '@/lib/activities';
import { FIRST_NAME, personColor } from '@/lib/sleep';
import { WeeklyCalendar } from '@/components/dashboard/weekly-calendar';
import { Card } from '@/components/ui/card';

export default function ActivitatiPage() {
  const { user } = useUser();
  const { bookings } = useActivities();
  const mine = user ? attendanceCount(bookings, user) : 0;
  const c = user ? personColor(user) : 'var(--color-accent)';

  // Highest tier reached + the next one to chase.
  const reached = ACTIVITY_TIERS.filter(t => mine >= t.threshold);
  const current = reached[reached.length - 1] ?? null;
  const next = ACTIVITY_TIERS.find(t => mine < t.threshold) ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
          <ArrowLeft size={16} /> înapoi
        </Link>
        <h1 className="text-sm font-bold text-[var(--color-fg)]">🏃 Activități Aria</h1>
      </div>

      {/* Attendance + 🏃 Activ badge progress */}
      {user && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="label">Badge 🏃 Activ · {FIRST_NAME[user] ?? user}</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="num text-3xl font-bold leading-none" style={{ color: c }}>{mine}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">antrenamente făcute</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[var(--color-fg-dim)] uppercase tracking-wider">tier curent</div>
              <div className="num text-sm font-bold" style={{ color: current?.color ?? 'var(--color-fg-dim)' }}>
                {current ? current.label : '—'}
              </div>
            </div>
          </div>

          {/* Tier ladder */}
          <div className="grid grid-cols-4 gap-1.5">
            {ACTIVITY_TIERS.map(t => {
              const done = mine >= t.threshold;
              return (
                <div
                  key={t.label}
                  className="rounded-lg border px-2 py-1.5 text-center"
                  style={{
                    borderColor: done ? t.color + '99' : 'var(--color-border)',
                    background: done ? t.color + '14' : 'var(--color-surface)',
                  }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: done ? t.color : 'var(--color-fg-dim)' }}>
                    {t.label}
                  </div>
                  <div className="num text-xs font-bold text-[var(--color-fg)]">{t.threshold}</div>
                  <div className="num text-[9px]" style={{ color: done ? t.color : 'var(--color-fg-dim)' }}>+{Math.round(t.pct * 100)}%</div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-[var(--color-fg-dim)] mt-3 leading-snug">
            {next
              ? <>Încă <strong className="text-[var(--color-fg)]">{next.threshold - mine}</strong> {next.threshold - mine === 1 ? 'antrenament' : 'antrenamente'} până la <strong style={{ color: next.color }}>{next.label}</strong>.</>
              : <>Ai dus badge-ul la <strong style={{ color: current?.color }}>Platină</strong> — maximul. 💪</>}
            {' '}Ca la celelalte badge-uri, îți dă un procent permanent pe fiecare noapte — se adaugă la Măiestria ta din XP.
          </p>
        </Card>
      )}

      <div className="text-[11px] text-[var(--color-fg-muted)] px-1">
        Bifează la ce antrenamente mergi. Doar zilele trecute contează pentru badge.
      </div>

      <WeeklyCalendar />
    </main>
  );
}
