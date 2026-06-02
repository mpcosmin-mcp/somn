'use client';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import { weeklyMVP, factOfThePeriod, anomaliesFor } from '@/lib/insights';

/**
 * Top-of-dashboard insight strip:
 *   • Weekly MVP banner (left)
 *   • Fact of the day/week/month (middle)
 *   • Anomaly callouts for the current user (right column / below on mobile)
 *
 * Renders nothing if the team has no data yet — no empty card.
 */
export function InsightStrip({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const mvp = weeklyMVP(entries);
  const fact = factOfThePeriod(entries);
  const anomalies = anomaliesFor(entries, user);

  if (!mvp && !fact && !anomalies.length) return null;

  return (
    <section className="card px-4 py-3 lg:px-5 lg:py-4 grid gap-2 md:gap-3 md:grid-cols-[1fr_1fr_1.1fr]">
      {/* MVP */}
      {mvp && (
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">👑</span>
          <div className="min-w-0">
            <div className="label">MVP săptămâna</div>
            <div className="text-xs truncate font-bold" style={{ color: personColor(mvp.name) }}>
              {FIRST_NAME[mvp.name] ?? mvp.name}
              <span className="num text-[var(--color-fg-muted)] font-normal"> · ⌀{mvp.avgSS} SS</span>
            </div>
          </div>
        </div>
      )}

      {/* Fact */}
      {fact && (
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-base shrink-0">💡</span>
          <div className="min-w-0">
            <div className="label">
              fact {fact.period === 'day' ? 'azi' : fact.period === 'week' ? 'săptămâna' : 'luna'}
            </div>
            <div className="text-xs text-[var(--color-fg)] leading-snug">{fact.text}</div>
          </div>
        </div>
      )}

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="flex flex-col gap-1 min-w-0">
          <div className="label">pentru tine</div>
          {anomalies.map((a, i) => (
            <div
              key={i}
              className="text-xs leading-snug"
              style={{ color: a.tone === 'good' ? 'var(--color-good)' : 'var(--color-warn)' }}
            >
              {a.text}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
