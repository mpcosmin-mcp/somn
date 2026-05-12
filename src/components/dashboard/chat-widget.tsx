'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { FIRST_NAME } from '@/lib/sleep';
import { chatTurn, type ChatMessage } from '@/lib/client-api';
import { useEntries } from '@/lib/entries-provider';
import { Avi } from '@/components/ui/avi';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';

const HISTORY_KEY = (user: string) => `somn_chat_${user}`;

/** Empty-state suggestions — first two demo chat-as-log */
const SUGGESTIONS = [
  '✏️ logează că am dormit 78 azi, REM 95, RHR 60',
  '📝 adaugă o notă: m-am culcat la 23:00, fără ecran',
  '🏆 cine doarme cel mai bine săptămâna asta?',
  '🌙 cum îmi cresc REM-ul?',
  '🔍 ce pattern stupid văd în datele mele?',
];

/** Each turn may carry action chips when the AI used tools */
interface UIMessage extends ChatMessage {
  actions?: { label: string }[];
}

/**
 * Reusable chat UI. Pulls entries from the shared EntriesProvider so writes
 * triggered by the AI refresh the dashboard automatically (via refetch()).
 *
 * Auto-sends a `pendingPrompt` prop on change — used by AINudge cards.
 */
export function ChatWidget({
  user,
  onClose,
  pendingPrompt,
  onPromptConsumed,
}: {
  user: string;
  onClose?: () => void;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
}) {
  const { entries, refetch } = useEntries();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history (persisted per-user)
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY(user));
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user]);

  // Persist on every change
  useEffect(() => {
    if (!user) return;
    try { localStorage.setItem(HISTORY_KEY(user), JSON.stringify(messages)); } catch { /* ignore */ }
  }, [user, messages]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || !user || sending) return;
    const next: UIMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      // Send only the bare ChatMessage shape — drop action chips from history
      const turnPayload: ChatMessage[] = next.map(({ role, content }) => ({ role, content }));
      const result = await chatTurn(user, turnPayload, entries);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.text,
        actions: result.actions.length > 0 ? result.actions : undefined,
      }]);

      // 🔑 If AI wrote to the DB, refresh the shared entries so the dashboard updates
      if (result.mutated) {
        await refetch();
      }
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, user, entries, sending, refetch]);

  // Auto-send pendingPrompt from AINudge etc.
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.trim() && !sending) {
      send(pendingPrompt);
      onPromptConsumed?.();
    }
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
          <div className="font-semibold text-sm leading-tight">Sforăilă</div>
          <div className="text-[10px] text-[var(--color-fg-muted)] num truncate">ursul somnului · poate să logheze</div>
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
          <div className="py-4 text-center">
            <Lobster size={56} className="mx-auto mb-2" />
            <div className="text-sm font-bold mb-1">salut, {fn} 👋</div>
            <div className="text-xs text-[var(--color-fg-muted)] mb-4 leading-relaxed px-2">
              poți să loghezi somnul prin chat. doar scrie cum ai dormit.
            </div>
            {/* Demo log-via-dialog */}
            <div className="px-2 mb-3">
              <button
                onClick={() => send('salut, am dormit cu 75 scor și 41 hrv')}
                className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 hover:bg-[var(--color-accent)]/15 transition-colors text-[var(--color-fg)] leading-relaxed"
              >
                <span className="text-[var(--color-accent)] num font-semibold">~ ex:</span> &ldquo;salut, am dormit cu 75 scor și 41 hrv&rdquo;
                <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">→ click ca să încerci</div>
              </button>
            </div>
            <div className="label mb-1.5">sau întreabă</div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s.replace(/^[^\s]+ /, ''))}
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
            <div className={`flex-1 min-w-0 flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Action chips (only on assistant messages with tool calls) */}
              {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-1 max-w-[90%]">
                  {m.actions.map((a, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] num px-2 py-0.5 rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 text-[var(--color-accent)] font-semibold"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              )}
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
            <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center shrink-0 overflow-hidden">
              <Lobster size={22} talking />
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
            placeholder="întreabă sau cere AI-ului să logheze..."
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
          enter = trimite · poate să logheze direct
        </div>
      </div>
    </div>
  );
}
