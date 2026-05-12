import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Likes storage in Vercel KV (Upstash Redis).
 *
 * Data shape:
 *   Redis hash `social:likes`
 *     field   = entryKey (`${date}_${name}`)
 *     value   = JSON-stringified `string[]` — list of users who liked that entry
 *
 * Reading the whole map costs ONE HGETALL — perfect for the dashboard
 * initial load (single round-trip).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'social:likes';

type LikesMap = Record<string, string[]>;

/** Decode a value coming back from KV — Upstash sometimes returns already-parsed
 *  objects and sometimes raw strings depending on the client wrapper. Be tolerant. */
function decodeLikes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function kvUnavailable(err: unknown): NextResponse {
  console.error('[/api/social/likes] KV unavailable', err);
  return NextResponse.json(
    { error: 'kv-unavailable', message: 'Vercel KV not configured. See SOCIAL_SYNC.md.', likes: {} },
    { status: 503 },
  );
}

/** GET — return the full likes map */
export async function GET() {
  try {
    const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const out: LikesMap = {};
    if (all) {
      for (const [k, v] of Object.entries(all)) {
        out[k] = decodeLikes(v);
      }
    }
    return NextResponse.json({ likes: out });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/** POST { entryKey, user } — toggle a like, return the new state for that entry */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { entryKey?: string; user?: string };
    const { entryKey, user } = body;
    if (!entryKey || !user) {
      return NextResponse.json({ error: 'missing entryKey or user' }, { status: 400 });
    }

    // Read-modify-write. For our 3-user scale, race risk is negligible.
    const current = await kv.hget(HASH_KEY, entryKey);
    const arr = decodeLikes(current);
    const next = arr.includes(user)
      ? arr.filter(u => u !== user)
      : [...arr, user];

    if (next.length === 0) {
      await kv.hdel(HASH_KEY, entryKey);
    } else {
      await kv.hset(HASH_KEY, { [entryKey]: JSON.stringify(next) });
    }

    return NextResponse.json({ entryKey, likes: next });
  } catch (err) {
    return kvUnavailable(err);
  }
}
