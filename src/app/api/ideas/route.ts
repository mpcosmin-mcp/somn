import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Ideas / feature-wall storage in Vercel KV.
 *
 * Data shape: Redis hash `ideas` — field = idea id (ts_userInitial), value = JSON Idea
 *
 * Idea lifecycle: new → in-progress → done | rejected. Status is set by anyone
 * (small team — no admin gates for now).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HASH_KEY = 'ideas';

export type IdeaStatus = 'new' | 'wip' | 'done' | 'rejected';

export interface Idea {
  id: string;
  title: string;
  body: string;
  from: string;
  ts: number;
  status: IdeaStatus;
  up: string[];
  down: string[];
}

function kvUnavailable(err: unknown): NextResponse {
  console.error('[/api/ideas] KV unavailable', err);
  return NextResponse.json(
    { error: 'kv-unavailable', ideas: [] },
    { status: 503 },
  );
}

function decode(raw: unknown): Idea | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    return obj as Idea;
  } catch { return null; }
}

export async function GET() {
  try {
    const all = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const ideas: Idea[] = [];
    if (all) {
      for (const v of Object.values(all)) {
        const d = decode(v);
        if (d) ideas.push(d);
      }
    }
    return NextResponse.json({ ideas });
  } catch (err) {
    return kvUnavailable(err);
  }
}

/**
 * POST — three action shapes:
 *   { action: 'create', title, body, from }
 *   { action: 'vote', id, user, dir: 'up'|'down' }   // toggle
 *   { action: 'status', id, status }                 // set/change
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action?: string;
      id?: string;
      title?: string;
      body?: string;
      from?: string;
      user?: string;
      dir?: 'up' | 'down';
      status?: IdeaStatus;
    };

    if (body.action === 'create') {
      const title = (body.title ?? '').trim();
      const bd = (body.body ?? '').trim();
      const from = (body.from ?? '').trim();
      if (!title || !from) return NextResponse.json({ error: 'missing title or from' }, { status: 400 });
      const ts = Date.now();
      const id = `${ts}_${from.slice(0, 3).toLowerCase()}`;
      const idea: Idea = { id, title: title.slice(0, 80), body: bd.slice(0, 500), from, ts, status: 'new', up: [], down: [] };
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(idea) });
      return NextResponse.json({ idea });
    }

    if (body.action === 'vote') {
      const { id, user, dir } = body;
      if (!id || !user || (dir !== 'up' && dir !== 'down')) return NextResponse.json({ error: 'bad vote' }, { status: 400 });
      const cur = decode(await kv.hget(HASH_KEY, id));
      if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
      // Toggle: remove from both sides first, then add if wasn't already there
      const wasInDir = (dir === 'up' ? cur.up : cur.down).includes(user);
      cur.up = cur.up.filter(u => u !== user);
      cur.down = cur.down.filter(u => u !== user);
      if (!wasInDir) (dir === 'up' ? cur.up : cur.down).push(user);
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(cur) });
      return NextResponse.json({ idea: cur });
    }

    if (body.action === 'status') {
      const { id, status } = body;
      if (!id || !status || !['new', 'wip', 'done', 'rejected'].includes(status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
      const cur = decode(await kv.hget(HASH_KEY, id));
      if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
      cur.status = status;
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(cur) });
      return NextResponse.json({ idea: cur });
    }

    if (body.action === 'edit') {
      const { id, user } = body;
      const title = (body.title ?? '').trim();
      const bd = (body.body ?? '').trim();
      if (!id || !user || !title) return NextResponse.json({ error: 'missing id, user or title' }, { status: 400 });
      const cur = decode(await kv.hget(HASH_KEY, id));
      if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
      if (cur.from !== user) return NextResponse.json({ error: 'not owner' }, { status: 403 });
      cur.title = title.slice(0, 80);
      cur.body = bd.slice(0, 500);
      await kv.hset(HASH_KEY, { [id]: JSON.stringify(cur) });
      return NextResponse.json({ idea: cur });
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
