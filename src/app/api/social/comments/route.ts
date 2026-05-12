import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Comments storage in Vercel KV (Upstash Redis), Instagram-style 1-level
 * threading.
 *
 * Data shape (per entry):
 *   Redis hash `social:comments`
 *     field = entryKey (`${date}_${name}`)
 *     value = JSON-stringified `Comment[]` where Comment = {
 *       from, ts, text, likes: string[], replies: Reply[]
 *     } and Reply = { from, ts, text, likes: string[] }.
 *
 * Backward compatibility: old records (pre-threading) lack `likes` and
 * `replies` fields. The decoder pads them with empty arrays on read.
 *
 * The POST endpoint accepts an `action` body field to discriminate between:
 *   - 'add'    (default if action is missing) → append a top-level comment
 *   - 'reply'  → append a reply to commentTs
 *   - 'like'   → toggle like on commentTs or its replyTs
 *   - 'delete' → remove a comment OR a reply (parentTs distinguishes)
 *
 * The legacy DELETE method is kept for back-compat with older clients.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'social:comments';

interface Reply {
  from: string;
  ts: number;
  text: string;
  likes: string[];
}

interface Comment {
  from: string;
  ts: number;
  text: string;
  likes: string[];
  replies: Reply[];
}

type CommentsMap = Record<string, Comment[]>;

/** Pad legacy records with defaults so the rest of the code can treat
 *  every record as fully-typed. */
function hydrateReply(raw: unknown): Reply {
  const r = (raw ?? {}) as Partial<Reply>;
  return {
    from: r.from ?? '',
    ts: typeof r.ts === 'number' ? r.ts : 0,
    text: r.text ?? '',
    likes: Array.isArray(r.likes) ? r.likes : [],
  };
}

function hydrateComment(raw: unknown): Comment {
  const r = (raw ?? {}) as Partial<Comment>;
  return {
    from: r.from ?? '',
    ts: typeof r.ts === 'number' ? r.ts : 0,
    text: r.text ?? '',
    likes: Array.isArray(r.likes) ? r.likes : [],
    replies: Array.isArray(r.replies) ? r.replies.map(hydrateReply) : [],
  };
}

function decodeComments(raw: unknown): Comment[] {
  if (Array.isArray(raw)) return raw.map(hydrateComment);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(hydrateComment) : [];
    } catch { return []; }
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

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: 'bad-request', message }, { status: 400 });
}

/** Persist a comments array for an entry, deleting the hash field if the
 *  array is empty. Returns the array. */
async function persist(entryKey: string, arr: Comment[]): Promise<Comment[]> {
  if (arr.length === 0) {
    await kv.hdel(HASH_KEY, entryKey);
  } else {
    await kv.hset(HASH_KEY, { [entryKey]: JSON.stringify(arr) });
  }
  return arr;
}

/* ─── GET — full comments map ──────────────────────────────── */
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

/* ─── POST — action discriminator ──────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: 'add' | 'reply' | 'like' | 'delete';
      entryKey?: string;
      // 'add'
      comment?: Partial<Comment>;
      // 'reply'
      commentTs?: number;
      reply?: Partial<Reply>;
      // 'like'
      user?: string;
      replyTs?: number;
      // 'delete'
      ts?: number;
      by?: string;
      parentTs?: number;
    };

    const action = body.action ?? 'add';
    const entryKey = body.entryKey;
    if (!entryKey) return badRequest('missing entryKey');

    const current = decodeComments(await kv.hget(HASH_KEY, entryKey));

    switch (action) {
      case 'add': {
        const c = body.comment;
        if (!c?.from || !c?.text) return badRequest('missing comment.from or .text');
        const newComment: Comment = {
          from: c.from.slice(0, 100),
          ts: c.ts ?? Date.now(),
          text: c.text.slice(0, 500).trim(),
          likes: [],
          replies: [],
        };
        if (!newComment.text) return badRequest('empty text');
        const next = [...current, newComment];
        return NextResponse.json({ entryKey, comments: await persist(entryKey, next) });
      }

      case 'reply': {
        if (body.commentTs == null) return badRequest('missing commentTs');
        const r = body.reply;
        if (!r?.from || !r?.text) return badRequest('missing reply.from or .text');
        const newReply: Reply = {
          from: r.from.slice(0, 100),
          ts: r.ts ?? Date.now(),
          text: r.text.slice(0, 500).trim(),
          likes: [],
        };
        if (!newReply.text) return badRequest('empty reply text');
        const next = current.map(c => c.ts === body.commentTs
          ? { ...c, replies: [...c.replies, newReply] }
          : c);
        return NextResponse.json({ entryKey, comments: await persist(entryKey, next) });
      }

      case 'like': {
        if (body.commentTs == null) return badRequest('missing commentTs');
        if (!body.user) return badRequest('missing user');
        const user = body.user;
        const isReplyLike = body.replyTs != null;
        const next = current.map(c => {
          if (c.ts !== body.commentTs) return c;
          if (isReplyLike) {
            return {
              ...c,
              replies: c.replies.map(r => r.ts !== body.replyTs ? r : {
                ...r,
                likes: r.likes.includes(user) ? r.likes.filter(u => u !== user) : [...r.likes, user],
              }),
            };
          }
          return {
            ...c,
            likes: c.likes.includes(user) ? c.likes.filter(u => u !== user) : [...c.likes, user],
          };
        });
        return NextResponse.json({ entryKey, comments: await persist(entryKey, next) });
      }

      case 'delete': {
        if (body.ts == null || !body.by) return badRequest('missing ts or by');
        let next: Comment[];
        if (body.parentTs != null) {
          // Delete a reply under parentTs
          next = current.map(c => c.ts !== body.parentTs ? c : {
            ...c,
            replies: c.replies.filter(r => !(r.ts === body.ts && r.from === body.by)),
          });
        } else {
          // Delete a top-level comment
          next = current.filter(c => !(c.ts === body.ts && c.from === body.by));
        }
        return NextResponse.json({ entryKey, comments: await persist(entryKey, next) });
      }

      default:
        return badRequest(`unknown action: ${action}`);
    }
  } catch (err) {
    return kvUnavailable(err);
  }
}

/* ─── DELETE (legacy method — top-level only) ──────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { entryKey?: string; ts?: number; by?: string };
    const { entryKey, ts, by } = body;
    if (!entryKey || ts == null || !by) return badRequest('missing entryKey, ts, or by');
    const current = decodeComments(await kv.hget(HASH_KEY, entryKey));
    const next = current.filter(c => !(c.ts === ts && c.from === by));
    return NextResponse.json({ entryKey, comments: await persist(entryKey, next) });
  } catch (err) {
    return kvUnavailable(err);
  }
}
