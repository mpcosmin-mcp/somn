'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail, openChat } from '@/lib/chat-toggle';
import { Lobster } from '@/components/ui/lobster';

/**
 * Sforăilă, ursul morocănos — animated chat trigger that wanders
 * left↔right just below the top bar.
 *
 *   Default position: top-left, 70px from the top (clear of the 56px
 *   topbar). Animation slowly walks him across the page in a 60s loop,
 *   flipping direction at each edge. A tiny bob + rotation gives him
 *   that lumbering "morocănos" gait.
 *
 *   Hover/focus pauses the animation so he's reliably catchable. Click
 *   fires the global openChat event — the ChatPanel popup handles
 *   the rest (still anchored bottom-right).
 *
 *   He hides while the chat is open (no peek-through behind the
 *   backdrop) and reappears when the chat closes.
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
      className={`wandering-bear fixed top-[70px] left-4 z-40 transition-opacity duration-200 ${
        chatOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className="wandering-bear-inner">
        <button
          onClick={() => openChat()}
          aria-label="Vorbește cu Sforăilă"
          className="relative w-14 h-14 rounded-full border-2 shadow-2xl shadow-black/50 hover:scale-110 active:scale-95 transition-[transform] flex items-center justify-center"
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

        {/* Hover tooltip — appears below the bear, doesn't move with the walk
            because the bear pauses on hover. */}
        <div
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-2xl shadow-black/40 pointer-events-none transition-all duration-150 ${
            showTip ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(129, 140, 248, 0.30)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            // Counter-rotate the tooltip when the bear is mid-flip so the text
            // stays readable (its parent has scaleX(±1) from the walk animation).
            // We use `transform: scaleX(...)` inversion via JS-less CSS isn't possible,
            // so just keep the tooltip rotation-neutral and accept that during the
            // ~4% flip window the text may briefly mirror — pretty rare in practice.
          }}
          role="tooltip"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span className="text-[var(--color-fg)]">Sforăilă · vorbește live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
