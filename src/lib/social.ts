'use client';
import { useCallback, useEffect, useState } from 'react';

/* ─── Social layer (likes + comments) ─────────────────────
 *
 * Storage v1: localStorage only — per-device, not yet synced
 * across users. Each user sees their own reactions to the team's
 * journals.
 *
 * Migration path (when Apps Script gains social handlers):
 *   - Keep the same data shape on the server (entryKey → likes[], comments[])
 *   - Swap useSocial() to read/write through /api/social instead of localStorage
 *   - Add cache + invalidation like we did for entries
 *
 * entryKey = `${date}_${name}` — uniquely identifies a sleep log row.
 */

const LIKES_KEY    = 'somn_likes_v1';
const COMMENTS_KEY = 'somn_comments_v1';
const SOCIAL_EVENT = 'somn-social-change';

export interface Comment {
  /** Name of the commenter */
  from: string;
  /** Unix ms — used as a stable id within an entry's comment thread */
  ts: number;
  text: string;
}

export type LikesMap    = Record<string, string[]>;        // entryKey → [user, ...]
export type CommentsMap = Record<string, Comment[]>;       // entryKey → comments

function readMap<T>(key: string): T {
  if (typeof window === 'undefined') return {} as T;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : {} as T;
  } catch { return {} as T; }
}

function writeMap(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event(SOCIAL_EVENT));
  } catch { /* quota or unavailable — non-fatal */ }
}

export function entryKeyOf(date: string, name: string): string {
  return `${date}_${name}`;
}

/** Hook used by any social UI to read + mutate reactions. */
export function useSocial() {
  const [likes, setLikes] = useState<LikesMap>({});
  const [comments, setComments] = useState<CommentsMap>({});

  // Hydrate from localStorage + listen for cross-component updates
  useEffect(() => {
    const sync = () => {
      setLikes(readMap<LikesMap>(LIKES_KEY));
      setComments(readMap<CommentsMap>(COMMENTS_KEY));
    };
    sync();
    window.addEventListener(SOCIAL_EVENT, sync);
    // also react to other tabs (same origin)
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SOCIAL_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleLike = useCallback((entryKey: string, user: string) => {
    setLikes(prev => {
      const arr = prev[entryKey] ?? [];
      const next: LikesMap = arr.includes(user)
        ? { ...prev, [entryKey]: arr.filter(u => u !== user) }
        : { ...prev, [entryKey]: [...arr, user] };
      // Clean up empty arrays so the map doesn't grow unbounded
      if (next[entryKey].length === 0) delete next[entryKey];
      writeMap(LIKES_KEY, next);
      return next;
    });
  }, []);

  const addComment = useCallback((entryKey: string, comment: Comment) => {
    setComments(prev => {
      const arr = prev[entryKey] ?? [];
      const next: CommentsMap = { ...prev, [entryKey]: [...arr, comment] };
      writeMap(COMMENTS_KEY, next);
      return next;
    });
  }, []);

  const deleteComment = useCallback((entryKey: string, ts: number, by: string) => {
    setComments(prev => {
      const arr = prev[entryKey] ?? [];
      const filtered = arr.filter(c => !(c.ts === ts && c.from === by));
      const next: CommentsMap = { ...prev };
      if (filtered.length === 0) delete next[entryKey];
      else next[entryKey] = filtered;
      writeMap(COMMENTS_KEY, next);
      return next;
    });
  }, []);

  const likesFor = useCallback(
    (entryKey: string): string[] => likes[entryKey] ?? [],
    [likes],
  );
  const commentsFor = useCallback(
    (entryKey: string): Comment[] => comments[entryKey] ?? [],
    [comments],
  );

  return { toggleLike, addComment, deleteComment, likesFor, commentsFor };
}
