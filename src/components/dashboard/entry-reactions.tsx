'use client';
import { useState } from 'react';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import { useSocial, entryKeyOf, type Comment } from '@/lib/social';

/**
 * Likes + comments footer for a single feed entry.
 *
 *   [♥ 3]  [💬 2]                          ← collapsed state
 *
 * Click 💬 to expand the comment thread + composer.
 */
export function EntryReactions({ entry, currentUser }: {
  entry: SleepEntry;
  currentUser: string;
}) {
  const { toggleLike, addComment, deleteComment, likesFor, commentsFor } = useSocial();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const key = entryKeyOf(entry.date, entry.name);
  const likes = likesFor(key);
  const comments = commentsFor(key);
  const iLiked = likes.includes(currentUser);

  const submit = () => {
    const t = input.trim();
    if (!t || t.length > 280) return;
    addComment(key, { from: currentUser, ts: Date.now(), text: t });
    setInput('');
    setOpen(true);
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-[var(--color-border)]/60">
      {/* Action row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggleLike(key, currentUser)}
          aria-label={iLiked ? 'Retrage like' : 'Dă like'}
          className="flex items-center gap-1.5 text-[11px] font-bold tap rounded-md px-1.5 -mx-1.5 py-0.5 transition-colors"
          style={{ color: iLiked ? 'var(--color-bad)' : 'var(--color-fg-muted)' }}
        >
          <span className="text-base leading-none">{iLiked ? '♥' : '♡'}</span>
          {likes.length > 0 && <span className="num">{likes.length}</span>}
        </button>

        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 text-[11px] font-bold tap rounded-md px-1.5 -mx-1.5 py-0.5 transition-colors ${
            open ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
          }`}
          aria-label="Comentarii"
        >
          <span className="text-sm leading-none">💬</span>
          {comments.length > 0 && <span className="num">{comments.length}</span>}
        </button>

        {/* List who liked it (when there are likes) — tiny, on the right */}
        {likes.length > 0 && (
          <span className="text-[10px] text-[var(--color-fg-dim)] truncate ml-auto">
            {likes.slice(0, 3).map(u => FIRST_NAME[u] ?? u.split(' ')[0]).join(', ')}
            {likes.length > 3 && ` +${likes.length - 3}`}
          </span>
        )}
      </div>

      {/* Expanded: thread + composer */}
      {open && (
        <div className="mt-2 space-y-2">
          {comments.length > 0 && (
            <div className="space-y-1.5">
              {comments
                .slice()
                .sort((a, b) => a.ts - b.ts)
                .map(c => (
                  <CommentRow
                    key={`${c.from}-${c.ts}`}
                    comment={c}
                    canDelete={c.from === currentUser}
                    onDelete={() => deleteComment(key, c.ts, c.from)}
                  />
                ))}
            </div>
          )}

          {/* Composer */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="scrie ceva..."
              maxLength={280}
              className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors"
            />
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' : 'var(--color-surface)',
                color: input.trim() ? '#fff' : 'var(--color-fg-muted)',
              }}
            >
              trimite
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Single comment row ──────────────────────────────────── */

function CommentRow({
  comment, canDelete, onDelete,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const c = personColor(comment.from);
  const fn = FIRST_NAME[comment.from] ?? comment.from.split(' ')[0];
  const ago = relativeTime(comment.ts);

  return (
    <div className="flex items-start gap-2 group">
      <span
        className="w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold"
        style={{ background: `${c}22`, color: c }}
        aria-hidden
      >
        {fn[0]}
      </span>
      <div className="flex-1 min-w-0 text-xs leading-relaxed">
        <span className="font-bold" style={{ color: c }}>{fn}</span>
        <span className="text-[var(--color-fg-dim)] num text-[10px] ml-1.5">{ago}</span>
        <p className="text-[var(--color-fg)] mt-0.5 whitespace-pre-line break-words">{comment.text}</p>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="text-[10px] text-[var(--color-fg-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-bad)] transition-all shrink-0"
          aria-label="Șterge comentariu"
        >
          ✕
        </button>
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
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}săpt`;
  return new Date(ts).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}
