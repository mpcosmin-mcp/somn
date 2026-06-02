'use client';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import { headToHeadWeek } from '@/lib/insights';

/**
 * Head-to-head — current user vs each teammate over the last 7 days,
 * Sleep Score average. Lightweight competition prompt.
 */
export function HeadToHead({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const rows = headToHeadWeek(entries, user);
  if (!rows.length) return null;

  const me = FIRST_NAME[user] ?? user.split(' ')[0];
  const meColor = personColor(user);

  return (
    <section className="card px-5 py-4 lg:py-5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">Head-to-Head · ultimele 7 zile</span>
        <span className="text-[10px] num text-[var(--color-fg-dim)]">⌀ Sleep Score</span>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(row => {
          const themColor = personColor(row.vs);
          const themFn = FIRST_NAME[row.vs] ?? row.vs.split(' ')[0];
          const total = row.meAvg + row.themAvg || 1;
          const mePct = (row.meAvg / total) * 100;
          const winning = row.diff > 0;
          const tied = row.diff === 0;

          return (
            <div key={row.vs}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-bold flex items-center gap-1.5" style={{ color: meColor }}>
                  {me}
                  <span className="num text-[var(--color-fg-muted)] font-normal">⌀{row.meAvg}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider num"
                  style={{ color: tied ? 'var(--color-fg-muted)' : winning ? 'var(--color-good)' : 'var(--color-warn)' }}
                >
                  {tied ? 'egal' : winning ? `+${row.diff} avantaj` : `${row.diff} în spate`}
                </span>
                <span className="font-bold flex items-center gap-1.5" style={{ color: themColor }}>
                  <span className="num text-[var(--color-fg-muted)] font-normal">⌀{row.themAvg}</span>
                  {themFn}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex bg-[var(--color-surface)]">
                <div className="h-full transition-all" style={{ width: `${mePct}%`, background: meColor }} />
                <div className="h-full transition-all" style={{ width: `${100 - mePct}%`, background: themColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
