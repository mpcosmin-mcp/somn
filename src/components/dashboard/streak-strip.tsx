'use client';
import { type SleepEntry, personColor, FIRST_NAME } from '@/lib/sleep';
import { streakFor } from '@/lib/gamify';
import { todayStr } from '@/lib/utils';

/**
 * Duolingo-style daily streak.
 *
 *   🔥 N zile       L M M J V S D
 *                    ● ● ● ○ ○ ● ◐
 *
 * The last 7 days as bullets, today rightmost. Filled = logged, empty = not.
 * Today shows a glow if logged, a soft pulse if not yet — the nudge to come
 * back tonight. Single small card, nothing else.
 */
export function StreakStrip({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const c = personColor(user);
  const streak = streakFor(entries, user);
  const today = todayStr();

  // Pre-index "did I log on date X" for O(1) lookup
  const mineByDate = new Set(
    entries.filter(e => e.name === user).map(e => e.date),
  );

  // Last 7 days, oldest → today
  const days: Array<{ iso: string; label: string; logged: boolean; isToday: boolean }> = [];
  const dayShort = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // Sun..Sat
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = todayStr(d);
    days.push({
      iso,
      label: dayShort[d.getDay()],
      logged: mineByDate.has(iso),
      isToday: iso === today,
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
            style={{ color: streak > 0 ? '#f97316' : 'var(--color-fg-dim)' }}
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
        {days.map(d => (
          <div key={d.iso} className="flex flex-col items-center gap-1 min-w-0">
            <span
              className={`w-3 h-3 rounded-full transition-all ${d.isToday && !d.logged ? 'streak-pulse' : ''}`}
              style={{
                background: d.logged ? c : 'transparent',
                border: d.logged ? `1px solid ${c}` : '1px solid var(--color-border)',
                boxShadow: d.logged && d.isToday ? `0 0 10px ${c}88` : 'none',
              }}
              aria-label={d.logged ? `${d.iso} logat` : `${d.iso} fără log`}
            />
            <span
              className="text-[9px] num font-bold"
              style={{ color: d.isToday ? c : 'var(--color-fg-dim)' }}
            >
              {d.label}
            </span>
          </div>
        ))}
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
