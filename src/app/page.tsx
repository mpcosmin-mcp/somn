'use client';
import { useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { TeamChartPane } from '@/components/dashboard/team-chart-pane';
import { MetricDetailModal, type MetricKey } from '@/components/dashboard/metric-detail-modal';
import { LogEntryButton } from '@/components/dashboard/log-entry-button';
import { DashboardSkeleton } from '@/components/ui/skeleton';

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
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-3 lg:gap-4">
        <div className="fade-in-up delay-0">
          <KpiCards entries={entries} user={user} onMetricClick={setOpenMetric} />
        </div>
        <div className="fade-in-up delay-1">
          <Leaderboard entries={entries} currentUser={user} />
        </div>
        <div className="fade-in-up delay-2">
          <TeamChartPane entries={entries} />
        </div>
      </div>

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
