'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { fetchAllEntries, chatTurn, type ChatMessage } from '@/lib/client-api';
import { Avi } from '@/components/ui/avi';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Card } from '@/components/ui/card';

const HISTORY_KEY = (user: string) => `somn_chat_${user}`;

const SUGGESTIONS = [
  'cum a fost săptămâna mea?',
  'cum îmi cresc REM-ul?',
  'cine a dormit cel mai bine luna asta?',
  'ce influențează HRV-ul?',
  'sportul de seară mi-a stricat somnul?',
];

export default function ChatPage() {
  const { user, hydrated } = useUser();
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load entries
  useEffect(() => {
    fetchAllEntries().then(setEntries).catch(() => {});
  }, []);

  // Load chat history per-user
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY(user));
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [user]);

  // Persist chat history
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(HISTORY_KEY(user), JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [user, messages]);

  // Auto-scroll on new message
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

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">se încarcă...</div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[var(--color-fg-muted)] mb-4">trebuie să-ți alegi profilul mai întâi</div>
          <Link href="/"><Button variant="primary">înapoi la login</Button></Link>
        </div>
      </div>
    );
  }

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  return (
    <main className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)] shrink-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link href="/" className="num font-bold text-lg tracking-tight">somn</Link>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] hidden sm:inline">· chat</span>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearChat}>șterge chat</Button>
            )}
            <Link href="/"><Button size="sm" variant="ghost">← dashboard</Button></Link>
            <ThemeToggle />
            <Avi name={user} size="sm" />
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">💬</div>
              <div className="font-bold text-lg">salut, {fn}</div>
              <div className="text-sm text-[var(--color-fg-muted)] mb-6">
                pot răspunde despre somnul tău, al echipei, sau orice cunoști despre REM/RHR/HRV. claude haiku, are acces la datele voastre din ultima lună.
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-2 rounded-full border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors text-[var(--color-fg-muted)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-[var(--color-accent)] text-xs num font-bold shrink-0">
                  ai
                </div>
              ) : (
                <Avi name={user} size="md" />
              )}
              <div className={`flex-1 ${m.role === 'user' ? 'flex justify-end' : ''}`}>
                <Card
                  className={`px-4 py-2.5 max-w-[85%] inline-block ${
                    m.role === 'user'
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
                      : ''
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                </Card>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-[var(--color-accent)] text-xs num font-bold shrink-0">
                ai
              </div>
              <Card className="px-4 py-2.5 inline-block">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg-muted)] animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="întreabă orice despre somn, REM, echipa..."
              rows={1}
              className="flex-1 resize-none rounded-xl px-3 py-2.5 bg-[var(--color-card)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-fg-dim)] max-h-32"
              disabled={sending}
            />
            <Button variant="primary" disabled={sending || !input.trim()} onClick={() => send(input)}>
              {sending ? '...' : 'send'}
            </Button>
          </div>
          <div className="text-[9px] num text-[var(--color-fg-dim)] mt-1.5 px-1">
            ~$ haiku · context: ultimele 30 zile · enter = trimite, shift+enter = newline
          </div>
        </div>
      </div>
    </main>
  );
}
