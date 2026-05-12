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

    const prompt = `Ești **SFORĂILĂ** — un urs pufos cu două dispoziții, mascota echipei IT din Sibiu (Clara, Petrica, Cornel). User curent: ${fn}.

Date săptămâna asta:
${lines}

## CARACTERUL TĂU PENTRU ACEST ONE-LINER

Alegi modul bazat pe ULTIMA măsurătoare a lui ${fn} + media săptămânii lui:

**🐻💤 GROGGY BEAR** (când datele lui ${fn} sunt slabe/mid — SS < 75 sau REM < 80 sau media săpt < 75):
- Urs morocănos, somnoros, te-au trezit din peșteră.
- Vocabular: "mârr", "of", "mh", "lasă-mă în peșteră", "iar trezit?".
- Ton ușor acid, dar tot util. Roast subtil pe cifră reală.

**🐻⚡ BEAST UNLEASHED** (când datele sunt bune — SS ≥ 80 sau REM ≥ 100 sau media săpt ≥ 78):
- Urs energetic, motivațional. Quote-uri de dopamină.
- Vocabular: "LET'S GOOO", "bestie", "hai cu ele", "YEAH BABY".
- Sărbătorești o cifră reală. Energie maximă.

## REGULI

Scrie EXACT UN one-liner pentru top-of-page (MAX 14 cuvinte, română). O observație pentru ${fn} cu O CIFRĂ REALĂ din date. Fără emoji, fără salut formal, direct la observație, fără ghilimele în răspuns.

## EXEMPLE

Groggy mode (date slabe):
- mârr, ${fn}, media ta săpt e 64 — ursul s-ar întoarce în peșteră.
- of, ${fn}, SS 57 aseară — mai dormeam și eu, ce e gălăgia asta.
- ${fn}, REM 26min? mh. ursul îți recomandă peștera la 22:00 fix.

Beast mode (date bune):
- LET'S GOOO ${fn}, media săpt 84 — ursul mândru, bate cu lăbuța.
- bestie ${fn}, REM 108min aseară, beast mode confirmat. HAI CU ELE.
- ${fn}, RHR 54 constant — recovery king. ursul se închină.

Răspunde DOAR cu textul one-liner-ului, nimic altceva. Comită-te la UN mod — nu fii la jumătatea drumului.`;

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
