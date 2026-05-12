'use client';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import {
  fetchLikes, toggleLikeRemote,
  fetchComments, addCommentRemote, deleteCommentRemote,
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
const COMMENTS_KEY = 'somn_comments_v2';
const REFETCH_INTERVAL_MS = 30_000;

export interface Comment {
  from: string;
  ts: number;
  text: string;
}

export type LikesMap    = Record<string, string[]>;
export type CommentsMap = Record<string, Comment[]>;

interface SocialContextValue {
  likes: LikesMap;
  comments: CommentsMap;
  toggleLike: (entryKey: string, user: string) => void;
  addComment: (entryKey: string, comment: Comment) => void;
  deleteComment: (entryKey: string, ts: number, by: string) => void;
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
  useEffect(() => {
    setLikes(readCache<LikesMap>(LIKES_KEY));
    setComments(readCache<CommentsMap>(COMMENTS_KEY));
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

  return (
    <SocialContext.Provider value={{
      likes, comments, toggleLike, addComment, deleteComment,
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
