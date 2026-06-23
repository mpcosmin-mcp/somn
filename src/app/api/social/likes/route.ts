import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
  type ReactionMap,
  DEFAULT_REACTION,
  isReactionEmoji,
  normalizeReactions,
  toggleReaction,
} from '@/lib/reactions';

/**
 * Entry reactions storage in Vercel KV (Upstash Redis).
 *
 * Data shape:
 *   Redis hash `social:likes`
 *     field = entryKey (`${date}_${name}`)
 *     value = JSON-stringified `ReactionMap` (`emoji → string[]`)
 *
 * Back-compat: this hash used to hold a bare `string[]` (the old
 * heart-only "likes"). `normalizeReactions` upgrades any legacy array
 * to `{ '❤️': arr }` on read — no migration job needed; old hearts just
 * show up as ❤️ reactions. The hash key stays `social:likes` so existing
 * production data is reused in place.
 *
 * Reading the whole map costs ONE HGETALL — perfect for the dashboard
 * initial load (single round-trip).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'social:likes';

type ReactionsByEntry = Record<string, ReactionMap>;

function kvUnavailable(err: unknown): NextResponse {
  console.error('[/api/social/likes] KV unavailable', err);
  return NextResponse.json(
    { error: 'kv-unavailable', message: 'Vercel KV not configured. See SOCIAL_SYNC.md.', reactions: {} },
    { status: 503 },
  );
}

/** Decode a raw KV field value (may be an already-parsed object/array or a
 *  JSON string) into a normalized ReactionMap. */
function decode(raw: unknown): ReactionMap {
  if (typeof raw === 'string') {
    try { return normalizeReactions(JSON.parse(raw)); }
    catch { return {}; }
  }
  return normalizeReactions(raw);
}

/** Persist a ReactionMap for an entry, deleting the field if empty. */
async function persist(entryKey: string, map: ReactionMap): Promise<ReactionMap> {
  if (Object.keys(map).length === 0) {
    await kv.hdel(HASH_KEY, entryKey);
  } else {
    await kv.hset(HASH_KEY, { [entryKey]: JSON.stringify(map) });
  }
  return map;
}

/** GET — return the full reactions map (entryKey → ReactionMap) */
export async function GET() {
  try {
    const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const out: ReactionsByEntry = {};
    if (all) {
      for (const [k, v] of Object.entries(all)) {
        const map = decode(v);
        if (Object.keys(map).length) out[k] = map;
      }
    }
    return NextResponse.json({ reactions: out });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/**
 * POST { entryKey, user, emoji? } — toggle one emoji reaction for a user on
 * an entry. `emoji` defaults to ❤️ (so a bare like still works). Returns the
 * new ReactionMap for that entry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { entryKey?: string; user?: string; emoji?: string };
    const { entryKey, user } = body;
    const emoji = body.emoji ?? DEFAULT_REACTION;
    if (!entryKey || !user) {
      return NextResponse.json({ error: 'missing entryKey or user' }, { status: 400 });
    }
    if (!isReactionEmoji(emoji)) {
      return NextResponse.json({ error: 'invalid emoji' }, { status: 400 });
    }

    // Read-modify-write. For our 3-user scale, race risk is negligible.
    const current = decode(await kv.hget(HASH_KEY, entryKey));
    const next = toggleReaction(current, emoji, user);

    return NextResponse.json({ entryKey, reactions: await persist(entryKey, next) });
  } catch (err) {
    return kvUnavailable(err);
  }
}
