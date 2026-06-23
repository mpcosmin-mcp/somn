'use client';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import {
  fetchEntryReactions, toggleEntryReactionRemote, type EntryReactions,
  fetchComments, addCommentRemote, deleteCommentRemote,
  replyToCommentRemote, toggleCommentLikeRemote, toggleReplyLikeRemote,
  deleteReplyRemote,
  type ApiError,
} from '@/lib/social-api';
import {
  type ReactionMap, DEFAULT_REACTION,
  toggleReaction as toggleReactionMap, reactorsOf,
} from '@/lib/reactions';

/* ─── Social layer — likes + comments ─────────────────────
 *
 * Source of truth: Vercel KV (Redis hashes `social:likes` and
 * `social:comments`). See SOCIAL_SYNC.md for the one-time setup.
 *
 * Single SocialProvider mounted in the root layout owns the state +
 * the polling cycle. Every useSocial() consumer reads from the same
 * context, so the feed has ONE background refresh — not one per card.
 *
 * Lifecycle:
 *   1. Mount → hydrate from localStorage (instant paint with last-known).
 *   2. Refetch from KV in the background → state + cache update on success.
 *   3. Refetch on window focus + every 30s while the tab is active.
 *   4. Mutation → optimistic local update + write to localStorage +
 *      POST to KV. On server success, replace with canonical value.
 *      On server failure (5xx, kv-unavailable, network) we KEEP the
 *      optimistic state — offline-first. Only rollback on 4xx (genuine
 *      bad request) since that means the action itself was invalid.
 *
 * entryKey = `${date}_${name}` — uniquely identifies a sleep log row.
 */

// v1 reactions — entry "likes" generalized to an emoji ReactionMap.
// New cache key (the old `somn_likes_v2` held a different shape: string[]).
const REACTIONS_KEY = 'somn_reactions_v1';
// v3 — Comments grew `likes` + `replies` fields (Instagram-style threading).
// Old cached v2 records lack those, would crash the new UI on .includes().
const COMMENTS_KEY = 'somn_comments_v3';
const REFETCH_INTERVAL_MS = 30_000;

export interface Reply {
  from: string;
  ts: number;
  text: string;
  /** Users who liked this reply. */
  likes: string[];
}

export interface Comment {
  from: string;
  ts: number;
  text: string;
  /** Users who liked this comment. */
  likes: string[];
  /** 1-level threading — replies cannot themselves be replied to. */
  replies: Reply[];
}

export type CommentsMap = Record<string, Comment[]>;

/** Pad legacy KV records (pre-threading) with default arrays so the new
 *  UI never crashes on undefined `likes`/`replies` fields. */
export function hydrateComment(raw: unknown): Comment {
  const r = (raw ?? {}) as Partial<Comment>;
  return {
    from: r.from ?? '',
    ts: typeof r.ts === 'number' ? r.ts : 0,
    text: r.text ?? '',
    likes: Array.isArray(r.likes) ? r.likes : [],
    replies: Array.isArray(r.replies) ? r.replies.map(hydrateReply) : [],
  };
}

export function hydrateReply(raw: unknown): Reply {
  const r = (raw ?? {}) as Partial<Reply>;
  return {
    from: r.from ?? '',
    ts: typeof r.ts === 'number' ? r.ts : 0,
    text: r.text ?? '',
    likes: Array.isArray(r.likes) ? r.likes : [],
  };
}

interface SocialContextValue {
  /** entryKey → ReactionMap (emoji → users). */
  reactions: EntryReactions;
  comments: CommentsMap;
  /** Toggle one emoji reaction for `user` on an entry. */
  toggleEntryReaction: (entryKey: string, emoji: string, user: string) => void;
  /** Back-compat: toggle a ❤️ reaction on an entry. */
  toggleLike: (entryKey: string, user: string) => void;
  /** Add a top-level comment to an entry. */
  addComment: (entryKey: string, comment: Comment) => void;
  /** Delete a top-level comment (by current user). */
  deleteComment: (entryKey: string, ts: number, by: string) => void;
  /** Reply to a comment (parentTs identifies the parent in the thread). */
  addReply: (entryKey: string, commentTs: number, reply: Reply) => void;
  /** Delete a reply you wrote (by current user). */
  deleteReply: (entryKey: string, commentTs: number, replyTs: number, by: string) => void;
  /** Toggle like on a top-level comment. */
  toggleCommentLike: (entryKey: string, commentTs: number, user: string) => void;
  /** Toggle like on a reply. */
  toggleReplyLike: (entryKey: string, commentTs: number, replyTs: number, user: string) => void;
  /** True while the very first KV fetch is in flight (cache still hydrating) */
  initialLoading: boolean;
  /** Last sync error, if any. Useful for surfacing offline state in the UI. */
  syncError: string | null;
}

const SocialContext = createContext<SocialContextValue | null>(null);

function readCache<T>(key: string): T {
  if (typeof window === 'undefined') return {} as T;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : ({} as T);
  } catch { return {} as T; }
}

function writeCache(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* non-fatal */ }
}

export function entryKeyOf(date: string, name: string): string {
  return `${date}_${name}`;
}

/* ─── Provider (mount once in the root layout) ───────────── */
export function SocialProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useState<EntryReactions>({});
  const [comments, setComments] = useState<CommentsMap>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Entries with an in-flight optimistic reaction. A background refetch must
  // NOT clobber these (otherwise a tap can "vanish" mid-flight — the prod
  // race that made reactions feel broken).
  const pendingReactions = useRef<Set<string>>(new Set());

  // Hydrate from localStorage SYNCHRONOUSLY on mount, then refetch.
  // Every comment goes through hydrateComment() so missing-field records
  // (legacy or partial writes) get padded with empty arrays.
  useEffect(() => {
    setReactions(readCache<EntryReactions>(REACTIONS_KEY));
    const rawComments = readCache<Record<string, unknown[]>>(COMMENTS_KEY);
    const hydrated: CommentsMap = {};
    for (const [k, arr] of Object.entries(rawComments)) {
      if (Array.isArray(arr)) hydrated[k] = arr.map(hydrateComment);
    }
    setComments(hydrated);
  }, []);

  // Background refetch — runs once on mount, on focus, every 30s.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const [r, c] = await Promise.all([fetchEntryReactions(), fetchComments()]);
        if (cancelled) return;
        // Merge server snapshot but preserve any entry with an in-flight
        // optimistic reaction — never overwrite a tap that hasn't settled.
        setReactions(prev => {
          const merged: EntryReactions = { ...r };
          for (const k of pendingReactions.current) {
            if (prev[k]) merged[k] = prev[k];
            else delete merged[k];
          }
          writeCache(REACTIONS_KEY, merged);
          return merged;
        });
        setComments(c);
        writeCache(COMMENTS_KEY, c);
        setSyncError(null);
      } catch (err) {
        // Silent — local cache continues to serve.
        const e = err as ApiError;
        setSyncError(e?.isKvUnavailable ? 'kv-unavailable' : (e?.message ?? 'sync error'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    refresh();
    const onFocus = () => { refresh(); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(refresh, REFETCH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, []);

  /* ── Mutations: optimistic with smart rollback ─────────── */

  const toggleEntryReaction = useCallback((entryKey: string, emoji: string, user: string) => {
    pendingReactions.current.add(entryKey);
    let snapshot: ReactionMap = {};
    setReactions(prev => {
      snapshot = prev[entryKey] ?? {};
      const map = toggleReactionMap(snapshot, emoji, user);
      const optimistic: EntryReactions = { ...prev };
      if (Object.keys(map).length === 0) delete optimistic[entryKey];
      else optimistic[entryKey] = map;
      writeCache(REACTIONS_KEY, optimistic);
      return optimistic;
    });

    toggleEntryReactionRemote(entryKey, emoji, user)
      .then(serverMap => {
        // Server-canonical state wins.
        setReactions(curr => {
          const next: EntryReactions = { ...curr };
          if (Object.keys(serverMap).length === 0) delete next[entryKey];
          else next[entryKey] = serverMap;
          writeCache(REACTIONS_KEY, next);
          return next;
        });
        setSyncError(null);
      })
      .catch((err: ApiError) => {
        // Roll back ONLY on genuine 4xx client errors. For 5xx / network /
        // kv-unavailable, keep the optimistic value (offline-first).
        if (err?.status && err.status >= 400 && err.status < 500) {
          setReactions(curr => {
            const reverted: EntryReactions = { ...curr };
            if (Object.keys(snapshot).length === 0) delete reverted[entryKey];
            else reverted[entryKey] = snapshot;
            writeCache(REACTIONS_KEY, reverted);
            return reverted;
          });
        } else {
          setSyncError(err?.isKvUnavailable ? 'kv-unavailable' : (err?.message ?? 'sync error'));
        }
      })
      .finally(() => { pendingReactions.current.delete(entryKey); });
  }, []);

  // Back-compat: a bare "like" is a ❤️ reaction.
  const toggleLike = useCallback(
    (entryKey: string, user: string) => toggleEntryReaction(entryKey, DEFAULT_REACTION, user),
    [toggleEntryReaction],
  );

  const addComment = useCallback((entryKey: string, comment: Comment) => {
    setComments(prev => {
      const optimistic: CommentsMap = {
        ...prev,
        [entryKey]: [...(prev[entryKey] ?? []), comment],
      };
      writeCache(COMMENTS_KEY, optimistic);
      return optimistic;
    });

    addCommentRemote(entryKey, comment)
      .then(serverArr => {
        setComments(curr => {
          const next: CommentsMap = { ...curr, [entryKey]: serverArr };
          writeCache(COMMENTS_KEY, next);
          return next;
        });
        setSyncError(null);
      })
      .catch((err: ApiError) => {
        if (err?.status && err.status >= 400 && err.status < 500) {
          // Roll back: drop the optimistic comment by its ts.
          setComments(curr => {
            const filtered = (curr[entryKey] ?? []).filter(c => c.ts !== comment.ts);
            const reverted: CommentsMap = { ...curr };
            if (filtered.length === 0) delete reverted[entryKey];
            else reverted[entryKey] = filtered;
            writeCache(COMMENTS_KEY, reverted);
            return reverted;
          });
        } else {
          setSyncError(err?.isKvUnavailable ? 'kv-unavailable' : (err?.message ?? 'sync error'));
        }
      });
  }, []);

  const deleteComment = useCallback((entryKey: string, ts: number, by: string) => {
    let snapshot: Comment[] = [];
    setComments(prev => {
      snapshot = prev[entryKey] ?? [];
      const filtered = snapshot.filter(c => !(c.ts === ts && c.from === by));
      const optimistic: CommentsMap = { ...prev };
      if (filtered.length === 0) delete optimistic[entryKey];
      else optimistic[entryKey] = filtered;
      writeCache(COMMENTS_KEY, optimistic);
      return optimistic;
    });

    deleteCommentRemote(entryKey, ts, by)
      .then(serverArr => {
        setComments(curr => {
          const next: CommentsMap = { ...curr };
          if (serverArr.length === 0) delete next[entryKey];
          else next[entryKey] = serverArr;
          writeCache(COMMENTS_KEY, next);
          return next;
        });
        setSyncError(null);
      })
      .catch((err: ApiError) => {
        if (err?.status && err.status >= 400 && err.status < 500) {
          setComments(curr => {
            const reverted: CommentsMap = { ...curr, [entryKey]: snapshot };
            writeCache(COMMENTS_KEY, reverted);
            return reverted;
          });
        } else {
          setSyncError(err?.isKvUnavailable ? 'kv-unavailable' : (err?.message ?? 'sync error'));
        }
      });
  }, []);

  /* ── Thread mutations (Instagram-style 1-level threading) ── */

  /** Helper: apply a transform to one entry's comments array, optimistically. */
  const mutateEntryComments = (
    entryKey: string,
    transform: (arr: Comment[]) => Comment[],
  ) => {
    let snapshot: Comment[] = [];
    setComments(prev => {
      snapshot = prev[entryKey] ?? [];
      const next = transform(snapshot);
      const out: CommentsMap = { ...prev };
      if (next.length === 0) delete out[entryKey];
      else out[entryKey] = next;
      writeCache(COMMENTS_KEY, out);
      return out;
    });
    return snapshot;
  };

  /** Helper: server response wins. */
  const reconcileEntryComments = (entryKey: string, serverArr: Comment[]) => {
    setComments(curr => {
      const next: CommentsMap = { ...curr };
      if (serverArr.length === 0) delete next[entryKey];
      else next[entryKey] = serverArr;
      writeCache(COMMENTS_KEY, next);
      return next;
    });
  };

  /** Helper: smart rollback (4xx only). For 5xx/network/kv-unavail we keep
   *  optimistic state and surface syncError. */
  const handleMutationError = (
    entryKey: string,
    snapshot: Comment[],
    err: ApiError,
  ) => {
    if (err?.status && err.status >= 400 && err.status < 500) {
      setComments(curr => {
        const reverted: CommentsMap = { ...curr };
        if (snapshot.length === 0) delete reverted[entryKey];
        else reverted[entryKey] = snapshot;
        writeCache(COMMENTS_KEY, reverted);
        return reverted;
      });
    } else {
      setSyncError(err?.isKvUnavailable ? 'kv-unavailable' : (err?.message ?? 'sync error'));
    }
  };

  const addReply = useCallback((entryKey: string, commentTs: number, reply: Reply) => {
    const snapshot = mutateEntryComments(entryKey, arr =>
      arr.map(c => c.ts === commentTs ? { ...c, replies: [...c.replies, reply] } : c),
    );
    replyToCommentRemote(entryKey, commentTs, reply)
      .then(srv => { reconcileEntryComments(entryKey, srv); setSyncError(null); })
      .catch((err: ApiError) => handleMutationError(entryKey, snapshot, err));
  }, []);

  const deleteReply = useCallback((entryKey: string, commentTs: number, replyTs: number, by: string) => {
    const snapshot = mutateEntryComments(entryKey, arr =>
      arr.map(c => c.ts !== commentTs ? c : {
        ...c,
        replies: c.replies.filter(r => !(r.ts === replyTs && r.from === by)),
      }),
    );
    deleteReplyRemote(entryKey, commentTs, replyTs, by)
      .then(srv => { reconcileEntryComments(entryKey, srv); setSyncError(null); })
      .catch((err: ApiError) => handleMutationError(entryKey, snapshot, err));
  }, []);

  const toggleCommentLike = useCallback((entryKey: string, commentTs: number, user: string) => {
    const snapshot = mutateEntryComments(entryKey, arr =>
      arr.map(c => c.ts !== commentTs ? c : {
        ...c,
        likes: c.likes.includes(user)
          ? c.likes.filter(u => u !== user)
          : [...c.likes, user],
      }),
    );
    toggleCommentLikeRemote(entryKey, commentTs, user)
      .then(srv => { reconcileEntryComments(entryKey, srv); setSyncError(null); })
      .catch((err: ApiError) => handleMutationError(entryKey, snapshot, err));
  }, []);

  const toggleReplyLike = useCallback((entryKey: string, commentTs: number, replyTs: number, user: string) => {
    const snapshot = mutateEntryComments(entryKey, arr =>
      arr.map(c => c.ts !== commentTs ? c : {
        ...c,
        replies: c.replies.map(r => r.ts !== replyTs ? r : {
          ...r,
          likes: r.likes.includes(user)
            ? r.likes.filter(u => u !== user)
            : [...r.likes, user],
        }),
      }),
    );
    toggleReplyLikeRemote(entryKey, commentTs, replyTs, user)
      .then(srv => { reconcileEntryComments(entryKey, srv); setSyncError(null); })
      .catch((err: ApiError) => handleMutationError(entryKey, snapshot, err));
  }, []);

  return (
    <SocialContext.Provider value={{
      reactions, comments, toggleEntryReaction, toggleLike, addComment, deleteComment,
      addReply, deleteReply, toggleCommentLike, toggleReplyLike,
      initialLoading, syncError,
    }}>
      {children}
    </SocialContext.Provider>
  );
}

/* ─── Hook (replaces the old self-contained one) ─────────── */
export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    // Safe defaults so unprovided trees don't crash (tests, errors)
    return {
      reactions: {} as EntryReactions,
      comments: {} as CommentsMap,
      toggleEntryReaction: () => {},
      toggleLike: () => {},
      addComment: () => {},
      deleteComment: () => {},
      addReply: () => {},
      deleteReply: () => {},
      toggleCommentLike: () => {},
      toggleReplyLike: () => {},
      initialLoading: false,
      syncError: null as string | null,
      entryReactionsFor: (_k: string) => ({} as ReactionMap),
      likesFor: (_k: string) => [] as string[],
      commentsFor: (_k: string) => [] as Comment[],
    };
  }
  return {
    ...ctx,
    /** Full emoji ReactionMap for an entry. */
    entryReactionsFor: (entryKey: string) => ctx.reactions[entryKey] ?? {},
    /** Back-compat: just the ❤️ reactors for an entry. */
    likesFor: (entryKey: string) => reactorsOf(ctx.reactions[entryKey] ?? {}, DEFAULT_REACTION),
    commentsFor: (entryKey: string) => ctx.comments[entryKey] ?? [],
  };
}
