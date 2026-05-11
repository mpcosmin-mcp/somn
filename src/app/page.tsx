'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { todayStr } from '@/lib/utils';
import { FIRST_NAME } from '@/lib/sleep';
import { Hero } from '@/components/dashboard/hero';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { DailyRoast } from '@/components/dashboard/ai-blocks';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { AINudge } from '@/components/dashboard/ai-nudge';
import { PageVibe } from '@/components/dashboard/page-vibe';
import { ChatLogHint } from '@/components/dashboard/chat-log-hint';
import { TopicBanners } from '@/components/dashboard/topic-banners';
import { DashboardSkeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

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
          <div className="fade-in-up delay-0">
            <ChatLogHint />
          </div>

          <div className="fade-in-up delay-0">
            <PageVibe user={user} entries={entries} />
          </div>

          {/* Topic banners — Instagram-story style circles for education */}
          <div className="fade-in-up delay-1">
            <TopicBanners />
          </div>

          {/* Pattern alerts — also in insights column on xl+ */}
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

          {/* Daily roast — visible on <xl (insights column has it on xl+) */}
          <div className="fade-in-up delay-4 xl:hidden">
            <DailyRoast user={user} entries={entries} />
          </div>
        </>
      )}
    </div>
  );
}
