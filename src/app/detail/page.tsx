'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { NAMES } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { cleanupDuplicates } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DetailView } from '@/components/dashboard/detail-view';
import { RemEducation } from '@/components/dashboard/rem-tips';

function isValidName(n: string | null): n is (typeof NAMES)[number] {
  return !!n && (NAMES as readonly string[]).includes(n);
}

function DetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { entries, loading, refetch } = useEntries();
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const queryU = searchParams.get('u');
  const targetUser = isValidName(queryU) ? queryU : user;

  const setTargetUser = (n: string) => {
    router.replace(`/detail?u=${encodeURIComponent(n)}`);
  };

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
          <div className="fade-in-up delay-0">
            <DetailView entries={entries} user={targetUser} onUserChange={setTargetUser} />
          </div>
          <div className="fade-in-up delay-2">
            <RemEducation />
          </div>

          {/* Admin */}
          <Card className="px-4 py-3 fade-in-up delay-3">
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
                        await refetch();
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
  );
}

export default function DetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailInner />
    </Suspense>
  );
}
