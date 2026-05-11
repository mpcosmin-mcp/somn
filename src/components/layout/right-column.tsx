'use client';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { AlertsBar } from '@/components/dashboard/alerts-bar';
import { DailyRoast } from '@/components/dashboard/ai-blocks';

/**
 * Twitter-style right column. Visible on xl+ (≥1280px).
 *
 * Layout (top → bottom, sticky, full viewport height):
 *   • ChatWidget (Hipnos) — embedded, always visible, takes flex-1 space
 *   • AI insights footer  — alerts + daily roast, compact, scrolls if needed
 *
 * Feed in the middle column STAYS centered + stable. Chat is part of
 * the layout, not an overlay — no scale/dim of the feed when typing.
 */
export function RightColumn() {
  const { user } = useUser();
  const { entries } = useEntries();

  if (!user) return null;

  return (
    <aside
      className="hidden xl:flex flex-col w-[360px] 2xl:w-[400px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]/30 h-dvh sticky top-0"
      aria-label="AI chat + insights"
    >
      {/* Chat takes most of the column */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatWidget user={user} />
      </div>

      {/* AI insights footer — compact, capped height, own scroll */}
      <div className="border-t border-[var(--color-border)] p-3 space-y-2 max-h-[40vh] overflow-y-auto bg-[var(--color-bg)]">
        <div className="label">ai insights</div>
        <AlertsBar entries={entries} user={user} />
        <DailyRoast user={user} entries={entries} />
      </div>
    </aside>
  );
}
