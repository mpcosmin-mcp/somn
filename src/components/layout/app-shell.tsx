'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useUser } from '@/lib/user';
import { Avi } from '@/components/ui/avi';
import { Sidebar } from '@/components/layout/sidebar';
import { InsightsColumn } from '@/components/layout/insights-column';
import { ChatPanel } from '@/components/dashboard/chat-panel';
import { UserPicker } from '@/components/dashboard/user-picker';

/**
 * App shell layout.
 *
 *   • Page content (sidebar + insights + main) lives in the
 *     [data-page-content] wrapper which globals.css shrinks + dims
 *     when chat is open (focus mode on xl+).
 *   • ChatPanel is rendered as a SIBLING — outside the transformed
 *     wrapper — so its `position: fixed` is anchored to the viewport,
 *     not the (potentially scaled) parent.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, hydrated, setUser } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">
        se încarcă...
      </div>
    );
  }

  if (!user) {
    return <UserPicker onPick={setUser} />;
  }

  return (
    <>
      {/* Page content — gets scaled + dimmed when chat is open (focus mode) */}
      <div className="min-h-dvh lg:h-dvh flex flex-col lg:flex-row" data-page-content>
        {/* ─── MOBILE TOP BAR ────────────────────────────────────── */}
        <header className="lg:hidden sticky top-0 z-30 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] pt-safe">
          <div className="flex items-center gap-2 h-14 px-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="tap rounded-lg flex items-center justify-center text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
              aria-label="Deschide meniul"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="num font-bold text-lg tracking-tight">somn</Link>
            <div className="ml-auto flex items-center gap-1">
              <Avi name={user} size="sm" />
            </div>
          </div>
        </header>

        {/* ─── DESKTOP SIDEBAR (left column) ─────────────────────── */}
        <div className="hidden lg:flex w-[230px] xl:w-[240px] shrink-0 border-r border-[var(--color-border)]">
          <Sidebar />
        </div>

        {/* ─── INSIGHTS COLUMN (xl+ only) ────────────────────────── */}
        <InsightsColumn />

        {/* ─── MOBILE SIDEBAR DRAWER ─────────────────────────────── */}
        <div
          onClick={() => setDrawerOpen(false)}
          className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden
        />
        <aside
          className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[85vw] bg-[var(--color-bg)] border-r border-[var(--color-border)] transform-gpu transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar onCloseDrawer={() => setDrawerOpen(false)} />
        </aside>

        {/* ─── MAIN CONTENT ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 pb-24 lg:pb-6 pb-safe">
          {children}
        </main>
      </div>

      {/* Chat panel — OUTSIDE the transformed wrapper so position:fixed
          stays anchored to the viewport */}
      <ChatPanel />
    </>
  );
}
