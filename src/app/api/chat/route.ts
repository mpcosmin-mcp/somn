import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * POST /api/chat
 * Body: {
 *   user: string,
 *   messages: { role: 'user'|'assistant', content: string }[],
 *   entries: SleepEntry[],
 * }
 * Returns: { text: string }
 *
 * The system prompt now contains DETAILED DAILY data for ALL THREE team members
 * (last 30 days), not just the current user. This lets Claude roast/compare
 * specific nights for anyone without saying "I only have aggregates".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ReqBody {
  user: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  entries: SleepEntry[];
}

const dayShort = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];

/** Format a person's last-N-days entries as a compact text table */
function formatPerson(name: string, entries: SleepEntry[], days: number): string {
  const fn = FIRST_NAME[name] ?? name.split(' ')[0];
  const mine = lastNDays(entries.filter(e => e.name === name), days)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!mine.length) return `${fn}: zero loguri în ultimele ${days} zile`;
  const lines = mine.map(e => {
    const d = new Date(e.date + 'T12:00:00');
    const dn = dayShort[d.getDay()];
    const j = e.journal ? ` · "${e.journal.replace(/\s+/g, ' ').replace(/"/g, "'").slice(0, 100)}"` : '';
    return `  ${e.date} ${dn}: SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}${j}`;
  });
  return `${fn} (${mine.length} loguri):\n${lines.join('\n')}`;
}

export async function POST(req: NextRequest) {
  try {
    const { user, messages, entries } = (await req.json()) as ReqBody;

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ text: 'AI offline — adaugă ANTHROPIC_API_KEY în Vercel ca să pot răspunde.' });
    }
    if (!user || !messages?.length) {
      return NextResponse.json({ text: '' });
    }

    const fn = FIRST_NAME[user] ?? user.split(' ')[0];

    // Build full team context: detailed last 30 days per user, with journals
    const teamSections = NAMES.map(n => formatPerson(n, entries, 30)).join('\n\n');

    const system = `Ești un asistent inteligent integrat într-un dashboard de somn pentru o echipă IT din Sibiu — Clara, Petrica, Cornel. Toți programatori, le place sportul, mâncatul sănătos, AI-ul.

Userul curent (cu care vorbești): **${fn}**.

Ai DATE ZILNICE complete pentru TOȚI 3 din ultimele 30 zile — poți compara, roastui, felicita pe oricine, oriunde, oricând. Folosește cifrele și jurnalele lor REALE când răspunzi.

═══════════ DATE ECHIPĂ (zilnic, ultimele 30 zile) ═══════════

${teamSections}

═══════════════════════════════════════════════════════════════

Reguli:
- Răspunde în română, ton prieten-tehnic, casual și roasty când e cazul
- Maxim 4-5 propoziții decât dacă userul cere mai mult
- Folosește numere REALE din date (SS, REM, RHR, HRV, jurnale) — niciodată inventat
- Dacă userul cere comparație/roast/felicitare, FĂ-O cu nume specifice și cifre specifice — NU spune "n-am date detaliate" pentru că le ai
- Dacă userul cere despre tine personal, focusează-te pe ${fn}
- Fără bullet points decât la întrebări care chiar le cer
- Nu poți modifica/loga date — doar discuți despre ele`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const trimmed = messages.slice(-20);

    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system,
      messages: trimmed.map(m => ({ role: m.role, content: m.content })),
    });

    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    return NextResponse.json({ text, usage: { in: msg.usage.input_tokens, out: msg.usage.output_tokens } });
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { text: 'Eroare la generare. Încearcă din nou.', error: err instanceof Error ? err.message : 'unknown' },
      { status: 200 },
    );
  }
}
