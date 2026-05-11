'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { todayStr } from '@/lib/utils';
import { FIRST_NAME } from '@/lib/sleep';
import { Hero } from '@/components/dashboard/hero';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { DailyRoast, WeeklyStory, PatternCard } from '@/components/dashboard/ai-blocks';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { AINudge } from '@/components/dashboard/ai-nudge';
import { PageVibe } from '@/components/dashboard/page-vibe';
import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

  // AppShell handles the case where user is null. If we're here, user exists.
  if (!user) return null;

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const todayLogged = entries.some(e => e.date === todayStr() && e.name === user);

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
          {/* AI vibe at the top — sets the tone for the whole page */}
          <div className="fade-in-up delay-0">
            <PageVibe user={user} entries={entries} />
          </div>

          {/* Pattern alerts — duplicated in insights column on xl+, so hide here */}
          <div className="fade-in-up delay-1 xl:hidden">
            <AlertsBar entries={entries} user={user} />
          </div>

          {/* Today CTA — only if user hasn't logged today */}
          {!todayLogged && (
            <div className="dots rounded-2xl px-4 py-3 border border-[var(--color-accent)]/30 flex items-center gap-3 fade-in-up delay-1">
              <span className="text-xl">🌙</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{fn}, încă n-ai logat azi</div>
                <div className="text-xs text-[var(--color-fg-muted)]">apasă <span className="font-bold text-[var(--color-accent)]">+ log azi</span> în meniul stânga</div>
              </div>
            </div>
          )}

          <div className="fade-in-up delay-2">
            <Hero entries={entries} user={user} />
          </div>

          <div className="fade-in-up delay-2">
            <AINudge user={user} entries={entries} />
          </div>

          <div className="fade-in-up delay-3">
            <Leaderboard entries={entries} currentUser={user} />
          </div>

          {/* These AI cards are in the insights column on xl+ — hide here to avoid dup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 fade-in-up delay-4 xl:hidden">
            <DailyRoast user={user} entries={entries} />
            <WeeklyStory entries={entries} />
          </div>

          <div className="fade-in-up delay-5 xl:hidden">
            <PatternCard user={user} entries={entries} />
          </div>
        </>
      )}
    </div>
  );
}
