import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, aggregate, lastNDays } from '@/lib/sleep';

/**
 * POST /api/chat
 * Body: {
 *   user: string,                                  // current user's full name
 *   messages: { role: 'user'|'assistant', content: string }[],   // conversation
 *   entries: SleepEntry[],                          // all team data (we slice context)
 * }
 * Returns: { text: string }                         // assistant reply
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ReqBody {
  user: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  entries: SleepEntry[];
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

    // Build sleep-data context: last 30 days team summary + last 7 days for current user (detailed)
    const fn = FIRST_NAME[user] ?? user.split(' ')[0];
    const last30 = lastNDays(entries, 30);
    const teamAgg = aggregate(last30);
    const teamLines = NAMES.map(n => {
      const a = teamAgg.find(x => x.name === n);
      const fnN = FIRST_NAME[n] ?? n.split(' ')[0];
      if (!a) return `- ${fnN}: zero zile logate în ultimele 30`;
      return `- ${fnN}: ${a.entries} zile, SS mediu ${a.ss}, RHR ${a.rhr}, HRV ${a.hrv ?? '—'}, REM ${a.rem ?? '—'}min`;
    }).join('\n');

    const last7Mine = lastNDays(entries.filter(e => e.name === user), 7).sort((a, b) => a.date.localeCompare(b.date));
    const mineLines = last7Mine.map(e =>
      `  ${e.date}: SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}min`,
    ).join('\n');

    const system = `Ești un asistent inteligent integrat într-un dashboard de somn pentru o echipă IT din Sibiu — Clara, Petrica, Cornel. Toți programatori, le place sportul, mâncatul sănătos, AI-ul.

Userul curent: ${fn}.
Răspunde concis, în română, ton prietenos-tehnic. Folosește datele lor reale când răspunzi (nu inventa cifre). Maxim 4-5 propoziții decât nu cere user-ul mai mult. Fără emoji exagerate, fără bullet points dacă nu e necesar.

DATE TEAM (ultimele 30 zile, agregat):
${teamLines}

DATE ${fn} (ultimele 7 zile, detaliat):
${mineLines || '  (niciun log)'}

Reguli:
- Dacă user-ul întreabă despre date concrete, folosește numerele de mai sus
- Dacă întreabă cum să-și îmbunătățească somnul/REM/HRV, dă sfaturi concrete bazate pe ce ai (alcool, sport târziu, cofeină, temperatură cameră)
- Dacă vrea să comparam cu alții, folosește datele team
- Dacă întreabă off-topic (programare, sport, nutriție), poți răspunde scurt dar redirecționează spre somn dacă se poate
- Nu poți modifica date sau loga — doar discuți`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Cap context at last 20 messages for cost control
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
