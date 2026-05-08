import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';

/**
 * POST /api/roast
 * Body: { name: string, entries: SleepEntry[] }   // last 7 days for that user
 * Returns: { text: string }                       // 1-2 propoziții, în română
 *
 * AI strategy: Claude Haiku, low max_tokens, focused prompt.
 * Fallback: empty string if API key missing or call fails — UI handles gracefully.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqBody {
  name: string;
  entries: SleepEntry[];
}

export async function POST(req: NextRequest) {
  try {
    const { name, entries } = (await req.json()) as ReqBody;
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ text: '', reason: 'no_api_key' }, { status: 200 });
    }
    if (!name || !entries?.length) {
      return NextResponse.json({ text: '' });
    }

    const mine = entries.filter(e => e.name === name).sort((a, b) => b.date.localeCompare(a.date));
    if (!mine.length) return NextResponse.json({ text: '' });

    const last = mine[0];
    const avg7 = mine.length >= 3 ? Math.round(mine.reduce((s, e) => s + e.ss, 0) / mine.length) : null;
    const firstName = FIRST_NAME[name] ?? name.split(' ')[0];

    const remTxt = last.rem != null ? `${last.rem} min REM` : 'fără REM înregistrat';
    const hrvTxt = last.hrv != null ? `${last.hrv} HRV` : 'fără HRV';
    const avgTxt = avg7 != null ? `media ultimelor ${mine.length} zile: SS ${avg7}` : 'date insuficiente';

    const prompt = `Ești un narator amuzant pentru un dashboard de somn al unei echipe IT din Sibiu. Trei prieteni care își țin somnul la mișto: Clara, Petrica, Cornel. Toți programatori, le place sportul, mâncatul sănătos, AI-ul.

Datele lui ${firstName} pentru ultima noapte: SS ${last.ss}, RHR ${last.rhr}, ${remTxt}, ${hrvTxt}.
Context: ${avgTxt}.

Scrie UN singur comentariu de 1-2 propoziții scurte despre cum a dormit ${firstName} aseară. În română. Ton: prieten care îl ironizează cu drag, dar cu info utilă (gen: alcool/sport târziu strică REM, etc). Folosește informația concretă, nu fii generic. Fără emoji, fără fluff. Răspunde DOAR cu textul, nimic altceva.`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    return NextResponse.json({ text });
  } catch (err) {
    console.error('[/api/roast]', err);
    return NextResponse.json({ text: '', error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
