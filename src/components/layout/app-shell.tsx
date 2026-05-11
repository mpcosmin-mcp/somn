'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useUser } from '@/lib/user';
import { Avi } from '@/components/ui/avi';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatPanel } from '@/components/dashboard/chat-panel';
import { UserPicker } from '@/components/dashboard/user-picker';

/**
 * Twitter-style 3-column shell:
 *
 *   ┌──────────┬─────────────────────┬──────────┐
 *   │ Sidebar  │  Main content       │  Chat    │
 *   │ 240px    │  flex-1             │  340px   │
 *   └──────────┴─────────────────────┴──────────┘
 *
 * lg+ : all 3 columns visible at once. Chat is always-on, no toggle.
 * <lg : main content takes full width. Sidebar lives in a drawer (☰
 *       button top-left). Chat is a floating lobster (bottom-right) →
 *       popup. (ChatPanel renders its own mobile pieces; the desktop
 *       aside is hidden under lg breakpoint.)
 *
 * If no user is picked yet, renders the <UserPicker> instead.
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
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:flex-row">
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
      <div className="hidden lg:flex w-[240px] xl:w-[260px] shrink-0 border-r border-[var(--color-border)]">
        <Sidebar />
      </div>

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

      {/* ─── MAIN CONTENT (middle column) ──────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-5 pb-24 lg:pb-5 pb-safe">
        {children}
      </main>

      {/* ─── CHAT (right column on lg+, floating popup on <lg) ── */}
      <div className="contents lg:flex lg:w-[340px] xl:w-[360px] lg:shrink-0">
        <ChatPanel />
      </div>
    </div>
  );
}
