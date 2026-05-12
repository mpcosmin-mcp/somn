'use client';
import { type ReactNode } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { TopBar } from '@/components/layout/top-bar';
import { UserPicker } from '@/components/dashboard/user-picker';

/**
 * App shell — full-width single page.
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │ TopBar (brand · theme · profile chip → popover)     │  sticky
 *   ├─────────────────────────────────────────────────────┤
 *   │                                                     │
 *   │  Main content (scrolls naturally)                   │
 *   │                                                     │
 *   └─────────────────────────────────────────────────────┘
 *
 * Sforăilă is no longer interactive — his presence is now ambient
 * (insights cards on the dashboard). The chat / wandering trigger
 * have been retired.
 *
 * Login screen: UserPicker takes the whole viewport (no TopBar).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, hydrated, setUser } = useUser();
  const { upsertLocal, refetch } = useEntries();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">
        se încarcă...
      </div>
    );
  }

  if (!user) {
    return (
      <UserPicker
        onPick={(n) => {
          setUser(n);
          refetch().catch(() => {});
          void upsertLocal;
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" data-page-content>
      <TopBar />
      <main className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 pb-safe">
        {children}
      </main>
    </div>
  );
}
