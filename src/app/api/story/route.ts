import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME } from '@/lib/sleep';

/**
 * POST /api/story
 * Body: { entries: SleepEntry[] }
 * Returns: { text: string }   // 3-4 propoziții, recap săptămânal
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const dayShort = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];

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

    // Detailed daily breakdown per person for the week + their journals
    const sections = NAMES.map(name => {
      const fn = FIRST_NAME[name] ?? name.split(' ')[0];
      const theirs = weekData.filter(e => e.name === name).sort((a, b) => a.date.localeCompare(b.date));
      if (!theirs.length) return `${fn}: zero loguri săptămâna asta`;
      const lines = theirs.map(e => {
        const d = new Date(e.date + 'T12:00:00');
        const dn = dayShort[d.getDay()];
        const j = e.journal ? ` — "${e.journal.replace(/\s+/g, ' ').replace(/"/g, "'").slice(0, 100)}"` : '';
        return `  ${e.date} (${dn}): SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}${j}`;
      });
      const avg = Math.round(theirs.reduce((s, e) => s + e.ss, 0) / theirs.length);
      return `${fn} (${theirs.length} zile, SS mediu ${avg}):\n${lines.join('\n')}`;
    }).join('\n\n');

    const prompt = `Ești naratorul unui dashboard de somn pentru o echipă IT din Sibiu — Clara, Petrica, Cornel.

Săptămâna ${cutStr} → ${lastDate}:

${sections}

Scrie un mini-recap de **2 propoziții scurte** în română. O propoziție per linie. Menționează-i pe toți 3, dar fără să te lungi. Folosește cifre reale, nu generic. Câmp pentru o glumiță scurtă dacă găsești.

Fără emoji, fără bullet points. Direct la subiect. Răspunde DOAR cu textul.`;

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
