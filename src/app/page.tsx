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
 * Main dashboard — everything on ONE page, in this order:
 *
 *   0. StreakStrip — Duolingo-style daily bullets + current streak.
 *   1. KPI cards — Sleep Score / REM / HRV / RHR with target-vs-actual.
 *   2. Sleep Coach — deterministic per-person insights (no AI).
 *   3. Leaderboard — team clasament.
 *   4. TeamFeed — today's journals, likes + comments.
 *   5. Personal History — recent entries + pattern note (no AI).
 *   6. Team Chart — multi-metric switcher.
 *   7. Reading list — curated sleep books (static links).
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
        {error} <button onClick={refetch} className="underline">retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4 max-w-6xl mx-auto w-full">
      {/* Duolingo-style streak — current run + last 7 days as dots */}
      <div className="fade-in-up delay-0">
        <StreakStrip entries={entries} user={user} />
      </div>

      {/* Personal KPIs — Sleep Score / REM / HRV / RHR · click → modal */}
      <div className="fade-in-up delay-0">
        <KpiCards entries={entries} user={user} onMetricClick={setOpenMetric} />
      </div>

      {/* Sleep Coach — deterministic per-person insights (no AI, $0 runtime) */}
      <div className="fade-in-up delay-1">
        <SleepCoach entries={entries} user={user} />
      </div>

      {/* Team clasament */}
      <div className="fade-in-up delay-1">
        <Leaderboard entries={entries} currentUser={user} />
      </div>

      {/* Social feed — today's journals, with likes + comments */}
      <div className="fade-in-up delay-2">
        <TeamFeed entries={entries} currentUser={user} limit={5} />
      </div>

      {/* Personal history (with pattern footer) */}
      <div className="fade-in-up delay-3">
        <PersonalHistory entries={entries} user={user} limit={6} />
      </div>

      {/* Team multi-metric chart */}
      <div className="fade-in-up delay-4">
        <TeamChartPane entries={entries} />
      </div>

      {/* Reading list — curated sleep books (static links, $0 runtime) */}
      <div className="fade-in-up delay-5">
        <ReadingList />
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
    </div>
  );
}
