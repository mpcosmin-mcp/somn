'use client';
import { useState } from 'react';
import { Heart, MessageCircle, Send, X, CornerDownRight } from 'lucide-react';
import { type SleepEntry, FIRST_NAME, personColor } from '@/lib/sleep';
import { useSocial, entryKeyOf, type Comment, type Reply } from '@/lib/social';
import { MentionText, MENTIONABLES, appendMention } from '@/lib/mentions';
import { ReactionBar } from '@/components/dashboard/reaction-bar';

/**
 * Likes + comments footer for a single feed entry.
 *
 * Threading: Instagram-style 1-level deep. A top-level comment can have
 * many replies, but replies cannot themselves be replied to. Heart on
 * each level (comment + reply); like counts are global.
 *
 * Layout:
 *   [♡] [💬]                          ← entry-level reactions
 *   ───── thread (when 💬 open) ─────
 *   🐻 Petrica · 2h
 *   "..."
 *   [♥ 2] [↩ răspunde]
 *     └─ 🐻 Clara · 1h "..." [♥]
 *     └─ 🐻 Cornel · 30m "..." [♥]
 *     [reply composer if open]
 *   [top-level composer]
 */
export function EntryReactions({ entry, currentUser }: {
  entry: SleepEntry;
  currentUser: string;
}) {
  const {
    toggleEntryReaction, entryReactionsFor, addComment, deleteComment, commentsFor,
    addReply, deleteReply, toggleCommentLike, toggleReplyLike,
  } = useSocial();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const key = entryKeyOf(entry.date, entry.name);
  const entryReactions = entryReactionsFor(key);
  const comments = commentsFor(key);

  const submitTopLevel = () => {
    const t = input.trim();
    if (!t || t.length > 280) return;
    addComment(key, { from: currentUser, ts: Date.now(), text: t, likes: [], replies: [] });
    setInput('');
    setOpen(true);
  };

  const totalThreadCount =
    comments.length + comments.reduce((sum, c) => sum + c.replies.length, 0);

  return (
    <div className="mt-1">
      {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        <ReactionBar
          reactions={entryReactions}
          currentUser={currentUser}
          onToggle={(emoji) => toggleEntryReaction(key, emoji, currentUser)}
        />

        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Comentarii"
          aria-pressed={open}
          className={`flex items-center gap-1.5 text-xs font-bold tap rounded-md px-1 -mx-1 py-0.5 transition-colors ml-auto ${
            open ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          <MessageCircle size={18} strokeWidth={2} />
          {totalThreadCount > 0 && <span className="num text-[11px]">{totalThreadCount}</span>}
        </button>
      </div>

      {/* Expanded thread */}
      {open && (
        <div className="mt-2.5 space-y-2">
          {comments
            .slice()
            .sort((a, b) => a.ts - b.ts)
            .map(c => (
              <CommentBlock
                key={`${c.from}-${c.ts}`}
                entryKey={key}
                comment={c}
                currentUser={currentUser}
                onDelete={() => deleteComment(key, c.ts, c.from)}
                onToggleLike={() => toggleCommentLike(key, c.ts, currentUser)}
                onReply={(reply) => addReply(key, c.ts, reply)}
                onToggleReplyLike={(replyTs) => toggleReplyLike(key, c.ts, replyTs, currentUser)}
                onDeleteReply={(replyTs, by) => deleteReply(key, c.ts, replyTs, by)}
              />
            ))}

          {/* Top-level composer */}
          <div className="space-y-1.5">
            <MentionChips exclude={currentUser} onPick={f => setInput(v => appendMention(v, f))} />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTopLevel(); } }}
                placeholder="scrie ceva... (@ pentru a menționa)"
                maxLength={280}
                className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors"
              />
              <button
                onClick={submitTopLevel}
                disabled={!input.trim()}
                aria-label="Trimite"
                className="rounded-lg p-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{
                  background: input.trim() ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' : 'transparent',
                  color: input.trim() ? '#fff' : 'var(--color-fg-muted)',
                }}
              >
                <Send size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Comment block (top-level comment + its reply thread) ───── */

function CommentBlock({
  entryKey: _entryKey,
  comment,
  currentUser,
  onDelete,
  onToggleLike,
  onReply,
  onToggleReplyLike,
  onDeleteReply,
}: {
  entryKey: string;
  comment: Comment;
  currentUser: string;
  onDelete: () => void;
  onToggleLike: () => void;
  onReply: (reply: Reply) => void;
  onToggleReplyLike: (replyTs: number) => void;
  onDeleteReply: (replyTs: number, by: string) => void;
}) {
  void _entryKey;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyInput, setReplyInput] = useState('');

  const iLiked = comment.likes.includes(currentUser);
  const canDelete = comment.from === currentUser;

  const submitReply = () => {
    const t = replyInput.trim();
    if (!t || t.length > 280) return;
    onReply({ from: currentUser, ts: Date.now(), text: t, likes: [] });
    setReplyInput('');
  };

  return (
    <div>
      {/* Top-level comment row */}
      <CommentBody
        from={comment.from}
        ts={comment.ts}
        text={comment.text}
        likes={comment.likes}
        iLiked={iLiked}
        canDelete={canDelete}
        onDelete={onDelete}
        onToggleLike={onToggleLike}
        onReply={() => setReplyOpen(o => !o)}
        replyActive={replyOpen}
      />

      {/* Reply thread (indented) */}
      {(comment.replies.length > 0 || replyOpen) && (
        <div className="mt-1.5 pl-5 space-y-1.5 border-l border-[var(--color-border)]/60 ml-2.5">
          {comment.replies
            .slice()
            .sort((a, b) => a.ts - b.ts)
            .map(r => (
              <CommentBody
                key={`${r.from}-${r.ts}`}
                from={r.from}
                ts={r.ts}
                text={r.text}
                likes={r.likes}
                iLiked={r.likes.includes(currentUser)}
                canDelete={r.from === currentUser}
                onDelete={() => onDeleteReply(r.ts, r.from)}
                onToggleLike={() => onToggleReplyLike(r.ts)}
                // No nested replies — Instagram-style cap.
                onReply={null}
                replyActive={false}
                compact
              />
            ))}

          {/* Reply composer */}
          {replyOpen && (
            <div className="space-y-1 pt-1">
              <MentionChips exclude={currentUser} onPick={f => setReplyInput(v => appendMention(v, f))} />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyInput}
                  onChange={e => setReplyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                  placeholder={`răspunde lui ${FIRST_NAME[comment.from] ?? comment.from.split(' ')[0]}...`}
                  maxLength={280}
                  autoFocus
                  className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1 text-[11px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors"
                />
                <button
                  onClick={submitReply}
                  disabled={!replyInput.trim()}
                  aria-label="Trimite răspuns"
                  className="rounded-lg p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: replyInput.trim() ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' : 'transparent',
                    color: replyInput.trim() ? '#fff' : 'var(--color-fg-muted)',
                  }}
                >
                  <Send size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Single comment / reply body (shared between top-level + replies) ── */

function CommentBody({
  from, ts, text, likes,
  iLiked, canDelete,
  onDelete, onToggleLike, onReply,
  replyActive,
  compact = false,
}: {
  from: string;
  ts: number;
  text: string;
  likes: string[];
  iLiked: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onToggleLike: () => void;
  /** null when this body is a reply (no nested reply allowed). */
  onReply: (() => void) | null;
  replyActive: boolean;
  compact?: boolean;
}) {
  const c = personColor(from);
  const fn = FIRST_NAME[from] ?? from.split(' ')[0];
  const ago = relativeTime(ts);
  const avSize = compact ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]';
  const textSize = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className="flex items-start gap-2 group">
      <span
        className={`${avSize} rounded-full shrink-0 mt-0.5 flex items-center justify-center font-bold`}
        style={{ background: `${c}22`, color: c }}
        aria-hidden
      >
        {fn[0]}
      </span>
      <div className="flex-1 min-w-0 leading-relaxed">
        <div className={textSize}>
          <span className="font-bold" style={{ color: c }}>{fn}</span>
          <span className="text-[var(--color-fg-dim)] num text-[10px] ml-1.5">{ago}</span>
        </div>
        <p className={`${textSize} text-[var(--color-fg)] mt-0.5 whitespace-pre-line break-words`}>
          <MentionText text={text} />
        </p>

        {/* Per-comment/reply actions */}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={onToggleLike}
            aria-label={iLiked ? 'Retrage like' : 'Dă like'}
            aria-pressed={iLiked}
            className="flex items-center gap-1 text-[10px] font-bold tap rounded-md px-0.5 -mx-0.5 py-0.5 transition-transform active:scale-90"
            style={{ color: iLiked ? '#ef4444' : 'var(--color-fg-muted)' }}
          >
            <Heart size={12} strokeWidth={2.2} fill={iLiked ? '#ef4444' : 'none'} />
            {likes.length > 0 && <span className="num">{likes.length}</span>}
          </button>

          {onReply && (
            <button
              onClick={onReply}
              aria-label="Răspunde"
              aria-pressed={replyActive}
              className={`flex items-center gap-1 text-[10px] font-bold tap rounded-md px-0.5 -mx-0.5 py-0.5 transition-colors ${
                replyActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <CornerDownRight size={11} strokeWidth={2.2} />
              <span>răspunde</span>
            </button>
          )}
        </div>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="text-[var(--color-fg-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-bad)] transition-all shrink-0 p-0.5"
          aria-label="Șterge"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* ─── @-mention quick-insert chips ───────────────────────── */

function MentionChips({ exclude, onPick }: {
  exclude?: string;
  onPick: (first: string) => void;
}) {
  const people = MENTIONABLES.filter(m => m.full !== exclude);
  if (!people.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[9px] text-[var(--color-fg-dim)]">menționează:</span>
      {people.map(p => (
        <button
          key={p.full}
          type="button"
          onClick={() => onPick(p.first)}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-transform active:scale-90"
          style={{ color: p.color, background: `${p.color}14` }}
        >
          @{p.first}
        </button>
      ))}
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
