'use client';
import Link from 'next/link';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { Hero } from '@/components/dashboard/hero';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { PageVibe } from '@/components/dashboard/page-vibe';
import { MyChartsGrid } from '@/components/dashboard/my-charts-grid';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — minimalist, big numbers, straight to the data.
 *
 *   1. Hipnos greeting (max 3 sentences)
 *   2. Pattern alerts (if any)
 *   3. Hero — last night's numbers
 *   4. 4 detailed charts of MY data (SS / REM / RHR / HRV)
 *   5. Team leaderboard
 *   6. Quiet link → /detail (team istoric)
 *
 * Chat with Hipnos: floating bubble bottom-right (works from anywhere).
 */
export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-3 lg:space-y-4">
      {loading && <DashboardSkeleton />}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error} <button onClick={refetch} className="underline">retry</button>
        </div>
      )}

      {!loading && (
        <>
          {/* Hipnos greeting — sharp, max 3 sentences */}
          <div className="fade-in-up delay-0">
            <PageVibe user={user} entries={entries} />
          </div>

          {/* Pattern alerts (warnings only when something's off) */}
          <div className="fade-in-up delay-1">
            <AlertsBar entries={entries} user={user} />
          </div>

          {/* Last night — big numbers */}
          <div className="fade-in-up delay-1">
            <Hero entries={entries} user={user} />
          </div>

          {/* 4 detailed charts of MY data */}
          <div className="fade-in-up delay-2">
            <MyChartsGrid entries={entries} user={user} />
          </div>

          {/* Team leaderboard */}
          <div className="fade-in-up delay-3">
            <Leaderboard entries={entries} currentUser={user} />
          </div>

          {/* Quiet link to team history */}
          <div className="fade-in-up delay-4 text-center pt-2 pb-1">
            <Link
              href="/detail"
              className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <span>👥 istoric echipă</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
