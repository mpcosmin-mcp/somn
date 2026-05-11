'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { Lobster } from '@/components/ui/lobster';

const OPEN_KEY = 'somn_chat_open';

/**
 * Hipnos chat — floating bubble across ALL viewports.
 *
 *   Collapsed: pulsing capybara bubble bottom-right. Hover shows a
 *              tooltip 'Hipnos · live · vorbește cu mine'.
 *   Open:      floating focus panel — mobile: bottom popup; desktop:
 *              520-600px on the right with focus-mode dimming the page.
 *
 * Trigger from anywhere via chatSend() / openChat() events.
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
  }, [open, panelHydrated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Collapsed bubble — <xl only. xl+ has chat in the right column. */}
      <div
        className={`xl:hidden group fixed bottom-4 right-4 z-50 transition-all duration-200 ${
          open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
        }`}
      >
        {/* Hover tooltip — "live · vorbește cu mine" */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] shadow-xl whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 pointer-events-none">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span>Hipnos · <span className="text-[var(--color-accent)]">live</span></span>
          </div>
          <div className="text-[10px] text-[var(--color-fg-muted)]">vorbește cu mine</div>
        </div>

        <button
          onClick={() => setOpen(true)}
          aria-label="Deschide chat cu Hipnos"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)]/40 shadow-2xl shadow-black/40 hover:border-[var(--color-accent)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative"
        >
          <Lobster size={40} talking />
          {/* Pulse ring to signal it's alive */}
          <span className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]/40 animate-ping opacity-50" />
        </button>
      </div>

      {/* Backdrop + popup — <xl only */}
      <div
        onClick={() => setOpen(false)}
        className={`xl:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      <div
        className={`xl:hidden fixed z-50 flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden shadow-2xl shadow-black/40 rounded-2xl
          inset-x-3 bottom-3 max-h-[calc(100dvh-1rem)]
          transform-gpu transition-all duration-250 ease-out origin-bottom-right
          ${open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
        `}
        aria-hidden={!open}
        role="dialog"
        aria-label="Chat cu Hipnos"
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
