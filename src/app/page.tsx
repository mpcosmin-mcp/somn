'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { FIRST_NAME } from '@/lib/sleep';
import { Hero } from '@/components/dashboard/hero';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { AINudge } from '@/components/dashboard/ai-nudge';
import { PageVibe } from '@/components/dashboard/page-vibe';
import { ChatLogHint } from '@/components/dashboard/chat-log-hint';
import { BubbleRow } from '@/components/dashboard/bubble-row';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

  if (!user) return null;

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

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
          {/* Bubble row: Hipnos + Pattern + Topics — top of dashboard, social-app vibe */}
          <div className="fade-in-up delay-0">
            <BubbleRow />
          </div>

          {/* Optional one-time chat-log hint */}
          <div className="fade-in-up delay-0">
            <ChatLogHint />
          </div>

          {/* AI greeting */}
          <div className="fade-in-up delay-1">
            <PageVibe user={user} entries={entries} />
          </div>

          {/* Pattern alerts (warnings) */}
          <div className="fade-in-up delay-1">
            <AlertsBar entries={entries} user={user} />
          </div>

          {/* My hero — last night SS + REM/RHR/HRV */}
          <div className="fade-in-up delay-2">
            <Hero entries={entries} user={user} />
          </div>

          {/* AI nudge — Hipnos suggestion */}
          <div className="fade-in-up delay-2">
            <AINudge user={user} entries={entries} />
          </div>

          {/* Team leaderboard — back on the dashboard, properly displayed */}
          <div className="fade-in-up delay-3">
            <Leaderboard entries={entries} currentUser={user} />
          </div>

          {/* Quiet link to detailed team history */}
          <div className="fade-in-up delay-4 text-center pt-2">
            <Link
              href="/detail#istoric"
              className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <span>👥 deep dive în istoric echipă — {fn}</span>
              <span>→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
