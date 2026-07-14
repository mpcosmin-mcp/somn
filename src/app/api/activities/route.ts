import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { ARIA_SCHEDULE, bookingKey } from '@/lib/activities';
import { NAMES } from '@/lib/sleep';

/**
 * Aria activity bookings — who's going to which class.
 *
 * Storage: Redis hash `activities:bookings`, field = `activityId:date`,
 * value = JSON string[] of names. Same hash-of-json pattern as ideas/social.
 * An empty list deletes the field so the hash doesn't fill with `[]`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'activities:bookings';

function decodeNames(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch { return []; }
  }
  return [];
}

function kvReady(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function unavailable() {
  return NextResponse.json({ error: 'kv-unavailable', bookings: {} }, { status: 503 });
}

export async function GET() {
  if (!kvReady()) return unavailable();
  try {
    const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const bookings: Record<string, string[]> = {};
    if (all) for (const [k, v] of Object.entries(all)) bookings[k] = decodeNames(v);
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('[/api/activities GET]', err);
    return unavailable();
  }
}

export async function POST(req: NextRequest) {
  if (!kvReady()) return unavailable();
  try {
    const { activityId, date, user, action } = (await req.json()) as {
      activityId?: string; date?: string; user?: string; action?: 'book' | 'unbook';
    };
    if (!activityId || !date || !user || !action) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }
    // Only the three known players can book — `user` is a free string from the
    // client, so validate it against the roster (no auth exists in this app).
    if (!NAMES.includes(user as (typeof NAMES)[number])) {
      return NextResponse.json({ error: 'unknown user' }, { status: 400 });
    }
    const activity = ARIA_SCHEDULE.find(a => a.id === activityId);
    if (!activity) {
      return NextResponse.json({ error: 'unknown activity' }, { status: 400 });
    }

    const field = bookingKey(activityId, date);
    const current = decodeNames(await kv.hget(HASH_KEY, field));

    if (action === 'book') {
      if (current.includes(user)) return NextResponse.json({ field, names: current });
      if (current.length >= activity.capacity) {
        return NextResponse.json({ error: 'full', field, names: current }, { status: 409 });
      }
      const next = [...current, user];
      await kv.hset(HASH_KEY, { [field]: JSON.stringify(next) });
      return NextResponse.json({ field, names: next });
    }

    // unbook — drop the field entirely when it empties out
    const next = current.filter(n => n !== user);
    if (next.length === 0) await kv.hdel(HASH_KEY, field);
    else await kv.hset(HASH_KEY, { [field]: JSON.stringify(next) });
    return NextResponse.json({ field, names: next });
  } catch (err) {
    console.error('[/api/activities POST]', err);
    return unavailable();
  }
}
