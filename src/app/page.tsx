'use client';
import Link from 'next/link';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { KpiCards } from '@/components/dashboard/kpi-cards';
import { SquadBar } from '@/components/dashboard/squad-bar';
import { PersonalHistory } from '@/components/dashboard/personal-history';
import { SquadInsights } from '@/components/dashboard/squad-insights';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Main dashboard — SleepSquad masterpiece edition.
 *
 *   No scroll on desktop. Everything fits in one viewport.
 *
 *   Layout (lg+):
 *     Row 1 — 3 KPI cards (my Sleep Score, REM, HRV)
 *     Row 2 — Squad Bar (3-up comparison) · current user highlighted
 *     Row 3 — 2 cols: Personal History (left) · Squad Insights + AI (right)
 *
 *   Mobile: stacks naturally, scrolls within main area.
 */
export default function Home() {
  const { user } = useUser();
  const { entries, loading, error, refetch } = useEntries();

  if (!user) return null;

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="px-4 py-3 rounded-xl bg-[var(--color-bad)]/10 border border-[var(--color-bad)]/30 text-[var(--color-bad)] text-sm">
        {error} <button onClick={refetch} className="underline">retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4 lg:h-full">
      {/* Row 1: KPI cards — personal data, the headline */}
      <div className="fade-in-up delay-0 lg:shrink-0">
        <KpiCards entries={entries} user={user} />
      </div>

      {/* Row 2: Squad competition */}
      <div className="fade-in-up delay-1 lg:shrink-0">
        <SquadBar entries={entries} currentUser={user} />
      </div>

      {/* Row 3: 2 cols — personal history left, squad insights right.
         The history scrolls *inside* its own card on lg+, the page itself stays static. */}
      <div className="fade-in-up delay-2 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 lg:flex-1 lg:min-h-0">
        <PersonalHistory entries={entries} user={user} limit={6} />
        <SquadInsights entries={entries} user={user} />
      </div>

      {/* Footer: tiny link to full team istoric */}
      <div className="fade-in-up delay-3 lg:shrink-0 text-center pt-1 pb-2">
        <Link
          href="/detail"
          className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors uppercase tracking-wider font-semibold"
        >
          <span>vezi istoric echipă completă</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
