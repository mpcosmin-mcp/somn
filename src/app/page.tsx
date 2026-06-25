'use client';
import { useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { TeamFeed } from '@/components/dashboard/team-feed';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { TeamChartPane } from '@/components/dashboard/team-chart-pane';
import { MetricDetailModal, type MetricKey } from '@/components/dashboard/metric-detail-modal';
import { LogEntryButton } from '@/components/dashboard/log-entry-button';
import { ReadingList } from '@/components/dashboard/reading-list';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — X / Twitter 3-column on xl+ (20% · 60% · 20%):
 *
 *   LEFT gutter  (20%) : Activity feed   (sticky)
 *   CENTER      (60%)  : score · champions · team pulse   ← the scroll
 *   RIGHT gutter (20%) : Reading list    (sticky)
 *
 * The feed and the books live in the gutters, OUT of the center scroll. Below
 * xl the gutters can't fit, so both fold back into the center scroll (rendered
 * a second time, toggled by breakpoint). Anything deeper opens in a drawer:
 * a champion row → Player Drawer; a KPI card → per-metric modal. The streak
 * strip, standalone coach and tabular history now live inside the Player Drawer.
 */
export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();
  const [openMetric, setOpenMetric] = useState<MetricKey | null>(null);

  if (!user) return null;

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-[var(--color-bad)]/10 border border-[var(--color-bad)]/30 text-[var(--color-bad)] text-sm">
        {error} <button onClick={() => refetch({ fresh: true })} className="underline">retry</button>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[88rem] xl:grid xl:grid-cols-[1fr_3fr_1fr] xl:gap-5 xl:items-start">
        {/* LEFT gutter — Activity feed (xl+ only, sticky) */}
        <aside className="hidden xl:block sticky top-20 fade-in-left delay-2">
          <TeamFeed entries={entries} currentUser={user} limit={6} />
        </aside>

        {/* CENTER — score · champions · team pulse */}
        <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
          {/* 1 · Today's score */}
          <div className="fade-in-up delay-0">
            <KpiCards entries={entries} user={user} onMetricClick={setOpenMetric} />
          </div>

          {/* 2 · Champions — the central element. Tap a row → Player Drawer. */}
          <div className="fade-in-up delay-1">
            <Leaderboard entries={entries} currentUser={user} />
          </div>

          {/* 3 · Team Pulse */}
          <div className="fade-in-up delay-2">
            <TeamChartPane entries={entries} />
          </div>

          {/* Below xl — feed + books fold into the scroll (no room for gutters) */}
          <div className="xl:hidden fade-in-up delay-3">
            <TeamFeed entries={entries} currentUser={user} limit={5} />
          </div>
          <div className="xl:hidden fade-in-up delay-4">
            <ReadingList />
          </div>
        </div>

        {/* RIGHT gutter — Reading list (xl+ only, sticky) */}
        <aside className="hidden xl:block sticky top-20 fade-in-right delay-3">
          <ReadingList />
        </aside>
      </div>

      {/* Per-metric drilldown — opens from clicking any KPI card */}
      <MetricDetailModal
        metric={openMetric}
        entries={entries}
        user={user}
        onClose={() => setOpenMetric(null)}
        onNavigate={setOpenMetric}
      />

      <LogEntryButton user={user} />
    </>
  );
}
