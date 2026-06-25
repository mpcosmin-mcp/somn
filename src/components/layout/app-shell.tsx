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
 * Login screen: UserPicker takes the whole viewport (no TopBar).
 * Auth is intentionally session-only — closing the tab clears the
 * picked user, so the next open lands back on the login page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, hydrated, setUser } = useUser();
  const { refetch } = useEntries();

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
          refetch();
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" data-page-content>
      {/* Ambient indigo depth — fixed, behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(72% 44% at 50% -8%, rgba(99,102,241,0.13), transparent 70%), radial-gradient(42% 36% at 88% 3%, rgba(129,140,248,0.07), transparent 65%)',
        }}
      />
      <TopBar />
      <main className="flex-1 min-w-0 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 pb-safe">
        {children}
      </main>
    </div>
  );
}
