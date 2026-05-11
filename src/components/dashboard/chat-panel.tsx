'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { Lobster } from '@/components/ui/lobster';

/**
 * Chat surface — different metaphor per breakpoint:
 *
 *   • lg+:  ALWAYS VISIBLE as the right column of the app shell.
 *           No toggle, no slide-in. It's just there.
 *
 *   • <lg:  Hidden by default. Floating lobster button at bottom-right
 *           opens it as a popup card with backdrop blur.
 *
 * Auto-sends a prompt forwarded via the global chat-toggle event.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [openMobile, setOpenMobile] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Listen for global chatSend() / openChat() calls — for mobile popup
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ChatToggleDetail>).detail;
      if (detail?.force === 'open') setOpenMobile(true);
      else if (detail?.force === 'close') setOpenMobile(false);
      else setOpenMobile(o => !o);
      if (detail?.prompt) setPendingPrompt(detail.prompt);
    };
    window.addEventListener(CHAT_EVENT, handler);
    return () => window.removeEventListener(CHAT_EVENT, handler);
  }, []);

  // Esc closes mobile popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && openMobile) setOpenMobile(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMobile]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* ─── DESKTOP: always-on right column ───────────────────── */}
      <aside
        className="hidden lg:flex flex-col h-full bg-[var(--color-bg)] border-l border-[var(--color-border)]"
        aria-label="Chat cu somn AI"
      >
        <ChatWidget
          user={user}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt(null)}
        />
      </aside>

      {/* ─── MOBILE: floating lobster button + popup ──────────── */}
      <button
        onClick={() => setOpenMobile(o => !o)}
        className="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-2xl shadow-black/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label={openMobile ? 'Închide chat' : 'Deschide chat'}
        title="Vorbește cu somn AI"
      >
        {openMobile ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <Lobster size={36} talking />
        )}
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={() => setOpenMobile(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          openMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Mobile popup */}
      <aside
        className={`lg:hidden fixed z-50 flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden rounded-2xl shadow-2xl shadow-black/40
          inset-x-3 bottom-3 max-h-[calc(100dvh-1rem)]
          transform-gpu transition-all duration-200 ease-out origin-bottom-right
          ${openMobile
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
        `}
        aria-hidden={!openMobile}
        role="dialog"
        aria-label="Chat cu somn AI"
      >
        <ChatWidget
          user={user}
          onClose={() => setOpenMobile(false)}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt(null)}
        />
      </aside>
    </>
  );
}
