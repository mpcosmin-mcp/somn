'use client';
import Link from 'next/link';
import { type SleepEntry, NAMES, FIRST_NAME, ssColor, personColor, remColor, lastNDays } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { Sparkline } from '@/components/ui/sparkline';
import { calcXP, xpLevel, tierFor, streakFor } from '@/lib/gamify';

export function TeamRow({ entries, currentUser }: { entries: SleepEntry[]; currentUser: string }) {
  const last7 = lastNDays(entries, 7);
  const last7Dates = [...new Set(last7.map(e => e.date))].sort();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {NAMES.map(name => {
        const personEntries = entries.filter(e => e.name === name);
        const sorted = [...personEntries].sort((a, b) => b.date.localeCompare(a.date));
        const last = sorted[0] ?? null;
        const xp = calcXP(entries, name);
        const lvl = xpLevel(xp);
        const tier = tierFor(lvl);
        const streak = streakFor(entries, name);
        const isMe = name === currentUser;

        // 7-day SS series (one point per day, null if not logged)
        const ssSeries = last7Dates.map(d => {
          const e = personEntries.find(x => x.date === d);
          return e ? e.ss : null;
        });

        const remSeries = last7Dates.map(d => {
          const e = personEntries.find(x => x.date === d);
          return e?.rem ?? null;
        });

        return (
          <Link
            key={name}
            href={`/detail?u=${encodeURIComponent(name)}`}
            className="group"
          >
            <Card
              className={`p-4 hover:border-[var(--color-fg-dim)] transition-all ${isMe ? 'ring-1 ring-[var(--color-accent)]/40' : ''}`}
              style={isMe ? { boxShadow: '0 0 32px rgba(163, 230, 53, 0.08)' } : undefined}
            >
              <div className="flex items-center gap-2 mb-3">
                <Avi name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                    {FIRST_NAME[name]}
                    {isMe && <span className="text-[8px] uppercase tracking-wider text-[var(--color-accent)]">tu</span>}
                  </div>
                  <div className="text-[9px] text-[var(--color-fg-muted)] flex items-center gap-1">
                    <span style={{ color: tier.color }}>{tier.icon}</span>
                    Lv {lvl} · {tier.name}
                    {streak > 0 && <span className="ml-auto text-[var(--color-accent)] num font-bold">{streak}d</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="label mb-0.5">SS</div>
                  <div className="num text-3xl font-bold leading-none" style={{ color: last ? ssColor(last.ss) : '#52525b' }}>
                    {last ? last.ss : '—'}
                  </div>
                </div>
                <div>
                  <div className="label mb-0.5">REM</div>
                  <div className="num text-xl font-bold leading-none" style={{ color: last?.rem != null ? remColor(last.rem) : '#52525b' }}>
                    {last?.rem ?? '—'}
                    {last?.rem != null && <span className="text-[10px] text-[var(--color-fg-muted)] font-normal ml-0.5">min</span>}
                  </div>
                </div>
                <Sparkline values={ssSeries} width={56} height={24} color={personColor(name)} />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
