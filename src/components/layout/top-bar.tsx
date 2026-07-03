'use client';
import Link from 'next/link';
import { useUser } from '@/lib/user';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ProfilePopover } from '@/components/layout/profile-popover';
import { InstallButton } from '@/components/layout/install-button';

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
          <Link
            href="/ideas"
            className="text-[10px] font-bold px-2 py-1 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            title="Idei de îmbunătățire"
          >
            💡 idei
          </Link>
          <InstallButton />
          <ThemeToggle />
          <ProfilePopover />
        </div>
      </div>
    </header>
  );
}
