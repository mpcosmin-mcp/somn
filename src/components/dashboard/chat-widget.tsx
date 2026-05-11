'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { fetchAllEntries, chatTurn, type ChatMessage } from '@/lib/client-api';
import { Avi } from '@/components/ui/avi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';

const HISTORY_KEY = (user: string) => `somn_chat_${user}`;

const SUGGESTIONS = [
  'cum a fost săptămâna mea?',
  'cum îmi cresc REM-ul?',
  'cine a dormit cel mai bine?',
  'sportul de seară mi-a stricat somnul?',
];

/**
 * The reusable chat UI. Used inside the side panel (and the legacy /chat page).
 * Manages its own messages state via localStorage per-user.
 *
 * Optional `pendingPrompt` — when this prop changes to a non-empty string, the
 * widget auto-sends it as a user message and calls `onPromptConsumed` to clear
 * the parent state. Used by AINudge cards to launch a chat with a pre-filled Q.
 */
export function ChatWidget({
  user,
  onClose,
  autofetch = true,
  pendingPrompt,
  onPromptConsumed,
}: {
  user: string;
  onClose?: () => void;
  autofetch?: boolean;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
}) {
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load entries (skipped if parent already provides them and passes autofetch=false)
  useEffect(() => {
    if (!autofetch) return;
    fetchAllEntries().then(setEntries).catch(() => {});
  }, [autofetch]);

  // Load chat history
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY(user));
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user]);

  // Persist
  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem(HISTORY_KEY(user), JSON.stringify(messages)); } catch { /* ignore */ }
  }, [user, messages]);

  // Auto-scroll
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || !user || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const reply = await chatTurn(user, next, entries);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, user, entries, sending]);

  // Auto-send incoming pendingPrompt (from AINudge cards, etc.)
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.trim() && !sending) {
      send(pendingPrompt);
      onPromptConsumed?.();
    }
    // We intentionally only depend on pendingPrompt here — `send` changes on
    // every render and would cause loops; the closure captures current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearChat = () => {
    if (!confirm('Șterg conversația?')) return;
    setMessages([]);
    if (user) try { localStorage.removeItem(HISTORY_KEY(user)); } catch { /* ignore */ }
  };

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-3 py-2.5 flex items-center gap-2 shrink-0 pt-safe">
        <div className="w-9 h-9 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center shrink-0 overflow-hidden">
          <Lobster size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight">somn ai</div>
          <div className="text-[10px] text-[var(--color-fg-muted)] num truncate">claude haiku · vede tot</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            title="Șterge conversația"
            aria-label="Șterge conversația"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Închide chat"
            title="Închide (esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <Lobster size={64} className="mx-auto mb-2" />
            <div className="text-sm font-bold mb-1">salut, {fn}</div>
            <div className="text-xs text-[var(--color-fg-muted)] mb-4 leading-relaxed">
              întreabă-mă orice despre somn, REM, echipă. Îți am datele la îndemână.
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[var(--color-fg-muted)] text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'assistant' ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center shrink-0 overflow-hidden">
                <Lobster size={22} />
              </div>
            ) : (
              <Avi name={user} size="sm" />
            )}
            <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'flex justify-end' : ''}`}>
              <Card
                className={`px-3 py-2 max-w-[90%] ${
                  m.role === 'user' ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30' : ''
                }`}
              >
                <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
              </Card>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-[var(--color-accent)] text-[10px] num font-bold shrink-0">
              ai
            </div>
            <Card className="px-3 py-2 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '300ms' }} />
            </Card>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-border)] px-3 pt-2 pb-2 pb-safe shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="întreabă..."
            rows={1}
            className="flex-1 resize-none rounded-lg px-3 py-2.5 bg-[var(--color-card)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-fg-dim)] max-h-32"
            disabled={sending}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="tap rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:brightness-110 active:brightness-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            aria-label="Trimite"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="text-[9px] num text-[var(--color-fg-dim)] mt-1 px-0.5 hidden sm:block">
          enter = trimite · shift+enter = newline
        </div>
      </div>
    </div>
  );
}
