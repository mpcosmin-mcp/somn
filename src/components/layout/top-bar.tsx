'use client';
import Link from 'next/link';
import { PanelLeft } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useRail } from '@/lib/rail';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ProfilePopover } from '@/components/layout/profile-popover';
import { InstallButton } from '@/components/layout/install-button';
import { IdeasMenu } from '@/components/layout/ideas-menu';

export function TopBar() {
  const { user } = useUser();
  const { collapsed, toggle } = useRail();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/85 backdrop-blur-md border-b border-[var(--color-border)] pt-safe">
      <div className="flex items-center justify-between gap-3 h-14 px-3 sm:px-5 w-full">
        <div className="flex items-center gap-2">
          {/* Menu toggle — opens the left rail (Aria activity calendar) */}
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Deschide meniul Aria' : 'Închide meniul'}
            aria-expanded={!collapsed}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            title="Orarul de antrenamente Aria"
          >
            <PanelLeft size={17} className={`transition-transform duration-300 ${collapsed ? '' : 'text-[var(--color-accent)]'}`} />
            <span className="text-[11px] font-bold hidden sm:inline">🏃 Aria</span>
          </button>

          <Link href="/" className="flex items-baseline gap-2 group">
            <span className="num text-xl font-bold tracking-tight transition-colors group-hover:text-[var(--color-accent)]">
              somn
            </span>
            <span className="text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] font-medium hidden sm:inline">
              sleep · IT · team
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <IdeasMenu />
          <InstallButton />
          <ThemeToggle />
          <ProfilePopover />
        </div>
      </div>
    </header>
  );
}
