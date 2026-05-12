import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Comments storage in Vercel KV (Upstash Redis).
 *
 * Data shape:
 *   Redis hash `social:comments`
 *     field   = entryKey (`${date}_${name}`)
 *     value   = JSON-stringified `Comment[]`
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'social:comments';

interface Comment {
  from: string;
  ts: number;
  text: string;
}

type CommentsMap = Record<string, Comment[]>;

function decodeComments(raw: unknown): Comment[] {
  if (Array.isArray(raw)) return raw as Comment[];
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function kvUnavailable(err: unknown): NextResponse {
  console.error('[/api/social/comments] KV unavailable', err);
  return NextResponse.json(
    { error: 'kv-unavailable', message: 'Vercel KV not configured. See SOCIAL_SYNC.md.', comments: {} },
    { status: 503 },
  );
}

/** GET — return the full comments map */
export async function GET() {
  try {
    const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const out: CommentsMap = {};
    if (all) {
      for (const [k, v] of Object.entries(all)) {
        out[k] = decodeComments(v);
      }
    }
    return NextResponse.json({ comments: out });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/** POST { entryKey, comment } — append a comment, return the new thread */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { entryKey?: string; comment?: Partial<Comment> };
    const { entryKey, comment } = body;
    if (!entryKey || !comment?.from || !comment?.text) {
      return NextResponse.json({ error: 'missing entryKey, from, or text' }, { status: 400 });
    }
    const sanitized: Comment = {
      from: comment.from.slice(0, 100),
      ts: comment.ts ?? Date.now(),
      text: comment.text.slice(0, 500).trim(),
    };
    if (!sanitized.text) {
      return NextResponse.json({ error: 'empty text after trim' }, { status: 400 });
    }

    const current = await kv.hget(HASH_KEY, entryKey);
    const arr = decodeComments(current);
    const next = [...arr, sanitized];
    await kv.hset(HASH_KEY, { [entryKey]: JSON.stringify(next) });

    return NextResponse.json({ entryKey, comments: next });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/** DELETE { entryKey, ts, by } — remove a comment by (ts, from) */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { entryKey?: string; ts?: number; by?: string };
    const { entryKey, ts, by } = body;
    if (!entryKey || ts == null || !by) {
      return NextResponse.json({ error: 'missing entryKey, ts, or by' }, { status: 400 });
    }

    const current = await kv.hget(HASH_KEY, entryKey);
    const arr = decodeComments(current);
    const next = arr.filter(c => !(c.ts === ts && c.from === by));

    if (next.length === 0) {
      await kv.hdel(HASH_KEY, entryKey);
    } else {
      await kv.hset(HASH_KEY, { [entryKey]: JSON.stringify(next) });
    }

    return NextResponse.json({ entryKey, comments: next });
  } catch (err) {
    return kvUnavailable(err);
  }
}
