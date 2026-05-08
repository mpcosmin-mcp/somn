import { cn } from '@/lib/utils';

/**
 * Soft pulsing placeholder. Use during loading states instead of plain
 * "se încarcă..." text. Sized via className.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[var(--color-card)] border border-[var(--color-border-subtle)]',
        className,
      )}
      aria-hidden
    />
  );
}

/** Composite skeleton matching the dashboard layout while data loads. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <Skeleton className="h-12" />          {/* alerts row */}
      <Skeleton className="h-48 sm:h-56" />  {/* hero */}
      <Skeleton className="h-16" />          {/* AI nudge */}
      <Skeleton className="h-72 sm:h-80" />  {/* leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-20" />          {/* pattern card */}
    </div>
  );
}

/** Composite skeleton for /detail page. */
export function DetailSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <Skeleton className="h-14" />          {/* user switcher */}
      <Skeleton className="h-32" />          {/* user profile */}
      <Skeleton className="h-10 w-48" />     {/* range tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-72" />          {/* history */}
    </div>
  );
}
