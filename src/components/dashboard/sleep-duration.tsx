'use client';
import { type SleepEntry, sleepDurationMin, fmtDuration, durationColor, lastNDays } from '@/lib/sleep';
import { todayStr } from '@/lib/utils';

/**
 * Sleep Duration — the headline "how long did I actually sleep" card.
 *
 * Latest night's total (bedtime → wake) + the 7-day average, each colored
 * by the 7-9h target band. Computed locally from start/end (no AI, no extra
 * fetch). Until someone logs times it shows a clean empty state that nudges
 * logging — it fills in automatically once the times start flowing.
 */
export function SleepDuration({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const mine = entries
    .filter(e => e.name === user)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = mine[0] ?? null;
  const lastDur = last ? sleepDurationMin(last.start, last.end) : null;
  const isToday = !!last && last.date === todayStr();

  const wk = lastNDays(entries.filter(e => e.name === user), 7);
  const wkDurs = wk
    .map(e => sleepDurationMin(e.start, e.end))
    .filter((d): d is number => d != null);
  const wkAvg = wkDurs.length ? Math.round(wkDurs.reduce((s, v) => s + v, 0) / wkDurs.length) : null;

  const accent = lastDur != null ? durationColor(lastDur) : 'var(--color-accent)';

  return (
    <section className="card kpi px-5 py-4 lg:py-5" style={{ ['--kpi-accent' as string]: accent }}>
      <div className="flex items-end justify-between gap-4">
        {/* Latest night */}
        <div className="min-w-0">
          <div className="label mb-1.5">Somn{isToday ? ' · azi' : ''}</div>
          <span
            className="num font-bold leading-none text-4xl lg:text-5xl tracking-tight"
            style={{ color: lastDur != null ? durationColor(lastDur) : 'var(--color-fg-dim)' }}
          >
            {lastDur != null ? fmtDuration(lastDur) : '—'}
          </span>
          {last && last.start && last.end ? (
            <div className="num text-xs text-[var(--color-fg-muted)] mt-2">{last.start} → {last.end}</div>
          ) : (
            <div className="text-xs text-[var(--color-fg-dim)] mt-2 max-w-[14rem] leading-snug">
              loghează ora de culcare + trezire ca să vezi durata
            </div>
          )}
        </div>

        {/* Weekly average */}
        <div className="text-right shrink-0">
          <div className="label mb-1.5">media săpt</div>
          <span
            className="num font-bold text-2xl lg:text-3xl leading-none"
            style={{ color: wkAvg != null ? durationColor(wkAvg) : 'var(--color-fg-dim)' }}
          >
            {wkAvg != null ? fmtDuration(wkAvg) : '—'}
          </span>
          <div className="text-[10px] num text-[var(--color-fg-dim)] mt-2">
            {wkDurs.length ? `din ${wkDurs.length} ${wkDurs.length === 1 ? 'noapte' : 'nopți'}` : 'țintă 7-9h'}
          </div>
        </div>
      </div>
    </section>
  );
}
