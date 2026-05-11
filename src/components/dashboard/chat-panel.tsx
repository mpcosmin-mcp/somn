'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';
import { Lobster } from '@/components/ui/lobster';

/**
 * Floating chat bubble — a SINGLE metaphor across all viewports (Intercom-style).
 *
 *   Collapsed → 60px lobster bubble pinned to bottom-right, always visible.
 *   Expanded  → 380×600 floating window in the same corner (full-width on
 *                very small phones).
 *
 * Persists open/closed state per user in localStorage. Esc closes. Tap
 * lobster while collapsed → expand. Tap × → collapse.
 *
 * The mascot has a soft pulse animation when AI is mid-reply (handled
 * inside ChatWidget via the `sending` state).
 */

const OPEN_KEY = 'somn_chat_open';

export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [panelHydrated, setPanelHydrated] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Restore last open state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved === '1') setOpen(true);
    } catch { /* ignore */ }
    setPanelHydrated(true);
  }, []);

  // Listen for global chat-toggle events (chatSend, openChat, etc.)
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

  // Persist open state
  useEffect(() => {
    if (!panelHydrated) return;
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open, panelHydrated]);

  // Esc to collapse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Collapsed bubble — always visible, even when expanded the bubble fades */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Deschide chat cu somn ai"
        title="Vorbește cu somn ai"
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-2xl shadow-black/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <Lobster size={40} talking />
        {/* Tiny prompt label that hovers */}
        <span className="absolute right-full mr-2 px-2 py-1 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] num text-[var(--color-fg-muted)] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          chat
        </span>
      </button>

      {/* Expanded floating window */}
      <div
        className={`fixed z-50 flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] overflow-hidden shadow-2xl shadow-black/40
          /* small screens: nearly full-screen popup */
          inset-x-3 bottom-3
          /* desktop+: floating window in bottom-right corner */
          sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[380px] sm:h-[600px]
          max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]
          rounded-2xl
          transform-gpu transition-all duration-200 ease-out origin-bottom-right
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
