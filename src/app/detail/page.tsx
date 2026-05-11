'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { NAMES, FIRST_NAME, personColor } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { Button } from '@/components/ui/button';
import { Avi } from '@/components/ui/avi';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DetailView } from '@/components/dashboard/detail-view';
import { StackedCompare } from '@/components/dashboard/stacked-compare';

type Tab = 'me' | 'compare';

function isValidName(n: string | null): n is (typeof NAMES)[number] {
  return !!n && (NAMES as readonly string[]).includes(n);
}

function DetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { entries, loading } = useEntries();
  const [tab, setTab] = useState<Tab>('me');

  // URL ?u= lets you view another teammate's detail (from leaderboard clicks).
  // Without it, ALWAYS default to the logged-in user.
  const queryU = searchParams.get('u');
  const requestedUser = isValidName(queryU) ? queryU : null;
  const targetUser = requestedUser ?? user;
  const isViewingTeammate = !!requestedUser && requestedUser !== user;

  const goBackToMyself = () => router.replace('/detail');
  const setTargetUser = (n: string) => router.replace(`/detail?u=${encodeURIComponent(n)}`);

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--color-fg-muted)] mb-4">trebuie să-ți alegi profilul mai întâi</div>
        <Link href="/"><Button variant="primary">înapoi la login</Button></Link>
      </div>
    );
  }
  if (!targetUser) return null;

  const targetC = personColor(targetUser);

  return (
    <div className="max-w-3xl mx-auto space-y-3 lg:space-y-4">
      {loading && <DetailSkeleton />}

      {!loading && (
        <>
          {/* TAB SWITCHER */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTab('me')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                tab === 'me'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              👤 individual
            </button>
            <button
              onClick={() => setTab('compare')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                tab === 'compare'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              👥 comparare echipă
            </button>
          </div>

          {tab === 'me' && (
            <>
              {/* Big banner showing whose data is on screen */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${targetC}1a, transparent 60%)`,
                  border: `1px solid ${targetC}30`,
                }}
              >
                <Avi name={targetUser} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="label">vezi datele lui</div>
                  <div className="font-bold text-base flex items-center gap-2" style={{ color: targetC }}>
                    {FIRST_NAME[targetUser]}
                    {!isViewingTeammate && (
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-accent)] font-bold">tu</span>
                    )}
                  </div>
                </div>
                {isViewingTeammate && (
                  <button
                    onClick={goBackToMyself}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors shrink-0"
                  >
                    ← al meu
                  </button>
                )}
              </div>

              <div className="fade-in-up delay-0">
                <DetailView entries={entries} user={targetUser} onUserChange={setTargetUser} />
              </div>
            </>
          )}

          {tab === 'compare' && (
            <div className="fade-in-up delay-0">
              <StackedCompare entries={entries} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailInner />
    </Suspense>
  );
}
