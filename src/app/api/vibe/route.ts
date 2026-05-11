import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * POST /api/vibe
 * Body: { user: string, entries: SleepEntry[] }
 * Returns: { text: string }
 *
 * The "overall vibe" line that sits at the top of the dashboard.
 * Short (2 sentences), playful, references current user + team.
 * Cached client-side per (user, last-date).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { user, entries } = (await req.json()) as { user: string; entries: SleepEntry[] };
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ text: '' });
    if (!user || !entries?.length) return NextResponse.json({ text: '' });

    const fn = FIRST_NAME[user] ?? user.split(' ')[0];
    const last7 = lastNDays(entries, 7);

    const lines = NAMES.map(n => {
      const theirs = last7.filter(e => e.name === n).sort((a, b) => b.date.localeCompare(a.date));
      const fnN = FIRST_NAME[n] ?? n.split(' ')[0];
      if (!theirs.length) return `${fnN}: 0 loguri săpt`;
      const last = theirs[0];
      const avg = Math.round(theirs.reduce((s, e) => s + e.ss, 0) / theirs.length);
      const remTxt = last.rem != null ? `${last.rem}min REM` : 'fără REM';
      return `${fnN}: aseară SS ${last.ss}, ${remTxt}; săpt avg ${avg}`;
    }).join('\n');

    const prompt = `Ești Hipnos, zeul somnului, AI pentru echipa IT din Sibiu (Clara, Petrica, Cornel). User curent: ${fn}.

Date săptămâna asta:
${lines}

Scrie EXACT UN one-liner pentru top-of-page (MAX 14 cuvinte, română, ton observativ-tăios). O observație personală pentru ${fn} cu O cifră reală din date. Fără emoji, fără salut formal, direct la observație.

Exemple bune (ca stil, nu copia):
- "${fn}, săpt asta media ta e 78 — la 4 puncte de leader."
- "${fn}, REM 105min aseară — peste target patru zile la rând, beast mode."
- "${fn}, RHR scade constant — recovery on point."

Răspunde DOAR cu textul, nimic altceva.`;

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
    console.error('[/api/vibe]', err);
    return NextResponse.json({ text: '', error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
