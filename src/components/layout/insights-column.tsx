'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { openChat } from '@/lib/chat-toggle';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { DailyRoast } from '@/components/dashboard/ai-blocks';
import { PatternPopup } from '@/components/dashboard/pattern-popup';
import { Lobster } from '@/components/ui/lobster';

/**
 * Portrait-shaped AI insights column. xl+ only.
 *
 * NEW layout (this revision):
 *   1. CHAT BUTTON at the very top — opens the focus-mode chat
 *   2. AlertsBar (chip-style auto-detected warnings)
 *   3. DailyRoast (today's AI commentary)
 *   4. Pattern finder POPUP button (small AI icon → modal with insights)
 *
 * WeeklyStory removed entirely.
 */
export function InsightsColumn() {
  const { user } = useUser();
  const { entries } = useEntries();

  if (!user || entries.length === 0) return null;

  return (
    <aside
      className="hidden xl:flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)]/30 px-3 py-4 gap-3"
      aria-label="AI insights"
    >
      {/* CHAT — main focus, at the top */}
      <button
        onClick={() => openChat()}
        className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-[var(--color-card)] border border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/60 transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle at 0% 100%, rgba(239, 68, 68, 0.18), transparent 60%)' }}
        />
        <div className="relative w-12 h-12 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center shrink-0">
          <Lobster size={36} talking />
        </div>
        <div className="relative flex-1 min-w-0 text-left">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] font-semibold mb-0.5">
            somn ai
          </div>
          <div className="text-sm font-bold leading-tight">vorbește cu mine</div>
          <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">poate să logheze direct</div>
        </div>
      </button>

      <div className="label mt-1">ai insights</div>

      {/* Pattern alerts — chips */}
      <AlertsBar entries={entries} user={user} />

      {/* Daily roast */}
      <DailyRoast user={user} entries={entries} />

      {/* Pattern finder — popup button */}
      <PatternPopup />
    </aside>
  );
}
