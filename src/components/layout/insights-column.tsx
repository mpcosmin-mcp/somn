'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { DailyRoast, PatternCard, WeeklyStory } from '@/components/dashboard/ai-blocks';

/**
 * Portrait-shaped AI insights column. Sits BETWEEN the sidebar and the
 * main feed on xl+ (≥1280px). Always visible — no toggle. Each card is
 * open by default so the user sees AI commentary at a glance.
 *
 * On <xl, this column is hidden and the same cards render inline within
 * the main feed (see page.tsx).
 *
 * Independently scrollable so the main feed can scroll on its own.
 */
export function InsightsColumn() {
  const { user } = useUser();
  const { entries } = useEntries();

  if (!user || entries.length === 0) return null;

  return (
    <aside
      className="hidden xl:flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)]/30 px-3 py-4 gap-3"
      aria-label="AI insights"
    >
      <div className="label">ai insights</div>

      {/* Pattern alerts — chips, compact */}
      <AlertsBar entries={entries} user={user} />

      {/* Daily AI commentary */}
      <DailyRoast user={user} entries={entries} />

      {/* Weekly pattern finder — pre-expanded */}
      <PatternCard user={user} entries={entries} defaultOpen />

      {/* Weekly story — pre-expanded */}
      <WeeklyStory entries={entries} defaultOpen />
    </aside>
  );
}
