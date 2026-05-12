'use client';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import {
  fetchLikes, toggleLikeRemote,
  fetchComments, addCommentRemote, deleteCommentRemote,
  replyToCommentRemote, toggleCommentLikeRemote, toggleReplyLikeRemote,
  deleteReplyRemote,
  type ApiError,
} from '@/lib/social-api';

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

const LIKES_KEY    = 'somn_likes_v2';
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

export type LikesMap    = Record<string, string[]>;
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
  likes: LikesMap;
  comments: CommentsMap;
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
  const [likes, setLikes] = useState<LikesMap>({});
  const [comments, setComments] = useState<CommentsMap>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Hydrate from localStorage SYNCHRONOUSLY on mount, then refetch.
  // Every comment goes through hydrateComment() so missing-field records
  // (legacy or partial writes) get padded with empty arrays.
  useEffect(() => {
    setLikes(readCache<LikesMap>(LIKES_KEY));
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
        const [l, c] = await Promise.all([fetchLikes(), fetchComments()]);
        if (cancelled) return;
        setLikes(l);
        setComments(c);
        writeCache(LIKES_KEY, l);
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

  const toggleLike = useCallback((entryKey: string, user: string) => {
    let snapshot: string[] = [];
    setLikes(prev => {
      snapshot = prev[entryKey] ?? [];
      const optimistic: LikesMap = snapshot.includes(user)
        ? { ...prev, [entryKey]: snapshot.filter(u => u !== user) }
        : { ...prev, [entryKey]: [...snapshot, user] };
      if (optimistic[entryKey].length === 0) delete optimistic[entryKey];
      writeCache(LIKES_KEY, optimistic);
      return optimistic;
    });

    toggleLikeRemote(entryKey, user)
      .then(serverArr => {
        // Server-canonical state wins.
        setLikes(curr => {
          const next: LikesMap = { ...curr };
          if (serverArr.length === 0) delete next[entryKey];
          else next[entryKey] = serverArr;
          writeCache(LIKES_KEY, next);
          return next;
        });
        setSyncError(null);
      })
      .catch((err: ApiError) => {
        // Roll back ONLY on genuine 4xx client errors. For 5xx / network /
        // kv-unavailable, keep the optimistic value (offline-first).
        if (err?.status && err.status >= 400 && err.status < 500) {
          setLikes(curr => {
            const reverted: LikesMap = { ...curr };
            if (snapshot.length === 0) delete reverted[entryKey];
            else reverted[entryKey] = snapshot;
            writeCache(LIKES_KEY, reverted);
            return reverted;
          });
        } else {
          setSyncError(err?.isKvUnavailable ? 'kv-unavailable' : (err?.message ?? 'sync error'));
        }
      });
  }, []);

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
      likes, comments, toggleLike, addComment, deleteComment,
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
      likes: {} as LikesMap,
      comments: {} as CommentsMap,
      toggleLike: () => {},
      addComment: () => {},
      deleteComment: () => {},
      addReply: () => {},
      deleteReply: () => {},
      toggleCommentLike: () => {},
      toggleReplyLike: () => {},
      initialLoading: false,
      syncError: null as string | null,
      likesFor: (_k: string) => [] as string[],
      commentsFor: (_k: string) => [] as Comment[],
    };
  }
  return {
    ...ctx,
    likesFor: (entryKey: string) => ctx.likes[entryKey] ?? [],
    commentsFor: (entryKey: string) => ctx.comments[entryKey] ?? [],
  };
}
