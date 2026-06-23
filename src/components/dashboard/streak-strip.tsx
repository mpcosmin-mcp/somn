'use client';
import { type SleepEntry, personColor, FIRST_NAME, ssColor } from '@/lib/sleep';
import { streakFor } from '@/lib/gamify';
import { todayStr } from '@/lib/utils';

/**
 * Duolingo-style daily streak.
 *
 *   🔥 N zile       L M M J V S D
 *                    ● ● ● ○ ○ ● ◐
 *
 * The last 7 days as bullets, today rightmost. Each logged day's dot is
 * colored by that day's Sleep Score (green/amber/red) so the strip mirrors
 * real performance, not just "did I log". Missed days are hollow/dim; today,
 * if not yet logged, shows a soft pulse — the nudge to come back tonight.
 */
export function StreakStrip({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const c = personColor(user);
  const streak = streakFor(entries, user);
  const today = todayStr();

  // Pre-index date → entry for O(1) lookup (we need the score, to color the dot)
  const mineByDate = new Map(
    entries.filter(e => e.name === user).map(e => [e.date, e] as const),
  );

  // Last 7 days, oldest → today
  const days: Array<{ iso: string; label: string; logged: boolean; isToday: boolean; ss: number | null }> = [];
  const dayShort = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // Sun..Sat
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = todayStr(d);
    const e = mineByDate.get(iso);
    days.push({
      iso,
      label: dayShort[d.getDay()],
      logged: !!e,
      isToday: iso === today,
      ss: e ? e.ss : null,
    });
  }

  const todayLogged = days[days.length - 1].logged;

  return (
    <section className="card px-4 py-3 lg:px-5 lg:py-4 flex items-center gap-4">
      {/* Flame + streak number */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xl leading-none" aria-hidden>🔥</span>
        <div className="leading-none">
          <div
            className="num font-bold text-2xl"
            style={{ color: streak > 0 ? 'var(--color-good)' : 'var(--color-fg-dim)' }}
          >
            {streak}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-muted)] mt-0.5">
            {streak === 1 ? 'zi' : 'zile'}
          </div>
        </div>
      </div>

      {/* Bullets — last 7 days */}
      <div className="flex-1 min-w-0 flex items-end justify-between gap-1">
        {days.map(d => {
          // Dot color mirrors sleep PERFORMANCE, not just "logged":
          //   logged → that day's Sleep Score color (green/amber/red)
          //   missed → hollow dim ring (clearly "no data", not a bad night)
          //   today & not yet logged → pulsing accent ring (the nudge)
          const todayPending = d.isToday && !d.logged;
          const perf = d.ss != null ? ssColor(d.ss) : null;
          const dim = 'var(--color-fg-dim)';
          return (
            <div key={d.iso} className="flex flex-col items-center gap-1.5 min-w-0">
              <span
                className={`w-5 h-5 rounded-full transition-all ${todayPending ? 'streak-pulse' : ''}`}
                style={{
                  background: perf ?? 'transparent',
                  border: `2px solid ${perf ?? (todayPending ? 'var(--color-accent)' : dim)}`,
                  boxShadow: perf ? `0 0 8px ${perf}66` : 'none',
                  opacity: d.logged ? 1 : (todayPending ? 0.9 : 0.4),
                }}
                aria-label={d.logged ? `${d.iso}: scor ${d.ss}` : (todayPending ? `${d.iso}: încă nelogat` : `${d.iso}: fără log`)}
              />
              <span
                className="text-[10px] num font-bold"
                style={{ color: d.isToday ? 'var(--color-fg)' : 'var(--color-fg-dim)' }}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tonight nudge — only when today's not logged yet */}
      {!todayLogged && (
        <div className="hidden sm:block text-[10px] text-[var(--color-fg-muted)] shrink-0 max-w-[10rem] text-right leading-snug">
          {streak > 0
            ? `nu rupe streakul, ${fn} — mai logezi diseară?`
            : `loghează azi, ${fn} — și pornim streakul`}
        </div>
      )}
    </section>
  );
}
