'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { HipnosLine } from '@/components/dashboard/hipnos-line';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SquadBar } from '@/components/dashboard/squad-bar';
import { TeamFeed } from '@/components/dashboard/team-feed';
import { PersonalHistory } from '@/components/dashboard/personal-history';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { TeamChartPane } from '@/components/dashboard/team-chart-pane';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — everything on ONE page, in this order:
 *
 *   1. Hipnos one-liner (single sentence, top of page)
 *   2. KPI cards — personal data, 3 big numbers
 *   3. Squad Competition — 3-up avg SS
 *   4. Split row: Personal History (+ Hipnos pattern note) · Team Leaderboard
 *   5. Team Chart — SS / REM / RHR / HRV multi-metric switcher
 *
 * Page scrolls vertically — no fake "fit in viewport" constraint
 * (that hid the team chart on the old /detail page).
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
      {/* 🦞 Top one-liner */}
      <div className="fade-in-up delay-0">
        <HipnosLine entries={entries} user={user} />
      </div>

      {/* Personal KPIs */}
      <div className="fade-in-up delay-1">
        <KpiCards entries={entries} user={user} />
      </div>

      {/* Squad competition (3-up averages) */}
      <div className="fade-in-up delay-2">
        <SquadBar entries={entries} currentUser={user} />
      </div>

      {/* Social feed — journals from the team, with likes + comments */}
      <div className="fade-in-up delay-3">
        <TeamFeed entries={entries} currentUser={user} limit={5} />
      </div>

      {/* Split: Personal History · Team Leaderboard */}
      <div className="fade-in-up delay-4 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <PersonalHistory entries={entries} user={user} limit={6} />
        <Leaderboard entries={entries} currentUser={user} />
      </div>

      {/* Team chart — SS / REM / RHR / HRV switcher */}
      <div className="fade-in-up delay-4">
        <TeamChartPane entries={entries} />
      </div>
    </div>
  );
}
