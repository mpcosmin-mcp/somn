'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ChevronRight } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useRail } from '@/lib/rail';
import { useActivities } from '@/lib/use-activities';
import { getActivitiesForDay, type Activity } from '@/lib/activities';
import { todayStr } from '@/lib/utils';
import type { Idea } from '@/app/api/ideas/route';

const STATUS_ICON: Record<string, string> = { new: '📝', wip: '🔨', done: '✅', rejected: '❌' };

/**
 * Left rail — the slide-out "Meniu". Fills the empty desktop gutter and, on
 * mobile, overlays as a drawer. Holds today's Aria classes (bookable inline)
 * and the top ideas. Toggled from the TopBar "Meniu" button; state persists.
 */
export function LeftRail() {
  const { collapsed, toggle } = useRail();
  const { user } = useUser();

  if (!user) return null;

  return (
    <>
      {/* Mobile backdrop — tap to close */}
      <div
        onClick={toggle}
        aria-hidden
        className={`lg:hidden fixed inset-0 top-14 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />

      <aside
        className={`fixed left-0 top-14 bottom-0 w-[300px] max-w-[85vw] z-40 lg:z-20 flex flex-col gap-5 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:bg-[var(--color-bg)]/70 lg:backdrop-blur-sm px-4 py-4 transition-transform duration-300 ease-out ${
          collapsed ? '-translate-x-full pointer-events-none' : 'translate-x-0'
        }`}
        aria-hidden={collapsed}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--color-fg)] flex items-center gap-1.5">
              <span aria-hidden>☰</span> Meniu
            </div>
            <div className="text-[10px] text-[var(--color-fg-dim)] mt-0.5">Orarul Aria · ideile echipei</div>
          </div>
          <button
            onClick={toggle}
            aria-label="Închide meniul"
            className="p-1.5 -mr-1 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className={collapsed ? '' : 'rail-in delay-0'}>
          <AriaToday />
        </div>
        <div className={collapsed ? '' : 'rail-in delay-1'}>
          <IdeasMini />
        </div>
      </aside>
    </>
  );
}

function AriaToday() {
  const { user } = useUser();
  const { getNames, toggleBooking } = useActivities();
  const date = todayStr();
  const dayIdx = (new Date().getDay() + 6) % 7; // 0=Mon … 6=Sun
  const classes = dayIdx <= 4 ? getActivitiesForDay(dayIdx) : [];

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="label">🏃 Azi la Aria</span>
        <Link href="/activitati" className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
          orar <ChevronRight size={11} />
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="text-[11px] text-[var(--color-fg-dim)] rounded-lg border border-dashed border-[var(--color-border)]/60 px-3 py-4 text-center">
          Weekend — fără antrenamente. <Link href="/activitati" className="text-[var(--color-accent)] hover:underline">Vezi săptămâna →</Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {classes.map(c => (
            <RailClass
              key={c.id}
              activity={c}
              names={getNames(c.id, date)}
              user={user}
              onToggle={() => { if (user) toggleBooking(c.id, date, user); }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RailClass({ activity, names, user, onToggle }: {
  activity: Activity; names: string[]; user: string | null; onToggle: () => void;
}) {
  const isBooked = !!user && names.includes(user);
  const full = names.length >= activity.capacity;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden transition-colors">
      <div className="h-0.5" style={{ background: activity.color }} />
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold truncate" style={{ color: activity.color }}>
            {activity.emoji} {activity.name}
          </span>
          <span className="num text-[10px] text-[var(--color-fg-muted)] shrink-0">{activity.startTime}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-[10px] text-[var(--color-fg-dim)] num">{names.length} merg</span>
          <button
            onClick={onToggle}
            disabled={!isBooked && full}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all active:scale-95 ${
              isBooked
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
                : full
                  ? 'text-[var(--color-fg-dim)] border border-[var(--color-border)] cursor-not-allowed'
                  : 'border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-accent)]'
            }`}
          >
            {isBooked ? '✓ Merg' : full ? 'Plin' : 'Mă duc 💪'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IdeasMini() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/ideas', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { ideas: [] }))
      .then((j: { ideas?: Idea[] }) => { if (alive) setIdeas(j.ideas ?? []); })
      .catch(() => { if (alive) setIdeas([]); });
    return () => { alive = false; };
  }, []);

  const top = (ideas ?? [])
    .slice()
    .sort((a, b) => (b.up.length - b.down.length) - (a.up.length - a.down.length))
    .slice(0, 4);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="label">💡 Idei</span>
        <Link href="/ideas" className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
          toate <ChevronRight size={11} />
        </Link>
      </div>

      {ideas === null ? (
        <div className="text-[11px] text-[var(--color-fg-dim)]">se încarcă...</div>
      ) : top.length === 0 ? (
        <Link href="/ideas" className="block text-[11px] text-[var(--color-fg-dim)] rounded-lg border border-dashed border-[var(--color-border)]/60 px-3 py-4 text-center hover:text-[var(--color-fg)] transition-colors">
          Nicio idee încă. Scrie prima →
        </Link>
      ) : (
        <div className="space-y-1.5">
          {top.map(idea => {
            const score = idea.up.length - idea.down.length;
            return (
              <Link
                key={idea.id}
                href="/ideas"
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-2 hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <span className="num text-xs font-bold w-6 text-center shrink-0" style={{ color: score > 0 ? 'var(--color-good)' : 'var(--color-fg-dim)' }}>
                  {score > 0 ? `+${score}` : score}
                </span>
                <span className="text-[11px] text-[var(--color-fg)] truncate flex-1 min-w-0">{idea.title}</span>
                <span className="text-[11px] shrink-0" title={idea.status}>{STATUS_ICON[idea.status] ?? ''}</span>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href="/ideas"
        className="mt-2 block text-center text-[10px] font-bold text-[var(--color-accent)] hover:underline"
      >
        + adaugă o idee
      </Link>
    </section>
  );
}
