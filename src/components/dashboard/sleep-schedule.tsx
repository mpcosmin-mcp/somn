'use client';
import { FIRST_NAME, personColor } from '@/lib/sleep';

/**
 * Sleep Schedule — a timeline of who sleeps from when to when, against the
 * "sweet spot" window (22:30–06:30). Each person gets a bar from bedtime to
 * wake; the green band behind shows the ideal window so you instantly see who
 * goes to bed late / wakes early / nails it.
 *
 * Times are passed as minutes-from-18:00 (so evening→morning is linear and the
 * midnight wrap is already handled upstream).
 */
export interface ScheduleRow {
  name: string;
  start: number; // bedtime, minutes from 18:00
  end: number;   // wake, minutes from 18:00
}

const SPAN = 1080;        // 18:00 → 12:00 next day, in minutes
const SWEET_START = 270;  // 22:30
const SWEET_END = 750;    // 06:30
const AXIS = [120, 360, 600, 840]; // 20:00 · 00:00 · 04:00 · 08:00

const clampPct = (m: number) => Math.max(0, Math.min(100, (m / SPAN) * 100));
const pct = (m: number) => `${clampPct(m)}%`;

function clock(min: number): string {
  const t = (((Math.round(min) + 18 * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function SleepSchedule({ rows, currentUser }: { rows: ScheduleRow[]; currentUser?: string }) {
  if (!rows.length) return null;

  return (
    <div className="px-4 sm:px-5 py-4 border-y border-[var(--color-border)]">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <span className="label">Program de somn</span>
        <span className="text-[10px] num font-bold" style={{ color: 'var(--color-good)' }}>
          ★ sweet spot 22:30–06:30
        </span>
      </div>

      <div className="space-y-1.5">
        {rows.map(r => {
          const c = personColor(r.name);
          const isMe = r.name === currentUser;
          const barLeft = clampPct(r.start);
          const barRight = clampPct(r.end);
          const barW = Math.max(0, barRight - barLeft);
          return (
            <div key={r.name} className="grid grid-cols-[3rem_1fr_5rem] sm:grid-cols-[3.5rem_1fr_5.5rem] gap-2.5 items-center">
              <span className="text-xs font-bold truncate" style={{ color: c }}>{FIRST_NAME[r.name] ?? r.name.split(' ')[0]}</span>

              <div className={`relative h-6 rounded-md bg-[var(--color-surface)]/50 overflow-hidden ${isMe ? 'ring-1 ring-[var(--color-accent)]/40' : ''}`}>
                {/* sweet-spot band */}
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: pct(SWEET_START),
                    width: `calc(${pct(SWEET_END)} - ${pct(SWEET_START)})`,
                    background: 'color-mix(in srgb, var(--color-good) 15%, transparent)',
                    borderLeft: '1px dashed color-mix(in srgb, var(--color-good) 45%, transparent)',
                    borderRight: '1px dashed color-mix(in srgb, var(--color-good) 45%, transparent)',
                  }}
                  aria-hidden
                />
                {/* person's sleep bar */}
                <div
                  className="absolute inset-y-1 rounded-full shadow-sm"
                  style={{ left: `${barLeft}%`, width: `${barW}%`, background: c, boxShadow: `0 0 10px ${c}66` }}
                  title={`${clock(r.start)} → ${clock(r.end)}`}
                />
              </div>

              <span className="num text-[10px] text-[var(--color-fg-muted)] text-right whitespace-nowrap">
                {clock(r.start)}→{clock(r.end)}
              </span>
            </div>
          );
        })}
      </div>

      {/* time axis */}
      <div className="grid grid-cols-[3rem_1fr_5rem] sm:grid-cols-[3.5rem_1fr_5.5rem] gap-2.5 mt-1.5">
        <span />
        <div className="relative h-3">
          {AXIS.map(a => (
            <span
              key={a}
              className="absolute text-[9px] num text-[var(--color-fg-dim)] -translate-x-1/2"
              style={{ left: pct(a) }}
            >
              {clock(a)}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
