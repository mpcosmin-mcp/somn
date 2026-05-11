'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { Lobster } from '@/components/ui/lobster';

const OPEN_KEY = 'somn_chat_open';

/**
 * Chat surface — FOCUS MODE design.
 *
 *   • Closed:
 *       <xl  → floating capybara bubble bottom-right (only place to open)
 *       xl+  → bubble is HIDDEN; chat is opened from the "vorbește cu mine"
 *               card at the top of the AI insights column instead
 *
 *   • Open:
 *       <xl  → full-screen-ish popup (current behavior)
 *       xl+  → a LARGE focus panel (560px wide, full height with margin) on
 *               the right. The rest of the page shrinks + dims via the CSS
 *               class on <body data-chat-open="true"> so the chat becomes
 *               the main focus.
 *
 *   • Close: page returns to normal layout instantly.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [panelHydrated, setPanelHydrated] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved === '1') setOpen(true);
    } catch { /* ignore */ }
    setPanelHydrated(true);
  }, []);

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

  useEffect(() => {
    if (!panelHydrated) return;
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
    // Set body attribute so global CSS can shrink + dim the page when open
    document.body.dataset.chatOpen = open ? 'true' : 'false';
    return () => { document.body.dataset.chatOpen = 'false'; };
  }, [open, panelHydrated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Collapsed bubble — only on <xl (mobile/tablet). Hidden on xl+ since
          the insights column has the chat trigger. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Deschide chat cu somn ai"
        title="Vorbește cu somn ai"
        className={`xl:hidden fixed bottom-4 right-4 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-2xl shadow-black/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <Lobster size={40} talking />
      </button>

      {/* Backdrop on <xl (mobile dimming) */}
      <div
        onClick={() => setOpen(false)}
        className={`xl:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Chat surface — popup on <xl, focus panel on xl+ */}
      <div
        className={`fixed z-50 flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden shadow-2xl shadow-black/40 rounded-2xl
          /* mobile/tablet: bottom popup */
          inset-x-3 bottom-3 max-h-[calc(100dvh-1rem)]
          /* desktop xl+: focus panel — right side, taller, wider */
          xl:inset-auto xl:top-4 xl:right-4 xl:bottom-4
          xl:w-[520px] 2xl:w-[600px]
          xl:max-h-none
          transform-gpu transition-all duration-250 ease-out origin-bottom-right xl:origin-right
          ${open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
        `}
        aria-hidden={!open}
        role="dialog"
        aria-label="Chat cu somn ai"
      >
        <ChatWidget
          user={user}
          onClose={() => setOpen(false)}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt(null)}
        />
      </div>
    </>
  );
}
