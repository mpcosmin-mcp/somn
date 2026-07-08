'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, X, ArrowLeft, Pencil, Check, ChevronDown as ChevronDownArrow } from 'lucide-react';
import { useUser } from '@/lib/user';
import { FIRST_NAME, personColor } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import type { Idea, IdeaStatus } from '@/app/api/ideas/route';

const STATUS_META: Record<IdeaStatus, { label: string; icon: string; color: string }> = {
  new:      { label: 'nou',       icon: '📝', color: '#a1a1aa' },
  wip:      { label: 'în lucru',  icon: '🔨', color: '#f59e0b' },
  done:     { label: 'făcut',     icon: '✅', color: '#a3e635' },
  rejected: { label: 'respins',   icon: '❌', color: '#ef4444' },
};

const STATUSES: IdeaStatus[] = ['new', 'wip', 'done', 'rejected'];

export default function IdeasPage() {
  const { user } = useUser();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ideas', { cache: 'no-store' });
      const json = await res.json();
      setIdeas(json.ideas ?? []);
      setError('');
    } catch {
      setError('Nu am putut încărca ideile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const t = title.trim();
    if (!t || !user || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: t, body: body.trim(), from: user }),
      });
      const json = await res.json();
      if (json.idea) {
        setIdeas(prev => [json.idea, ...prev]);
        setTitle('');
        setBody('');
      }
    } catch {
      setError('Nu am putut trimite ideea.');
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (id: string, dir: 'up' | 'down') => {
    if (!user) return;
    // Optimistic
    setIdeas(prev => prev.map(i => {
      if (i.id !== id) return i;
      const wasIn = (dir === 'up' ? i.up : i.down).includes(user);
      const up = i.up.filter(u => u !== user);
      const down = i.down.filter(u => u !== user);
      if (!wasIn) (dir === 'up' ? up : down).push(user);
      return { ...i, up, down };
    }));
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', id, user, dir }),
      });
      const json = await res.json();
      if (json.idea) setIdeas(prev => prev.map(i => i.id === id ? json.idea : i));
    } catch { load(); }
  };

  const setStatus = async (id: string, status: IdeaStatus) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    try {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', id, status }),
      });
    } catch { load(); }
  };

  const editIdea = async (id: string, newTitle: string, newBody: string) => {
    if (!user) return;
    const t = newTitle.trim();
    if (!t) return;
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, title: t, body: newBody.trim() } : i));
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', id, user, title: t, body: newBody.trim() }),
      });
      const json = await res.json();
      if (json.idea) setIdeas(prev => prev.map(i => i.id === id ? json.idea : i));
    } catch { load(); }
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm('Sigur ștergi ideea?')) return;
    setIdeas(prev => prev.filter(i => i.id !== id));
    try {
      await fetch('/api/ideas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user }),
      });
    } catch { load(); }
  };

  const sorted = useMemo(() => {
    const filtered = filter === 'all' ? ideas : ideas.filter(i => i.status === filter);
    return [...filtered].sort((a, b) => {
      // done/rejected go to the bottom regardless of score
      const closedA = a.status === 'done' || a.status === 'rejected';
      const closedB = b.status === 'done' || b.status === 'rejected';
      if (closedA !== closedB) return closedA ? 1 : -1;
      const scoreA = a.up.length - a.down.length;
      const scoreB = b.up.length - b.down.length;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.ts - a.ts;
    });
  }, [ideas, filter]);

  const counts = useMemo(() => {
    const c: Record<IdeaStatus | 'all', number> = { all: ideas.length, new: 0, wip: 0, done: 0, rejected: 0 };
    for (const i of ideas) c[i.status]++;
    return c;
  }, [ideas]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]">
        Alege-ți cardul mai întâi.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-3 lg:gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors">
          <ArrowLeft size={14} strokeWidth={2} /> înapoi
        </Link>
        <div className="ml-auto text-[9px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)] font-medium">
          {ideas.length} idei
        </div>
      </div>

      {/* Submit new */}
      <Card className="px-4 py-3">
        <div className="label mb-2">💡 idee nouă</div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && title.trim()) { e.preventDefault(); submit(); } }}
          placeholder="titlu scurt (ex: notificări la culcare)"
          maxLength={80}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors mb-2"
        />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="descriere · opțional"
          maxLength={500}
          rows={2}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors mb-2 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-[var(--color-fg-dim)] num">{title.length}/80 · {body.length}/500</span>
          <button
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: title.trim() && !submitting ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' : 'var(--color-surface)',
              color: title.trim() && !submitting ? '#fff' : 'var(--color-fg-muted)',
            }}
          >
            {submitting ? 'trimit...' : 'trimite'}
          </button>
        </div>
      </Card>

      {/* Filter chips */}
      <div className="flex items-center gap-1 flex-wrap px-1">
        <button
          onClick={() => setFilter('all')}
          className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${filter === 'all' ? 'bg-[var(--color-accent)] text-[var(--color-bg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'}`}
        >
          Toate {counts.all > 0 && <span className="num ml-0.5">{counts.all}</span>}
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${filter === s ? 'bg-[var(--color-accent)] text-[var(--color-bg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'}`}
          >
            {STATUS_META[s].icon} {STATUS_META[s].label} {counts[s] > 0 && <span className="num ml-0.5">{counts[s]}</span>}
          </button>
        ))}
      </div>

      {/* Ideas list */}
      {loading ? (
        <div className="text-center text-xs text-[var(--color-fg-muted)] py-8">se încarcă...</div>
      ) : error ? (
        <div className="px-4 py-3 rounded-xl bg-[var(--color-bad)]/10 border border-[var(--color-bad)]/30 text-[var(--color-bad)] text-sm">
          {error} <button onClick={load} className="underline ml-1">retry</button>
        </div>
      ) : sorted.length === 0 ? (
        <Card className="px-4 py-8 text-center">
          <div className="text-3xl mb-2">💭</div>
          <div className="text-sm text-[var(--color-fg-muted)]">
            {filter === 'all' ? 'Încă nu sunt idei. Fii primul!' : `Nicio idee ${STATUS_META[filter as IdeaStatus].label}.`}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              currentUser={user}
              onVote={vote}
              onStatus={setStatus}
              onDelete={remove}
              onEdit={editIdea}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaCard({ idea, currentUser, onVote, onStatus, onDelete, onEdit }: {
  idea: Idea;
  currentUser: string;
  onVote: (id: string, dir: 'up' | 'down') => void;
  onStatus: (id: string, status: IdeaStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string, body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(idea.title);
  const [editBody, setEditBody] = useState(idea.body);
  const score = idea.up.length - idea.down.length;
  const upvoted = idea.up.includes(currentUser);
  const downvoted = idea.down.includes(currentUser);
  const isMine = idea.from === currentUser;
  const closed = idea.status === 'done' || idea.status === 'rejected';
  const meta = STATUS_META[idea.status];
  const authorColor = personColor(idea.from);
  const authorName = FIRST_NAME[idea.from] ?? idea.from.split(' ')[0];

  const startEdit = () => {
    setEditTitle(idea.title);
    setEditBody(idea.body);
    setEditing(true);
  };

  const saveEdit = () => {
    const t = editTitle.trim();
    if (!t) return;
    onEdit(idea.id, t, editBody);
    setEditing(false);
  };

  return (
    <Card className={`px-3 py-3 transition-opacity ${closed ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            onClick={() => onVote(idea.id, 'up')}
            aria-label="Upvote"
            className={`p-1 rounded-md transition-all active:scale-90 ${upvoted ? 'text-[var(--color-good)] bg-[var(--color-good)]/10' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-good)] hover:bg-[var(--color-surface)]'}`}
          >
            <ChevronUp size={18} strokeWidth={2.5} />
          </button>
          <span className="num font-bold text-sm" style={{ color: score > 0 ? 'var(--color-good)' : score < 0 ? 'var(--color-bad)' : 'var(--color-fg-muted)' }}>
            {score > 0 ? `+${score}` : score}
          </span>
          <button
            onClick={() => onVote(idea.id, 'down')}
            aria-label="Downvote"
            className={`p-1 rounded-md transition-all active:scale-90 ${downvoted ? 'text-[var(--color-bad)] bg-[var(--color-bad)]/10' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-bad)] hover:bg-[var(--color-surface)]'}`}
          >
            <ChevronDown size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="mb-1.5">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditing(false); }}
                maxLength={80}
                autoFocus
                className="w-full bg-[var(--color-surface)] border border-[var(--color-accent)]/40 rounded-lg px-2 py-1 text-sm font-bold text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] mb-1.5"
              />
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="descriere · opțional"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 resize-none mb-1.5"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={saveEdit}
                  disabled={!editTitle.trim()}
                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-30 flex items-center gap-1"
                >
                  <Check size={10} strokeWidth={3} /> salvează
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-[10px] font-bold px-2 py-1 rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
                >
                  anulează
                </button>
                <span className="ml-auto text-[9px] num text-[var(--color-fg-dim)]">{editTitle.length}/80 · {editBody.length}/500</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 flex-wrap mb-1">
                <span className="font-bold text-sm text-[var(--color-fg)] leading-snug">{idea.title}</span>
                <StatusChip status={idea.status} onChange={s => onStatus(idea.id, s)} meta={meta} />
              </div>
              {idea.body && (
                <p className="text-xs text-[var(--color-fg-muted)] leading-snug whitespace-pre-line mb-2">{idea.body}</p>
              )}
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-fg-dim)]">
                <span className="font-bold" style={{ color: authorColor }}>{authorName}</span>
                <span>·</span>
                <span className="num">{relativeTime(idea.ts)}</span>
                {idea.up.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="num">👍 {idea.up.length}</span>
                  </>
                )}
                {idea.down.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="num">👎 {idea.down.length}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions (only for owner) */}
        {isMine && !editing && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={startEdit}
              className="text-[var(--color-fg-dim)] hover:text-[var(--color-accent)] transition-colors p-1"
              aria-label="Editează"
              title="Editează"
            >
              <Pencil size={12} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onDelete(idea.id)}
              className="text-[var(--color-fg-dim)] hover:text-[var(--color-bad)] transition-colors p-1"
              aria-label="Șterge"
              title="Șterge"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatusChip({ status, onChange, meta }: {
  status: IdeaStatus;
  onChange: (s: IdeaStatus) => void;
  meta: { label: string; icon: string; color: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all active:scale-95 hover:brightness-125 flex items-center gap-0.5"
        style={{ color: meta.color, background: meta.color + '18', border: `1px solid ${meta.color}40` }}
        title="Schimbă status"
      >
        {meta.icon} {meta.label}
        <ChevronDownArrow size={9} strokeWidth={2.5} className="opacity-70" />
      </button>
      {open && (
        <>
          <button
            aria-label="închide"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className={`flex items-center gap-1.5 w-full text-left text-[10px] font-bold px-2 py-1.5 hover:bg-[var(--color-surface)] transition-colors ${s === status ? 'bg-[var(--color-surface)]/50' : ''}`}
                  style={{ color: m.color }}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'acum';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}z`;
  return new Date(ts).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}
