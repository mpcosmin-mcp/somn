'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelLeft } from 'lucide-react';
import { useUser } from '@/lib/user';
import { useRail } from '@/lib/rail';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ProfilePopover } from '@/components/layout/profile-popover';
import { InstallButton } from '@/components/layout/install-button';

interface Idea { status: 'new' | 'wip' | 'done' | 'rejected'; }

function useNewIdeasCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/ideas', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json() as { ideas?: Idea[] };
        if (!alive) return;
        setCount((json.ideas ?? []).filter(i => i.status === 'new').length);
      } catch { /* KV unavailable in local dev — silent */ }
    };
    load();
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return count;
}

export function TopBar() {
  const { user } = useUser();
  const { collapsed, toggle } = useRail();
  const newIdeas = useNewIdeasCount();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/85 backdrop-blur-md border-b border-[var(--color-border)] pt-safe">
      <div className="flex items-center justify-between gap-3 h-14 px-3 sm:px-5 w-full">
        <div className="flex items-center gap-2">
          {/* Menu toggle — opens the left rail (Aria schedule + ideas) */}
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Deschide meniul' : 'Închide meniul'}
            aria-expanded={!collapsed}
            className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            title="Orarul Aria și ideile echipei"
          >
            <PanelLeft size={17} className={`transition-transform duration-300 ${collapsed ? '' : 'text-[var(--color-accent)]'}`} />
            <span className="text-[11px] font-bold hidden sm:inline">Meniu</span>
            {newIdeas > 0 && (
              <span
                className="num text-[8px] font-bold rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center leading-none absolute -top-0.5 -right-0.5"
                style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
                title={`${newIdeas} idei noi`}
              >
                {newIdeas}
              </span>
            )}
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
          <InstallButton />
          <ThemeToggle />
          <ProfilePopover />
        </div>
      </div>
    </header>
  );
}
