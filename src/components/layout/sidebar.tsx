'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FIRST_NAME, personColor } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { calcXP, xpLevel, xpProgress, XP_PER_LEVEL, tierFor, streakFor } from '@/lib/gamify';
import { openChat } from '@/lib/chat-toggle';
import { Avi } from '@/components/ui/avi';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * Left sidebar — brand, profile, nav, prominent Hipnos chat trigger, footer.
 *
 * Chat is the star of the sidebar (the floating bubble was hidden, so we
 * promote it here as a big indigo CTA). Tapping it slides the chat panel
 * in from the LEFT.
 */
export function Sidebar({ onCloseDrawer }: { onCloseDrawer?: () => void }) {
  const { user, setUser } = useUser();
  const { entries } = useEntries();
  const pathname = usePathname();

  if (!user) return null;

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const xp = calcXP(entries, user);
  const lvl = xpLevel(xp);
  const tier = tierFor(lvl);
  const streak = streakFor(entries, user);
  const progress = xpProgress(xp);
  const c = personColor(user);

  const handleChat = () => {
    openChat();
    onCloseDrawer?.();
  };

  return (
    <aside className="flex flex-col h-full px-3 py-4 gap-4 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2 px-1">
        <span className="num text-2xl font-bold tracking-tight">somn</span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium hidden xl:inline">
          sleep · IT · ai
        </span>
      </div>

      {/* Profile card */}
      <div
        className="rounded-2xl p-3 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${c}1a, transparent 60%)`,
          border: `1px solid ${c}30`,
        }}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <Avi name={user} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate" style={{ color: c }}>{fn}</div>
            <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1 flex-wrap mt-0.5">
              <span style={{ color: tier.color }}>{tier.icon}</span>
              <span className="num font-semibold">Lv {lvl}</span>
              <span className="text-[var(--color-fg-dim)]">·</span>
              <span>{tier.name}</span>
              {streak > 0 && (
                <>
                  <span className="text-[var(--color-fg-dim)]">·</span>
                  <span className="num font-bold text-[var(--color-accent)]">{streak}d 🔥</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(progress / XP_PER_LEVEL) * 100}%`,
              background: 'linear-gradient(90deg, var(--color-accent-soft), var(--color-accent))',
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] num text-[var(--color-fg-muted)] mt-1">
          <span>{xp} XP</span>
          <span>{progress}/{XP_PER_LEVEL}</span>
        </div>
      </div>

      {/* Hipnos chat CTA — the star of the sidebar */}
      <button
        onClick={handleChat}
        className="group relative w-full rounded-2xl px-4 py-3.5 text-left overflow-hidden transition-all hover:translate-y-[-1px] active:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(168,85,247,0.14))',
          border: '1px solid rgba(129,140,248,0.35)',
          boxShadow: '0 10px 30px -12px var(--color-accent-glow)',
        }}
      >
        {/* Pulsing ring */}
        <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
        </span>

        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' }}
          >
            💬
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-[var(--color-fg)]">Chat cu Hipnos</div>
            <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">
              zeul somnului · vorbește live
            </div>
          </div>
        </div>
      </button>

      {/* Nav links — single-page app now, only Dashboard */}
      <nav className="flex flex-col gap-1">
        <SidebarLink href="/" icon="📊" label="Dashboard" active={pathname === '/'} onClick={onCloseDrawer} />
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer actions */}
      <div className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-2">
        <button
          onClick={() => { setUser(null); onCloseDrawer?.(); }}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors text-left"
        >
          <span>↩</span>
          <span>Schimbă utilizator</span>
        </button>

        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] text-[var(--color-fg-dim)] num">theme</span>
          <ThemeToggle />
        </div>
        <div className="text-[9px] text-[var(--color-fg-dim)] num px-2 pb-1">
          {entries.length} log{entries.length !== 1 ? 's' : ''} · {new Set(entries.map(e => e.date)).size}d
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      prefetch
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
        active
          ? 'bg-[var(--color-accent)]/12 text-[var(--color-fg)] ring-1 ring-[var(--color-accent)]/30'
          : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
      }`}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
