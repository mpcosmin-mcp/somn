'use client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useRail } from '@/lib/rail';
import { useActivities } from '@/lib/use-activities';
import {
  RO_DAYS_SHORT, getWeekDates, getActivitiesForDay, addWeeks, formatWeekRange,
  getWeekStart, isToday, isPast, type Activity,
} from '@/lib/activities';

/**
 * Left rail = the "Meniu", operations only: the Aria 5-day activity calendar
 * with a quick Mă duc / anulează toggle per class. Ideas moved to the header.
 * Collapsible; on mobile it overlays as a drawer.
 */
export function LeftRail() {
  const { collapsed, toggle } = useRail();
  const { user } = useUser();

  if (!user) return null;

  return (
    <>
      <div
        onClick={toggle}
        aria-hidden
        className={`lg:hidden fixed inset-0 top-14 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />

      <aside
        className={`fixed left-0 top-14 bottom-0 w-[300px] max-w-[85vw] z-40 lg:z-20 flex flex-col gap-4 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:bg-[var(--color-bg)]/70 lg:backdrop-blur-sm px-4 py-4 transition-transform duration-300 ease-out ${
          collapsed ? '-translate-x-full pointer-events-none' : 'translate-x-0'
        }`}
        aria-hidden={collapsed}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--color-fg)] flex items-center gap-1.5">
              <span aria-hidden>🏃</span> Aria
            </div>
            <div className="text-[10px] text-[var(--color-fg-dim)] mt-0.5">Antrenamentele săptămânii · mergi?</div>
          </div>
          <button
            onClick={toggle}
            aria-label="Închide meniul"
            className="p-1.5 -mr-1 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className={collapsed ? '' : 'rail-in'}>
          <AriaWeek />
        </div>
      </aside>
    </>
  );
}

function AriaWeek() {
  const { user } = useUser();
  const { weekStart, setWeekStart, getNames, toggleBooking, loading } = useActivities();
  const dates = getWeekDates(weekStart);
  const todayWeek = getWeekStart(new Date());
  const isCurrentWeek = weekStart === todayWeek;

  return (
    <section>
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setWeekStart(addWeeks(weekStart, -1))}
          aria-label="Săptămâna anterioară"
          className="p-1 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="text-center">
          <div className="num text-[11px] font-bold text-[var(--color-fg)]">{formatWeekRange(weekStart)}</div>
          {!isCurrentWeek && (
            <button onClick={() => setWeekStart(todayWeek)} className="text-[9px] text-[var(--color-accent)] hover:underline">
              ← săptămâna asta
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          aria-label="Săptămâna următoare"
          className="p-1 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {loading ? (
        <div className="text-[11px] text-[var(--color-fg-dim)] text-center py-6">se încarcă...</div>
      ) : (
        <div className="space-y-2">
          {dates.map((date, dayIdx) => {
            const classes = getActivitiesForDay(dayIdx);
            const today = isToday(date);
            const past = isPast(date);
            return (
              <div key={date} className={past ? 'opacity-55' : ''}>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${today ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'}`}>
                    {RO_DAYS_SHORT[dayIdx]}
                  </span>
                  <span className="num text-[10px] text-[var(--color-fg-dim)]">{date.slice(8)}</span>
                  {today && <span className="text-[8px] font-bold text-[var(--color-accent)] uppercase">azi</span>}
                </div>
                {classes.length === 0 ? (
                  <div className="text-[10px] text-[var(--color-fg-dim)] pl-1">—</div>
                ) : (
                  <div className="space-y-1">
                    {classes.map(c => (
                      <RailClass
                        key={c.id}
                        activity={c}
                        names={getNames(c.id, date)}
                        user={user}
                        past={past}
                        onToggle={() => { if (user && !past) toggleBooking(c.id, date, user); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RailClass({ activity, names, user, past, onToggle }: {
  activity: Activity; names: string[]; user: string | null; past: boolean; onToggle: () => void;
}) {
  const isBooked = !!user && names.includes(user);
  const full = names.length >= activity.capacity;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-2 pr-1 py-1">
      <span className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: activity.color }} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold truncate" style={{ color: activity.color }}>{activity.emoji} {activity.name}</div>
        <div className="text-[9px] text-[var(--color-fg-dim)] num">{activity.startTime} · {names.length} merg</div>
      </div>
      {past ? (
        isBooked && <span className="text-[10px] text-[var(--color-fg-dim)] pr-1">✓</span>
      ) : (
        <button
          onClick={onToggle}
          disabled={!isBooked && full}
          className={`text-[10px] font-bold px-1.5 py-1 rounded-md shrink-0 transition-all active:scale-95 ${
            isBooked
              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
              : full
                ? 'text-[var(--color-fg-dim)] border border-[var(--color-border)] cursor-not-allowed'
                : 'border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-accent)]'
          }`}
        >
          {isBooked ? '✓ Merg' : full ? 'Plin' : 'Mă duc'}
        </button>
      )}
    </div>
  );
}
