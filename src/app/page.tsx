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
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — everything on ONE page, in this order:
 *
 *   1. KPI cards — Sleep Score / REM / HRV / RHR with target-vs-actual.
 *   2. Leaderboard — team clasament.
 *   3. TeamFeed — today's journals, likes + comments.
 *   4. Personal History — recent entries + pattern note (no AI).
 *   5. Team Chart — multi-metric switcher.
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
      {/* Personal KPIs — Sleep Score / REM / HRV / RHR · click → modal */}
      <div className="fade-in-up delay-0">
        <KpiCards entries={entries} user={user} onMetricClick={setOpenMetric} />
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
