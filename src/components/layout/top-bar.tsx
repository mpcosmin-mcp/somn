'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ProfilePopover } from '@/components/layout/profile-popover';
import { InstallButton } from '@/components/layout/install-button';
import { Modal } from '@/components/ui/modal';
import { ReadingList } from '@/components/dashboard/reading-list';

export function TopBar() {
  const { user } = useUser();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-bg)]/85 backdrop-blur-md border-b border-[var(--color-border)] pt-safe">
      <div className="flex items-center justify-between gap-3 h-14 px-3 sm:px-5 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="num text-xl font-bold tracking-tight transition-colors group-hover:text-[var(--color-accent)]">
            somn
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] font-medium hidden sm:inline">
            sleep · IT · ai
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <InstallButton />
          <LibraryButton />
          <ThemeToggle />
          <ProfilePopover />
        </div>
      </div>
    </header>
  );
}

function LibraryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Bibliotecă"
        className="tap w-9 h-9 rounded-lg grid place-items-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={<span className="text-sm font-bold">Bibliotecă</span>}
      >
        <ReadingList bare />
      </Modal>
    </>
  );
}
