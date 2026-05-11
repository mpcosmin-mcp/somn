'use client';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * Squad bar — minimalist row with each teammate's 7-day avg Sleep Score.
 *
 * No chart, no card chrome — just typography & spacing. Current user is
 * highlighted in indigo. Sorted by score descending so the leader is
 * visually first.
 *
 * Inspired by PDF page 5: "Competiția Squad".
 */
export function SquadBar({ entries, currentUser }: { entries: SleepEntry[]; currentUser: string }) {
  const last7 = lastNDays(entries, 7);

  const rows = NAMES.map(n => {
    const theirs = last7.filter(e => e.name === n);
    const avg = theirs.length
      ? Math.round(theirs.reduce((s, e) => s + e.ss, 0) / theirs.length)
      : null;
    return {
      name: n,
      fn: FIRST_NAME[n] ?? n.split(' ')[0],
      avg,
      logs: theirs.length,
      isMe: n === currentUser,
    };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  return (
    <section className="card px-5 py-4 lg:py-5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">Competiția Squad · Sleep Score mediu</span>
        <span className="text-[10px] num text-[var(--color-fg-dim)]">ultimele 7 zile</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {rows.map((r, i) => {
          const accent = r.isMe ? 'var(--color-accent)' : 'var(--color-fg)';
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          return (
            <div key={r.name} className="text-center">
              <div className="num font-bold text-3xl lg:text-4xl leading-none tracking-tight" style={{ color: accent }}>
                {r.avg ?? '—'}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                <span className="text-[10px]" aria-hidden>{medal}</span>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: r.isMe ? 'var(--color-accent)' : 'var(--color-fg-muted)' }}
                >
                  {r.isMe ? 'TU' : r.fn}
                </span>
              </div>
              <div className="text-[9px] num text-[var(--color-fg-dim)] mt-0.5">
                {r.logs ? `${r.logs} loguri` : 'fără date'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
