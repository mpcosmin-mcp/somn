import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, aggregate } from '@/lib/sleep';

/**
 * POST /api/story
 * Body: { entries: SleepEntry[] }   // last 7 days for the team
 * Returns: { text: string }         // 3-4 propoziții recap săptămânal
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { entries } = (await req.json()) as { entries: SleepEntry[] };
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ text: '', reason: 'no_api_key' });
    }
    if (!entries?.length) return NextResponse.json({ text: '' });

    // Last 7 days from the most recent date in data
    const sortedDates = [...new Set(entries.map(e => e.date))].sort();
    const lastDate = sortedDates[sortedDates.length - 1];
    const cutoff = new Date(lastDate + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - 6);
    const cutStr = cutoff.toISOString().split('T')[0];
    const weekData = entries.filter(e => e.date >= cutStr && e.date <= lastDate);
    if (weekData.length < 3) return NextResponse.json({ text: '' });

    const agg = aggregate(weekData);
    const summary = NAMES.map(n => {
      const a = agg.find(x => x.name === n);
      const fn = FIRST_NAME[n] ?? n.split(' ')[0];
      if (!a) return `${fn}: zero zile logate`;
      const remTxt = a.rem != null ? `${a.rem} min REM mediu` : 'fără REM';
      return `${fn}: ${a.entries} zile, SS mediu ${a.ss}, RHR ${a.rhr}, ${remTxt}`;
    }).join('\n');

    const prompt = `Ești naratorul unui dashboard de somn al unei echipe IT din Sibiu — Clara, Petrica, Cornel. Programatori care iubesc sportul, mâncarea sănătoasă, AI-ul.

Recap săptămâna trecută (${cutStr} → ${lastDate}):
${summary}

Scrie un mini-recap de 3-4 propoziții în română, ton de povestitor amuzant care îi cunoaște pe cei 3. Menționează-i pe toți. Folosește datele concrete (cifre reale). Dacă cineva a dormit excelent, laudă-l; dacă a fost slab, fă mișto cu drag. Bonus dacă strecori un comentariu legat de REM (90+ min e bun, sub 70 e slab).

Fără emoji, fără bullet points, narativ. Răspunde DOAR cu textul.`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    return NextResponse.json({ text });
  } catch (err) {
    console.error('[/api/story]', err);
    return NextResponse.json({ text: '', error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
