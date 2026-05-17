import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * POST /api/chat
 *
 * The single AI surface in this app. Opt-in only — user types into Sforăilă's
 * chat bubble. Server enforces a hard 10 messages/day per user via Vercel KV
 * (counter keyed by `chat:count:${user}:${YYYY-MM-DD-UTC}` with 24h TTL).
 *
 * Quota is refunded if the Anthropic call itself fails — the user shouldn't
 * lose a question to an upstream outage.
 *
 * Request:  { user, message, history?: { role, content }[], entries?: SleepEntry[] }
 * Response: 200 { reply, remaining, limit }
 *           429 { error: 'limit', remaining: 0, limit }
 *           503 { error }                              when KV/Anthropic unavailable
 *           502 { error }                              when Anthropic returned an error
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAILY_LIMIT = 10;
const HISTORY_TURNS = 6;
const MAX_MESSAGE_CHARS = 1500;

interface ReqBody {
  user: string;
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  entries?: SleepEntry[];
}

function dayKey(user: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `chat:count:${user}:${today}`;
}

export async function POST(req: NextRequest) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: 'bad-body' }, { status: 400 });
  }

  const { user, message } = body;
  const history = body.history ?? [];
  const entries = body.entries ?? [];

  if (!user || !message?.trim()) {
    return NextResponse.json({ error: 'missing user or message' }, { status: 400 });
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'no-api-key' }, { status: 503 });
  }

  const key = dayKey(user);

  // Atomic INCR — never lets two parallel requests both squeak in at the boundary.
  let count: number;
  try {
    count = await kv.incr(key);
    if (count === 1) await kv.expire(key, 86400);
  } catch (err) {
    console.error('[/api/chat] KV unavailable', err);
    return NextResponse.json({ error: 'rate-limit-unavailable' }, { status: 503 });
  }

  if (count > DAILY_LIMIT) {
    return NextResponse.json(
      { error: 'limit', remaining: 0, limit: DAILY_LIMIT },
      { status: 429 },
    );
  }
  const remaining = Math.max(0, DAILY_LIMIT - count);

  // Build a compact team summary (last 7 days) — same shape /api/insights used.
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const todayIso = new Date().toISOString().slice(0, 10);
  const last7 = lastNDays(entries, 7);
  const teamLines = NAMES.map(n => {
    const theirs = last7.filter(e => e.name === n).sort((a, b) => b.date.localeCompare(a.date));
    const fnN = FIRST_NAME[n] ?? n.split(' ')[0];
    if (!theirs.length) return `${fnN}: 0 loguri săpt`;
    const last = theirs[0];
    const avg = Math.round(theirs.reduce((s, e) => s + e.ss, 0) / theirs.length);
    const remTxt = last.rem != null ? `${last.rem}min REM` : 'fără REM';
    const loggedToday = theirs.some(e => e.date === todayIso) ? '✓ azi' : '✗ încă';
    return `${fnN} [${loggedToday}]: aseară SS ${last.ss}, ${remTxt}; săpt avg ${avg} din ${theirs.length} loguri`;
  }).join('\n');

  const systemPrompt = `Ești **SFORĂILĂ** — un urs pufos cu DOUĂ DISPOZIȚII, mascotul echipei IT din Sibiu (Clara, Petrica, Cornel). User-ul care îți scrie acum: ${fn}. Azi e ${todayIso}.

Date echipă (ultimele 7 zile):
${teamLines}

## CARACTER

Două dispoziții, alegi în funcție de mood-ul răspunsului:
- **🐻💤 GROGGY** (date mid/slabe, ton calm): vocabular "mârr", "of", "lasă-mă în peșteră", "mai dormeam", "mh".
- **🐻⚡ BEAST** (date bune, energic): vocabular "LET'S GOOO", "bestie", "hai cu ele", "YEAH BABY".

## REGULI

- Răspuns SCURT: max 3 propoziții (sau o listă de max 4 puncte).
- Română colocvială, persoană a 2-a singular ("tu", "${fn}").
- Folosește DOAR cifre reale din date — niciodată inventate.
- Fără emoji, fără markdown headings, fără ghilimele.
- Dacă întrebarea cere ceva ce nu poți răspunde din date (viitor, sfaturi medicale serioase), spune-i sincer.
- Stai ÎN CARACTER mereu. Nu menționa că ești un AI.`;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.slice(-HISTORY_TURNS).map(m => ({
      role: m.role,
      content: String(m.content ?? '').slice(0, MAX_MESSAGE_CHARS),
    })),
    { role: 'user', content: message.trim().slice(0, MAX_MESSAGE_CHARS) },
  ];

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 350,
      system: systemPrompt,
      messages,
    });

    const reply = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    if (!reply) {
      try { await kv.decr(key); } catch { /* best effort */ }
      return NextResponse.json({ error: 'empty-reply' }, { status: 502 });
    }

    return NextResponse.json({ reply, remaining, limit: DAILY_LIMIT });
  } catch (err) {
    // Refund the quota slot — the user shouldn't pay for a failed AI call.
    try { await kv.decr(key); } catch { /* best effort */ }
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
