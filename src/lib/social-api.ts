/* Thin client for the social API routes. Used by lib/social.tsx to
   keep the React hook focused on state. */
'use client';

import type { Comment, Reply, LikesMap, CommentsMap } from '@/lib/social';

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

/* ─── Likes (top-level on the sleep entry itself) ───────── */

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

/* ─── Comments + replies (single endpoint, action discriminator) ─── */

export async function fetchComments(): Promise<CommentsMap> {
  const r = await fetch('/api/social/comments', { cache: 'no-store' });
  const j = (await r.json()) as { comments?: CommentsMap; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'fetch failed', j.error === 'kv-unavailable');
  return j.comments ?? {};
}

async function postCommentAction(body: Record<string, unknown>): Promise<Comment[]> {
  const r = await fetch('/api/social/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { comments?: Comment[]; error?: string };
  if (!r.ok) throw buildError(r.status, j.error ?? 'request failed', j.error === 'kv-unavailable');
  return j.comments ?? [];
}

export async function addCommentRemote(entryKey: string, comment: Comment): Promise<Comment[]> {
  return postCommentAction({ action: 'add', entryKey, comment });
}

export async function replyToCommentRemote(
  entryKey: string,
  commentTs: number,
  reply: Reply,
): Promise<Comment[]> {
  return postCommentAction({ action: 'reply', entryKey, commentTs, reply });
}

export async function toggleCommentLikeRemote(
  entryKey: string,
  commentTs: number,
  user: string,
): Promise<Comment[]> {
  return postCommentAction({ action: 'like', entryKey, commentTs, user });
}

export async function toggleReplyLikeRemote(
  entryKey: string,
  commentTs: number,
  replyTs: number,
  user: string,
): Promise<Comment[]> {
  return postCommentAction({ action: 'like', entryKey, commentTs, replyTs, user });
}

export async function deleteCommentRemote(
  entryKey: string,
  ts: number,
  by: string,
): Promise<Comment[]> {
  return postCommentAction({ action: 'delete', entryKey, ts, by });
}

export async function deleteReplyRemote(
  entryKey: string,
  commentTs: number,
  replyTs: number,
  by: string,
): Promise<Comment[]> {
  return postCommentAction({ action: 'delete', entryKey, ts: replyTs, by, parentTs: commentTs });
}
