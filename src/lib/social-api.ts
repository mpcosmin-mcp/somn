/* Thin client for the social API routes. Used by lib/social.ts to
   keep the React hook focused on state. */
'use client';

import type { Comment, LikesMap, CommentsMap } from '@/lib/social';

export interface ApiError extends Error {
  status: number;
  isKvUnavailable: boolean;
}

function buildError(status: number, msg: string, isKvUnavailable = false): ApiError {
  const e = new Error(msg) as ApiError;
  e.status = status;
  e.isKvUnavailable = isKvUnavailable;
  return e;
}

export async function fetchLikes(): Promise<LikesMap> {
  const r = await fetch('/api/social/likes', { cache: 'no-store' });
  const j = (await r.json()) as { likes?: LikesMap; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'fetch failed', j.error === 'kv-unavailable');
  return j.likes ?? {};
}

export async function toggleLikeRemote(entryKey: string, user: string): Promise<string[]> {
  const r = await fetch('/api/social/likes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryKey, user }),
  });
  const j = (await r.json()) as { likes?: string[]; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'toggle failed', j.error === 'kv-unavailable');
  return j.likes ?? [];
}

export async function fetchComments(): Promise<CommentsMap> {
  const r = await fetch('/api/social/comments', { cache: 'no-store' });
  const j = (await r.json()) as { comments?: CommentsMap; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'fetch failed', j.error === 'kv-unavailable');
  return j.comments ?? {};
}

export async function addCommentRemote(entryKey: string, comment: Comment): Promise<Comment[]> {
  const r = await fetch('/api/social/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryKey, comment }),
  });
  const j = (await r.json()) as { comments?: Comment[]; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'add failed', j.error === 'kv-unavailable');
  return j.comments ?? [];
}

export async function deleteCommentRemote(entryKey: string, ts: number, by: string): Promise<Comment[]> {
  const r = await fetch('/api/social/comments', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryKey, ts, by }),
  });
  const j = (await r.json()) as { comments?: Comment[]; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'delete failed', j.error === 'kv-unavailable');
  return j.comments ?? [];
}
