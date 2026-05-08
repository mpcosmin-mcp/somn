'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { type SleepEntry, NAMES } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { fetchAllEntries } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Avi } from '@/components/ui/avi';
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
    <main className="min-h-screen pb-12">
      <header className="sticky top-0 z-30 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/" className="num font-bold text-lg tracking-tight">somn</Link>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] hidden sm:inline">
            · detalii
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/"><Button size="sm" variant="ghost">← dashboard</Button></Link>
            <Avi name={user} size="sm" />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 space-y-4">
        {loading && (
          <div className="text-center text-[var(--color-fg-muted)] text-sm py-12 num">~$ loading data...</div>
        )}

        {!loading && (
          <>
            <DetailView entries={entries} user={targetUser} onUserChange={setTargetUser} />
            <RemEducation />
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
