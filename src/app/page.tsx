'use client';
import { useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { TeamFeed } from '@/components/dashboard/team-feed';
import { PersonalHistory } from '@/components/dashboard/personal-history';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { TeamChartPane } from '@/components/dashboard/team-chart-pane';
import { MetricDetailModal, type MetricKey } from '@/components/dashboard/metric-detail-modal';
import { LogEntryButton } from '@/components/dashboard/log-entry-button';
import { StreakStrip } from '@/components/dashboard/streak-strip';
import { SleepCoach } from '@/components/dashboard/sleep-coach';
import { ReadingList } from '@/components/dashboard/reading-list';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — X-style 3-column on xl+, single column below.
 *
 *   LEFT gutter  : Sleep Coach (sticky)
 *   CENTER feed  : streak · KPIs · leaderboard · feed · history · chart
 *   RIGHT gutter : Reading list (sticky)
 *
 * Below xl the gutters collapse: Coach renders inline after the KPIs and the
 * Reading list at the bottom (both hidden in the center on xl, shown in the
 * gutters instead — rendered in both places, toggled by breakpoint).
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
      <div className="mx-auto w-full max-w-[94rem] xl:grid xl:grid-cols-[16rem_minmax(0,1fr)_16rem] xl:gap-5 xl:items-start">
        {/* LEFT gutter — Sleep Coach (xl+ only, sticky) */}
        <aside className="hidden xl:block sticky top-20 fade-in-left delay-2">
          <SleepCoach entries={entries} user={user} />
        </aside>

        {/* CENTER — the feed */}
        <div className="flex flex-col gap-3 lg:gap-4 min-w-0">
          <div className="fade-in-up delay-0">
            <StreakStrip entries={entries} user={user} />
          </div>

          <div className="fade-in-up delay-0">
            <KpiCards entries={entries} user={user} onMetricClick={setOpenMetric} />
          </div>

          {/* Coach inline below xl (gutter takes over on xl) */}
          <div className="xl:hidden fade-in-up delay-1">
            <SleepCoach entries={entries} user={user} />
          </div>

          <div className="fade-in-up delay-1">
            <Leaderboard entries={entries} currentUser={user} />
          </div>

          <div className="fade-in-up delay-2">
            <TeamFeed entries={entries} currentUser={user} limit={5} />
          </div>

          <div className="fade-in-up delay-3">
            <PersonalHistory entries={entries} user={user} limit={6} />
          </div>

          <div className="fade-in-up delay-4">
            <TeamChartPane entries={entries} />
          </div>

          {/* Reading list inline below xl (gutter takes over on xl) */}
          <div className="xl:hidden fade-in-up delay-5">
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
