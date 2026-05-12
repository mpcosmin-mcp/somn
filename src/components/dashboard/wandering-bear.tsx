'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail, openChat } from '@/lib/chat-toggle';
import { Lobster } from '@/components/ui/lobster';

/**
 * Sforăilă — static chat trigger pinned to the top-left of the page,
 * just below the topbar. Clicking him opens the chat popup.
 *
 *   (File still named `wandering-bear.tsx` from the earlier wandering
 *   experiment; the strolling animation was removed by request — he
 *   now stays put. Pulse ring + live dot stay so he still signals
 *   "alive, click me".)
 *
 *   Hides (opacity 0) while the chat is open, via CHAT_EVENT.
 */
export function WanderingBear() {
  const { user, hydrated } = useUser();
  const [chatOpen, setChatOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);

  // Mirror the chat panel's open state so we can hide while it's up.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ChatToggleDetail>).detail;
      if (detail?.force === 'open') setChatOpen(true);
      else if (detail?.force === 'close') setChatOpen(false);
      else setChatOpen(o => !o);
    };
    window.addEventListener(CHAT_EVENT, handler);
    return () => window.removeEventListener(CHAT_EVENT, handler);
  }, []);

  if (!hydrated || !user) return null;

  return (
    <div
      className={`fixed top-[70px] left-4 z-40 transition-opacity duration-200 ${
        chatOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <button
        onClick={() => openChat()}
        aria-label="Vorbește cu Sforăilă"
        className="relative w-14 h-14 rounded-full border-2 shadow-2xl shadow-black/50 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))',
          borderColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <Lobster size={36} talking />
        {/* Outer pulse ring — signals "alive, click me" */}
        <span
          className="absolute inset-0 rounded-full border-2 animate-ping opacity-40 pointer-events-none"
          style={{ borderColor: 'var(--color-accent)' }}
          aria-hidden
        />
        {/* Live dot on top-right */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)] ring-2 ring-[var(--color-bg)]" />
        </span>
      </button>

      {/* Hover tooltip — to the RIGHT of the bear (top-left position) */}
      <div
        className={`absolute top-1/2 left-full -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-2xl shadow-black/40 pointer-events-none transition-all duration-150 ${
          showTip ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
        }`}
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(129, 140, 248, 0.30)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        role="tooltip"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <span className="text-[var(--color-fg)]">Sforăilă · vorbește live</span>
        </div>
      </div>
    </div>
  );
}
