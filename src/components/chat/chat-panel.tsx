'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useUser } from '@/lib/user';
import { Avi } from '@/components/ui/avi';
import type { ChatMessage } from '@/app/api/chat/route';
import { ChatBubble } from '@/components/chat/chat-bubble';
import { LAST_SEEN_KEY, formatDayLabel } from '@/components/chat/chat-utils';

/**
 * Team chat — always-on room, no channels.
 *
 * Desktop (lg+): permanent left rail below the TopBar, ~300px wide.
 * Mobile / tablet (< lg): floating left-edge launcher + slide-in drawer
 * with backdrop.
 *
 * Unread tracking is client-side: latest read ts lives in localStorage,
 * compared against the newest message ts on every fetch. No server-side
 * per-user state; keeps the KV footprint tiny.
 *
 * On desktop the panel is always visible so we mark everything as read
 * on every fetch (no badge). On mobile, unread persists until the user
 * opens the drawer.
 */

export function ChatPanel() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const readLastSeen = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem(LAST_SEEN_KEY) ?? '0');
  }, []);

  useEffect(() => { setLastSeen(readLastSeen()); }, [readLastSeen]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { messages?: ChatMessage[] };
      setMessages(json.messages ?? []);
    } catch { /* KV unavailable in local dev — silent */ }
  }, []);

  // Initial load + refetch on visibility change.
  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  // Poll every 15s while the user is logged in. On desktop the rail is
  // always visible, so we always want fresh messages. On mobile it keeps
  // the unread badge accurate.
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [user, load]);

  // Detect desktop (lg+) once so we can behave differently: docked rail vs drawer.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Effective "visible" — on desktop always true; on mobile only when drawer is open.
  const visible = isDesktop || open;

  // Auto-scroll to bottom whenever messages change AND panel is visible.
  useEffect(() => {
    if (!visible) return;
    const el = scrollRef.current;
    if (!el) return;
    // Two rAFs to make sure the new node has laid out before we snap.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    }));
  }, [messages, visible]);

  // Mark all as read whenever the panel is visible (desktop = always).
  useEffect(() => {
    if (!visible) return;
    const latest = messages.length ? messages[messages.length - 1].ts : Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(latest));
    setLastSeen(latest);
    // Autofocus composer only when the drawer opens on mobile.
    if (open && !isDesktop) setTimeout(() => inputRef.current?.focus(), 50);
  }, [visible, messages, open, isDesktop]);

  const unread = useMemo(() => {
    if (!user || isDesktop) return 0;
    return messages.filter(m => m.ts > lastSeen && m.from !== user).length;
  }, [messages, lastSeen, user, isDesktop]);

  const send = async () => {
    const t = text.trim();
    if (!t || !user || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', text: t, from: user }),
      });
      const json = await res.json();
      if (json.message) {
        setMessages(prev => [...prev, json.message]);
        setText('');
      }
    } catch { /* silent — will retry on next poll */ }
    finally { setSending(false); }
  };

  const react = async (id: string, emoji: string) => {
    if (!user) return;
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m;
      const reactions = { ...(m.reactions ?? {}) };
      const users = [...(reactions[emoji] ?? [])];
      const i = users.indexOf(user);
      if (i >= 0) users.splice(i, 1);
      else users.push(user);
      if (users.length) reactions[emoji] = users;
      else delete reactions[emoji];
      return { ...m, reactions };
    }));
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', id, emoji, user }),
      });
    } catch { load(); }
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm('Ștergi mesajul?')) return;
    setMessages(prev => prev.filter(m => m.id !== id));
    try {
      await fetch('/api/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user }),
      });
    } catch { load(); }
  };

  if (!user) return null;

  return (
    <>
      {/* Launcher — mobile/tablet only. Left edge, always visible on <lg. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Deschide chat"
        className={`
          lg:hidden
          fixed left-0 top-1/2 -translate-y-1/2 z-30
          flex items-center gap-1.5 pl-2 pr-3 py-3
          rounded-r-2xl border border-l-0 border-[var(--color-border)]
          bg-[var(--color-bg)]/95 backdrop-blur-md
          text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]
          transition-all
          ${open ? 'opacity-0 pointer-events-none -translate-x-4' : 'opacity-100'}
        `}
        style={{ boxShadow: '0 4px 20px -4px rgba(99,102,241,0.35)' }}
      >
        <MessageCircle size={16} strokeWidth={2.5} className="text-[var(--color-accent)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] hidden sm:inline">chat</span>
        {unread > 0 && (
          <span
            className="num text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[16px] text-center"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Backdrop — drawer mode only */}
      {open && (
        <button
          aria-label="Închide chat"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        />
      )}

      {/* Panel — docked rail on lg+, slide-in drawer on <lg */}
      <aside
        aria-hidden={!visible}
        className={`
          fixed left-0 z-40
          w-full sm:w-[340px] lg:w-[300px] max-w-full
          bg-[var(--color-bg)] border-r border-[var(--color-border)]
          flex flex-col
          transition-transform duration-200 ease-out
          pb-safe
          top-14 bottom-0
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          boxShadow: (open && !isDesktop) ? '4px 0 32px -8px rgba(0,0,0,0.5)' : 'none',
          background:
            'radial-gradient(80% 40% at 0% 0%, rgba(99,102,241,0.10), transparent 60%), var(--color-bg)',
        }}
      >
        {/* Header */}
        <header className="flex items-center gap-2 px-4 h-12 border-b border-[var(--color-border)] shrink-0">
          <MessageCircle size={14} strokeWidth={2.5} className="text-[var(--color-accent)]" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold">chat echipă</div>
            <div className="text-[10px] text-[var(--color-fg-muted)] leading-none">
              <span className="num">{messages.length}</span> mesaje · rămâne aici
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Închide"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
        >
          {loading && messages.length === 0 ? (
            <div className="text-center text-xs text-[var(--color-fg-muted)] py-8">se încarcă...</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="text-4xl mb-2">💬</div>
              <div className="text-sm text-[var(--color-fg-muted)]">Fii primul care scrie.</div>
              <div className="text-[11px] text-[var(--color-fg-dim)] mt-1">
                Toată echipa vede. Rămâne aici pentru totdeauna.
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const isMine = m.from === user;
              const showAvatar = !prev || prev.from !== m.from || (m.ts - prev.ts) > 5 * 60_000;
              const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="text-center my-2">
                      <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--color-fg-dim)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">
                        {formatDayLabel(m.ts)}
                      </span>
                    </div>
                  )}
                  <ChatBubble
                    message={m}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    onReact={react}
                    onDelete={remove}
                    currentUser={user}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--color-border)] px-3 py-2.5 shrink-0 bg-[var(--color-bg)]">
          <div className="flex items-end gap-2">
            <Avi name={user} size="sm" />
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="scrie un mesaj..."
              maxLength={500}
              rows={1}
              className="flex-1 resize-none bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors max-h-32"
              style={{ minHeight: 38 }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="Trimite"
              className="p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              style={{
                background: text.trim() && !sending
                  ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))'
                  : 'var(--color-surface)',
                color: text.trim() && !sending ? '#fff' : 'var(--color-fg-muted)',
              }}
            >
              <Send size={16} strokeWidth={2.5} />
            </button>
          </div>
          <div className="text-[9px] text-[var(--color-fg-dim)] mt-1 num text-right">
            {text.length}/500
          </div>
        </div>
      </aside>
    </>
  );
}

