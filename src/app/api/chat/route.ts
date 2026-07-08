import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Team chat — persistent room, one channel for now.
 *
 * Storage: Redis hash `chat` — field = message id (ts_userInitial),
 * value = JSON-stringified ChatMessage. Bounded at MAX_MESSAGES on write
 * (oldest trimmed) so unbounded history doesn't balloon the KV cost.
 *
 * Mirrors the ideas route pattern: hash-of-json, action-less GET, small
 * POST discriminator. No orchestrator, no server-side per-user state —
 * clients track "last-seen ts" in localStorage for unread counts.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'chat';
const MAX_MESSAGES = 500;

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  ts: number;
  reactions?: Record<string, string[]>; // emoji → users
}

function decode(raw: unknown): ChatMessage | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    return obj as ChatMessage;
  } catch { return null; }
}

function kvUnavailable(err: unknown): NextResponse {
  console.error('[/api/chat] KV unavailable', err);
  return NextResponse.json(
    { error: 'kv-unavailable', messages: [] },
    { status: 503 },
  );
}

async function loadAll(): Promise<ChatMessage[]> {
  const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
  const out: ChatMessage[] = [];
  if (all) {
    for (const v of Object.values(all)) {
      const d = decode(v);
      if (d) out.push(d);
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

export async function GET() {
  try {
    const messages = await loadAll();
    return NextResponse.json({ messages });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/**
 * POST — two actions:
 *   { action: 'send', text, from }
 *   { action: 'react', id, emoji, user }   // toggle
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: string;
      text?: string;
      from?: string;
      id?: string;
      emoji?: string;
      user?: string;
    };

    if (body.action === 'send') {
      const text = (body.text ?? '').trim();
      const from = (body.from ?? '').trim();
      if (!text || !from) return NextResponse.json({ error: 'missing text or from' }, { status: 400 });
      if (text.length > 500) return NextResponse.json({ error: 'too long' }, { status: 400 });

      const ts = Date.now();
      const id = `${ts}_${from.slice(0, 3).toLowerCase()}`;
      const msg: ChatMessage = { id, from, text, ts };
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(msg) });

      // Trim to MAX_MESSAGES — cheapest way is to peek the whole hash
      // once every 20 writes. Keeps growth bounded without an rpop-style
      // sorted-set migration.
      if (Math.random() < 0.05) {
        const all = await loadAll();
        if (all.length > MAX_MESSAGES) {
          const drop = all.slice(0, all.length - MAX_MESSAGES);
          await kv.hdel(HASH_KEY, ...drop.map(m => m.id));
        }
      }

      return NextResponse.json({ message: msg });
    }

    if (body.action === 'react') {
      const { id, emoji, user } = body;
      if (!id || !emoji || !user) return NextResponse.json({ error: 'missing id, emoji or user' }, { status: 400 });
      const cur = decode(await kv.hget(HASH_KEY, id));
      if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
      const reactions = cur.reactions ?? {};
      const users = reactions[emoji] ?? [];
      const i = users.indexOf(user);
      if (i >= 0) users.splice(i, 1);
      else users.push(user);
      if (users.length) reactions[emoji] = users;
      else delete reactions[emoji];
      cur.reactions = reactions;
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(cur) });
      return NextResponse.json({ message: cur });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return kvUnavailable(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, user } = await req.json() as { id?: string; user?: string };
    if (!id || !user) return NextResponse.json({ error: 'missing id or user' }, { status: 400 });
    const cur = decode(await kv.hget(HASH_KEY, id));
    if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (cur.from !== user) return NextResponse.json({ error: 'not owner' }, { status: 403 });
    await kv.hdel(HASH_KEY, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return kvUnavailable(err);
  }
}
