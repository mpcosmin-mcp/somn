'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type SleepEntry, NAMES } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { fetchAllEntries, cleanupDuplicates } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avi } from '@/components/ui/avi';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { toggleChat } from '@/lib/chat-toggle';
import { DetailView } from '@/components/dashboard/detail-view';
import { RemEducation } from '@/components/dashboard/rem-tips';

function isValidName(n: string | null): n is (typeof NAMES)[number] {
  return !!n && (NAMES as readonly string[]).includes(n);
}

function DetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hydrated } = useUser();
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  // Resolve target user from query param, falling back to logged-in user
  const queryU = searchParams.get('u');
  const targetUser = isValidName(queryU) ? queryU : user;

  const setTargetUser = (n: string) => {
    router.replace(`/detail?u=${encodeURIComponent(n)}`);
  };

  const load = useCallback(async () => {
    try {
      const e = await fetchAllEntries();
      setEntries(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">se încarcă...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[var(--color-fg-muted)] mb-4">trebuie să-ți alegi profilul mai întâi</div>
          <Link href="/"><Button variant="primary">înapoi la login</Button></Link>
        </div>
      </div>
    );
  }

  if (!targetUser) {
    return null;
  }

  return (
    <main className="min-h-screen pb-12 pb-safe">
      <header className="sticky top-0 z-30 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)] pt-safe">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 h-14 flex items-center gap-1.5 sm:gap-2">
          <Link href="/" className="num font-bold text-lg tracking-tight shrink-0">somn</Link>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] hidden md:inline">
            · detalii
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <Link href="/"><Button size="sm" variant="ghost">← dashboard</Button></Link>
            <button
              onClick={toggleChat}
              aria-label="Toggle chat"
              title="Chat"
              className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <ThemeToggle />
            <Avi name={user} size="sm" />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 space-y-4">
        {loading && <DetailSkeleton />}

        {!loading && (
          <>
            <DetailView entries={entries} user={targetUser} onUserChange={setTargetUser} />
            <RemEducation />

            {/* Admin: cleanup duplicates from Sheet */}
            <Card className="px-4 py-3">
              <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
                <div className="flex-1 min-w-0">
                  <div className="label">admin</div>
                  <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    curăță rândurile duplicate din Sheet (același date+nume).
                  </div>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  {cleanupStatus && (
                    <span className="text-[10px] num text-[var(--color-fg-muted)] flex-1 sm:flex-none">{cleanupStatus}</span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={cleaning}
                    className="ml-auto"
                    onClick={async () => {
                      setCleaning(true);
                      setCleanupStatus(null);
                      try {
                        const res = await cleanupDuplicates();
                        if (res.ok) {
                          setCleanupStatus(`gata · ${res.removed} șterse`);
                          await load();
                        } else {
                          setCleanupStatus('eroare');
                        }
                      } finally {
                        setCleaning(false);
                      }
                    }}
                  >
                    {cleaning ? 'curăț...' : 'curăță duplicate'}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">se încarcă...</div>}>
      <DetailInner />
    </Suspense>
  );
}
