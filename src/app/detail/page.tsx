'use client';
import Link from 'next/link';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { Button } from '@/components/ui/button';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { TeamHistory } from '@/components/dashboard/team-history';

/**
 * /detail → Istoric echipă.
 *
 *   Single view: TeamHistory (leaderboard + stacked chart + per-user breakdown).
 *   No tabs — main dashboard has the personal deep-dive already.
 */
export default function DetailPage() {
  const { user } = useUser();
  const { entries, loading } = useEntries();

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--color-fg-muted)] mb-4">trebuie să-ți alegi profilul mai întâi</div>
        <Link href="/"><Button variant="primary">înapoi la login</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3 lg:space-y-4">
      {loading && <DetailSkeleton />}

      {!loading && (
        <>
          {/* Header */}
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <div className="label">istoric</div>
              <div className="text-xl font-bold">Echipa</div>
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)] num">
              {entries.length} logs · {new Set(entries.map(e => e.date)).size} zile
            </div>
          </div>

          <div className="fade-in-up delay-0">
            <TeamHistory entries={entries} currentUser={user} />
          </div>
        </>
      )}
    </div>
  );
}
