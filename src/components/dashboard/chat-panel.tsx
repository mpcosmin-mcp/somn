'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { Lobster } from '@/components/ui/lobster';

/**
 * Hipnos floating chat bubble — bottom-right.
 *
 *   Collapsed:
 *     [Hipnos · vorbește live] (🦞)
 *      └ always-visible label    └ pulsing lobster bubble
 *
 *   The label is the fix for the previous "nobody saw the bubble" issue:
 *   it's permanently visible (sm+), not just on hover. The user can't miss
 *   the live dot pulsing right next to the lobster.
 *
 *   Open: popup expands from bottom-right (full-screen on mobile,
 *         ~420-460px panel on sm+). Backdrop dim closes on click.
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
      {/* Collapsed: label pill + lobster bubble. Always visible. */}
      <div
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 transition-all duration-200 ${
          open ? 'opacity-0 pointer-events-none translate-y-2 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        {/* Visible label pill (hidden on tiny screens to save space) */}
        <button
          onClick={() => setOpen(true)}
          aria-hidden
          tabIndex={-1}
          className="hidden sm:flex items-center gap-2 h-12 pl-3.5 pr-3 rounded-full border shadow-2xl shadow-black/40 transition-all hover:-translate-x-0.5"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.12))',
            borderColor: 'rgba(129,140,248,0.35)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <span className="relative flex h-2 w-2 mr-0.5" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]" />
          </span>
          <span className="text-xs font-bold text-[var(--color-fg)]">Hipnos</span>
          <span className="text-[10px] text-[var(--color-fg-muted)] hidden md:inline">vorbește live</span>
        </button>

        {/* Lobster bubble — the actual trigger */}
        <button
          onClick={() => setOpen(true)}
          aria-label="Deschide chat cu Hipnos"
          className="relative w-14 h-14 rounded-full border-2 shadow-2xl shadow-black/50 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))',
            borderColor: 'rgba(255,255,255,0.20)',
          }}
        >
          <Lobster size={36} talking />
          {/* Outer pulse ring */}
          <span
            className="absolute inset-0 rounded-full border-2 animate-ping opacity-40 pointer-events-none"
            style={{ borderColor: 'var(--color-accent)' }}
          />
          {/* Mobile-only mini live dot since the pill label is hidden */}
          <span className="sm:hidden absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)] ring-2 ring-[var(--color-bg)]" />
          </span>
        </button>
      </div>

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
