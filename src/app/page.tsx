'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { SforailaInsights } from '@/components/dashboard/sforaila-insights';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { TeamFeed } from '@/components/dashboard/team-feed';
import { PersonalHistory } from '@/components/dashboard/personal-history';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { TeamChartPane } from '@/components/dashboard/team-chart-pane';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — everything on ONE page, in this order:
 *
 *   1. Sforăilă Insights — 3 fun observations (azi / săpt / clasament)
 *      from the AI. No chat anymore; this is his ambient presence.
 *   2. KPI cards — Sleep Score / REM / HRV / RHR with target-vs-actual.
 *   3. Leaderboard — team clasament.
 *   4. TeamFeed — today's journals, likes + comments.
 *   5. Personal History — recent entries + Sforăilă pattern note.
 *   6. Team Chart — multi-metric switcher.
 */
export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

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
      {/* 🐻 Sforăilă observă — 3 insights de la AI */}
      <div className="fade-in-up delay-0">
        <SforailaInsights entries={entries} user={user} />
      </div>

      {/* Personal KPIs — Sleep Score / REM / HRV / RHR */}
      <div className="fade-in-up delay-1">
        <KpiCards entries={entries} user={user} />
      </div>

      {/* Team clasament */}
      <div className="fade-in-up delay-2">
        <Leaderboard entries={entries} currentUser={user} />
      </div>

      {/* Social feed — today's journals, with likes + comments */}
      <div className="fade-in-up delay-3">
        <TeamFeed entries={entries} currentUser={user} limit={5} />
      </div>

      {/* Personal history (with Sforăilă pattern footer) */}
      <div className="fade-in-up delay-4">
        <PersonalHistory entries={entries} user={user} limit={6} />
      </div>

      {/* Team multi-metric chart */}
      <div className="fade-in-up delay-5">
        <TeamChartPane entries={entries} />
      </div>
    </div>
  );
}
