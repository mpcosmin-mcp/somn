'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';

const OPEN_KEY = 'somn_chat_panel_open';

/**
 * Chat surface — different layout per breakpoint:
 *
 *  • <lg (mobile/tablet):  floating popup card pinned to the bottom of the
 *      viewport with margin, big shadow, rounded corners. Animates in with
 *      a scale + fade from the bottom origin. Backdrop dims the page.
 *
 *  • lg+ (desktop):        docks to the right edge full-height, no margin,
 *      no rounded corners on the page side, slides in horizontally. Body
 *      content shifts left when open (CSS in globals.css via
 *      body[data-chat-panel="open"]).
 *
 * Always toggleable from anywhere via toggleChat() (custom event).
 * If the event carries `prompt`, ChatWidget auto-sends it once.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [panelHydrated, setPanelHydrated] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Restore last open state on mount (desktop preference: keep open)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved === '1') setOpen(true);
    } catch { /* ignore */ }
    setPanelHydrated(true);
  }, []);

  // Listen for global toggle events
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ChatToggleDetail>).detail;
      if (detail?.force === 'open') setOpen(true);
      else if (detail?.force === 'close') setOpen(false);
      else setOpen(o => !o);
      if (detail?.prompt) setPendingPrompt(detail.prompt);
    };
    window.addEventListener(CHAT_EVENT, handler);
    return () => window.removeEventListener(CHAT_EVENT, handler);
  }, []);

  // Persist + apply body data attribute (powers the desktop content shift)
  useEffect(() => {
    if (!panelHydrated) return;
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
    document.body.dataset.chatPanel = open ? 'open' : 'closed';
    return () => { document.body.dataset.chatPanel = 'closed'; };
  }, [open, panelHydrated]);

  // Esc closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Backdrop — visible on mobile/tablet only when open. Tap = close. */}
      <div
        onClick={() => setOpen(false)}
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]
          lg:hidden transition-opacity duration-200
          ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        aria-hidden
      />

      {/* Chat surface — popup on mobile, docked panel on desktop. */}
      <aside
        className={`
          fixed z-50 flex flex-col
          bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden

          /* MOBILE / TABLET: floating popup card */
          inset-x-3 bottom-3
          max-h-[calc(100dvh-1rem)]
          rounded-2xl shadow-2xl shadow-black/40

          /* DESKTOP: docks to the right edge full-height */
          lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0
          lg:w-[360px] lg:max-h-none
          lg:rounded-none lg:shadow-none lg:border-y-0 lg:border-r-0

          /* TRANSITIONS */
          transform-gpu transition-all duration-200 ease-out
          origin-bottom-right lg:origin-right

          /* STATES — scale on mobile, slide on desktop */
          ${open
            ? 'opacity-100 scale-100 translate-y-0 lg:translate-x-0'
            : 'opacity-0 scale-95 translate-y-4 lg:opacity-100 lg:scale-100 lg:translate-y-0 lg:translate-x-full pointer-events-none'}
        `}
        aria-hidden={!open}
        role="dialog"
        aria-label="Chat cu Claude"
      >
        <ChatWidget
          user={user}
          onClose={() => setOpen(false)}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt(null)}
        />
      </aside>
    </>
  );
}
