'use client';
import { useState, useRef, useEffect } from 'react';
import { Lobster } from '@/components/ui/lobster';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const DAILY_LIMIT = 10;

/**
 * SforăilăChat — the ONLY AI surface in this app.
 *
 *   • Floating Sforăilă bubble pinned top-left, under the TopBar.
 *   • Click → popup with chat history (session-only, not persisted) + input.
 *   • Server enforces 10 messages/day per user via /api/chat (KV-backed).
 *   • Quota counter is shown in the bubble label + popup footer.
 */
export function SforailaChat({ user, entries }: { user: string; entries: SleepEntry[] }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length, loading]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popupRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && !limitHit) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, limitHit]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || limitHit) return;
    setError(null);
    setLoading(true);

    const priorHistory = history;
    setHistory([...priorHistory, { role: 'user', content: text }]);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, message: text, history: priorHistory, entries }),
      });
      const data = (await res.json()) as {
        reply?: string;
        remaining?: number;
        limit?: number;
        error?: string;
      };

      if (res.status === 429) {
        setLimitHit(true);
        setRemaining(0);
        return;
      }
      if (!res.ok || !data.reply) {
        setError(
          data.error === 'no-api-key'
            ? 'Sforăilă nu are cheia. Verifică ANTHROPIC_API_KEY.'
            : data.error === 'rate-limit-unavailable'
            ? 'Sforăilă nu poate număra acum (KV down).'
            : 'Sforăilă doarme acum. Mai încearcă.',
        );
        return;
      }

      setHistory(prev => [...prev, { role: 'assistant', content: data.reply! }]);
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
        if (data.remaining <= 0) setLimitHit(true);
      }
    } catch {
      setError('Sforăilă doarme acum. Mai încearcă.');
    } finally {
      setLoading(false);
    }
  };

  const remainingPill = remaining !== null && (
    <span
      className={cn(
        'num text-[10px] px-1.5 py-0.5 rounded-full',
        remaining <= 2
          ? 'bg-red-500/15 text-red-300'
          : 'bg-[var(--color-surface)] text-[var(--color-fg-muted)]',
      )}
    >
      {remaining}/{DAILY_LIMIT}
    </span>
  );

  return (
    <>
      {/* Floating trigger — top-left under TopBar */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'fixed z-40 left-3 sm:left-5',
          'top-[calc(env(safe-area-inset-top,0px)+68px)]',
          'flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full',
          'bg-[var(--color-card)]/95 backdrop-blur border border-[var(--color-border)]',
          'hover:border-[var(--color-accent)] transition-colors shadow-lg',
        )}
        aria-label={open ? 'închide chat Sforăilă' : 'deschide chat Sforăilă'}
        aria-expanded={open}
      >
        <Lobster size={28} talking={loading} />
        <span className="text-xs font-bold">Sforăilă</span>
        {remainingPill}
      </button>

      {/* Popup */}
      {open && (
        <div
          ref={popupRef}
          className={cn(
            'fixed z-40 left-3 right-3 sm:left-5 sm:right-auto sm:w-[380px]',
            'top-[calc(env(safe-area-inset-top,0px)+112px)]',
            'card flex flex-col overflow-hidden shadow-2xl',
            'max-h-[min(70vh,520px)]',
          )}
          role="dialog"
          aria-label="Chat Sforăilă"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 min-w-0">
              <Lobster size={20} />
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Sforăilă</div>
                <div className="text-[9px] text-[var(--color-fg-muted)] leading-tight">
                  max {DAILY_LIMIT} întrebări/zi
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] text-lg leading-none px-1"
              aria-label="închide"
            >
              ×
            </button>
          </div>

          {/* History scroll */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
            style={{ scrollbarGutter: 'stable' }}
          >
            {history.length === 0 && !loading && (
              <div className="text-xs text-[var(--color-fg-muted)] italic py-4 text-center">
                salut {fn} — întreabă-mă orice despre cifrele echipei.
              </div>
            )}
            {history.map((t, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl px-3 py-2',
                  t.role === 'user'
                    ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 ml-6'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] mr-6',
                )}
              >
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{t.content}</p>
              </div>
            ))}
            {loading && (
              <div className="text-xs italic text-[var(--color-fg-muted)] mr-6 px-3 py-2">
                Sforăilă se gândește...
              </div>
            )}
            {error && (
              <div className="text-xs text-red-300 italic px-3 py-1">{error}</div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[var(--color-border)] px-3 py-2.5">
            {limitHit ? (
              <div className="text-xs text-center text-[var(--color-fg-muted)] italic py-2">
                Sforăilă a obosit — revino mâine.
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); void send(); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="întreabă pe Sforăilă..."
                  disabled={loading}
                  maxLength={500}
                  className={cn(
                    'flex-1 h-9 px-3 rounded-lg text-xs',
                    'bg-[var(--color-bg)] text-[var(--color-fg)]',
                    'border border-[var(--color-border)]',
                    'placeholder:text-[var(--color-fg-dim)]',
                    'focus:outline-none focus:border-[var(--color-accent)]',
                  )}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={loading || !input.trim()}
                  aria-label="trimite"
                >
                  →
                </Button>
              </form>
            )}
            {remaining !== null && !limitHit && (
              <div className="text-[9px] text-[var(--color-fg-dim)] text-right mt-1 num">
                {remaining}/{DAILY_LIMIT} rămase azi
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
