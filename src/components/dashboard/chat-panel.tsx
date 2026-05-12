'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';

/**
 * Chat popup — backdrop + slide-in panel. The trigger lives in a
 * separate component (`WanderingBear`) so the bear can wander the
 * page while this component owns only the popup behavior.
 *
 * Open: full-screen on mobile, ~420-460px panel anchored bottom-right
 *       on sm+. Escape / backdrop click / explicit close all close it.
 * Listens to the global CHAT_EVENT so any other component
 * (the WanderingBear, an in-page CTA, etc.) can open it via
 * `openChat()` from lib/chat-toggle.ts.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Backdrop dim */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Chat popup — bottom-right on sm+, full-screen on mobile. */}
      <div
        className={`fixed z-50 flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden shadow-2xl shadow-black/40
          inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:h-[min(720px,calc(100dvh-6rem))] sm:rounded-2xl
          lg:w-[460px]
          transform-gpu transition-all duration-250 ease-out origin-bottom-right
          ${open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Chat cu Sforăilă"
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
