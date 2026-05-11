'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { NAMES, FIRST_NAME } from '@/lib/sleep';
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

  const queryU = searchParams.get('u');
  const targetUser = isValidName(queryU) ? queryU : user;

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

  return (
    <div className="max-w-3xl mx-auto space-y-3 lg:space-y-4">
      {loading && <DetailSkeleton />}

      {!loading && (
        <>
          {/* TAB SWITCHER — Individual vs Compare */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTab('me')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                tab === 'me'
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              👤 individual · {FIRST_NAME[targetUser]}
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

            {/* Quick user switcher (only shown on individual tab) */}
            {tab === 'me' && (
              <div className="flex items-center gap-1 ml-auto">
                {NAMES.filter(n => n !== targetUser).map(n => (
                  <button
                    key={n}
                    onClick={() => setTargetUser(n)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border border-[var(--color-border)] hover:border-[var(--color-fg-dim)] transition-colors"
                    title={`Vezi ${FIRST_NAME[n]}`}
                  >
                    <Avi name={n} size="xs" />
                    <span className="hidden sm:inline">{FIRST_NAME[n]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {tab === 'me' && (
            <div className="fade-in-up delay-0">
              <DetailView entries={entries} user={targetUser} onUserChange={setTargetUser} />
            </div>
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
