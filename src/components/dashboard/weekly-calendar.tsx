'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  RO_DAYS, RO_DAYS_SHORT,
  getWeekDates, getActivitiesForDay, addWeeks, formatWeekRange,
  getWeekStart, isToday, isPast,
  type Activity,
} from '@/lib/activities';
import { useActivities } from '@/lib/use-activities';
import { useUser } from '@/lib/user';
import { FIRST_NAME } from '@/lib/sleep';
import { Avi } from '@/components/ui/avi';

export function WeeklyCalendar() {
  const { weekStart, setWeekStart, loading, toggleBooking, getNames } = useActivities();
  const { user } = useUser();
  const dates = getWeekDates(weekStart);
  const todayWeek = getWeekStart(new Date());
  const isCurrentWeek = weekStart === todayWeek;

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart(addWeeks(weekStart, -1))}
          className="p-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          aria-label="Săptămâna anterioară"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="num text-sm font-bold text-[var(--color-fg)]">{formatWeekRange(weekStart)}</div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(todayWeek)}
              className="text-[10px] text-[var(--color-accent)] hover:underline mt-0.5"
            >
              ← Această săptămână
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          className="p-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          aria-label="Săptămâna următoare"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-[var(--color-fg-muted)] py-12">Se încarcă...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-3">
          {dates.map((date, dayIdx) => {
            const activities = getActivitiesForDay(dayIdx);
            const today = isToday(date);
            const past = isPast(date);
            return (
              <div key={date} className="flex flex-col gap-2">
                <div
                  className={`text-center py-1.5 rounded-lg border transition-colors ${
                    today
                      ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                      : past
                        ? 'bg-[var(--color-surface)]/50 border-[var(--color-border)]/50 text-[var(--color-fg-dim)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)]'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider">
                    <span className="sm:hidden">{RO_DAYS[dayIdx]}</span>
                    <span className="hidden sm:inline">{RO_DAYS_SHORT[dayIdx]}</span>
                  </div>
                  <div className="num text-lg font-bold leading-tight">{date.slice(8)}</div>
                </div>

                {activities.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)]/50 py-6 sm:py-4">
                    <span className="text-[10px] text-[var(--color-fg-dim)]">—</span>
                  </div>
                ) : (
                  activities.map(activity => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      names={getNames(activity.id, date)}
                      user={user}
                      past={past}
                      onToggle={() => { if (user) toggleBooking(activity.id, date, user); }}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity, names, user, past, onToggle,
}: {
  activity: Activity;
  names: string[];
  user: string | null;
  past: boolean;
  onToggle: () => void;
}) {
  const isBooked = !!user && names.includes(user);
  const spots = activity.capacity - names.length;
  const pct = (names.length / activity.capacity) * 100;

  return (
    <div
      className={`rounded-xl border bg-[var(--color-card)] overflow-hidden transition-all ${
        isBooked ? 'border-[var(--color-accent)]/60 shadow-lg' : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
      } ${past ? 'opacity-60' : ''}`}
      style={isBooked ? { boxShadow: `0 0 20px ${activity.color}15` } : undefined}
    >
      <div className="h-0.5" style={{ background: activity.color }} />

      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base leading-none">{activity.emoji}</span>
            <span className="text-xs font-bold truncate" style={{ color: activity.color }}>{activity.name}</span>
          </div>
          <div className="num text-[10px] text-[var(--color-fg-muted)] shrink-0 text-right leading-tight">
            <div>{activity.startTime}</div>
            <div className="text-[var(--color-fg-dim)]">{activity.endTime}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-fg-dim)]">
              {names.length}/{activity.capacity} locuri
            </span>
            {spots <= 3 && spots > 0 && (
              <span className="text-[9px] font-bold text-[var(--color-warn)]">{spots} {spots === 1 ? 'loc' : 'locuri'}</span>
            )}
            {spots === 0 && <span className="text-[9px] font-bold text-[var(--color-bad)]">PLIN</span>}
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? 'var(--color-warn)' : activity.color }}
            />
          </div>
        </div>

        {names.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {names.map(name => (
              <div
                key={name}
                title={name}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <Avi name={name} size="xs" />
                <span className="text-[9px] font-semibold text-[var(--color-fg-muted)]">{FIRST_NAME[name] ?? name.split(/\s+/)[0]}</span>
              </div>
            ))}
          </div>
        )}

        {!past && user && (
          <button
            onClick={onToggle}
            disabled={!isBooked && spots === 0}
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
              isBooked
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/25'
                : spots === 0
                  ? 'bg-[var(--color-surface)] text-[var(--color-fg-dim)] border border-[var(--color-border)] cursor-not-allowed'
                  : 'bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-accent)]'
            }`}
          >
            {isBooked ? '✓ Merg · anulează?' : spots === 0 ? 'Plin' : 'Mă duc 💪'}
          </button>
        )}

        {past && names.length > 0 && (
          <div className="text-[9px] text-[var(--color-fg-dim)] text-center">
            {names.length} {names.length === 1 ? 'participant' : 'participanți'}
          </div>
        )}
      </div>
    </div>
  );
}
