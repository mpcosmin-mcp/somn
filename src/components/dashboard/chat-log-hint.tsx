'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';
import { chatSend } from '@/lib/chat-toggle';

const DISMISS_KEY = 'somn_chat_log_hint_dismissed';

/**
 * Small one-time banner that tells the user the chat can now log sleep
 * directly. Dismissible (persisted in localStorage). Hidden forever once
 * dismissed.
 */
export function ChatLogHint() {
  const [dismissed, setDismissed] = useState(true); // start dismissed to avoid flash before hydration

  useEffect(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      setDismissed(v === '1');
    } catch { setDismissed(false); }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <Card className="px-4 py-3 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(163, 230, 53, 0.15), transparent 60%)' }}
      />
      <div className="relative flex items-center gap-3">
        <div className="shrink-0">
          <Lobster size={40} talking />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label mb-0.5">NOU · loghează prin chat</div>
          <div className="text-sm leading-tight mb-2">
            Spune-i AI-ului cum ai dormit. <span className="text-[var(--color-fg-muted)]">Ex: &ldquo;salut, am dormit cu 75 scor și 41 hrv&rdquo;</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                chatSend('salut, am dormit cu 75 scor și 41 hrv');
                dismiss();
              }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110 active:brightness-95 transition-all"
            >
              încearcă acum →
            </button>
            <button
              onClick={dismiss}
              className="text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              am priceput
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="dismiss"
          className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Card>
  );
}
