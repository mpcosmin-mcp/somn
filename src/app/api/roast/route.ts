import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';

/**
 * POST /api/roast
 * Body: { name: string, entries: SleepEntry[] }   // last 7 days for that user
 * Returns: { text: string }                        // 1-2 propoziții, în română
 *
 * Adaptive tone:
 *   • SS ≥ 85 OR REM ≥ 100  → CELEBRATE with hype
 *   • SS 70-84              → OBSERVE with a small nudge
 *   • SS < 70               → ROAST with love + actionable tip
 *
 * Uses the user's daily journal (if present) as context for sharper jabs.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqBody {
  name: string;
  entries: SleepEntry[];
}

function pickMode(ss: number, rem: number | null): 'celebrate' | 'observe' | 'roast' {
  if (ss >= 85 || (rem != null && rem >= 100)) return 'celebrate';
  if (ss >= 70) return 'observe';
  return 'roast';
}

const MODE_INSTRUCTIONS: Record<'celebrate' | 'observe' | 'roast', string> = {
  celebrate:
    'a dormit EXCELENT. Felicită-l cu energie pozitivă, apreciere genuină, și un compliment SPECIFIC bazat pe cifre (ex: "REM-ul de 110 min e league of its own"). Recunoaște efortul. Fără emoji. Tonul: prieten care îți dă pumn în umăr cu mândrie.',
  observe:
    'a dormit DECENT, dar nimic spectaculos. Observă o nuanță concretă din date și dă-i un tip mic, actionable. Tonul: prieten observativ, nu cinic, nu plictisitor.',
  roast:
    'a dormit PROST. Roastuiește-l cu drag — fără cruzime, dar cu colț. Fă mișto de cifre, dar termină cu UN sfat concret (alcool, sport târziu, cofeină, ecran, stres, mese târzii — alege ce-i relevant). Dacă a scris în notiță un motiv, folosește-l direct ("ai băut bere — sigur de aia"). Tonul: prieten IT care îți zice să te lași de tâmpenii.',
};

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
    const mode = pickMode(last.ss, last.rem);

    const remTxt = last.rem != null ? `${last.rem} min REM` : 'fără REM înregistrat';
    const hrvTxt = last.hrv != null ? `${last.hrv} HRV` : 'fără HRV';
    const avgTxt = avg7 != null ? `media ultimelor ${mine.length} zile: SS ${avg7}` : 'date insuficiente pentru medie';
    const journalTxt = last.journal ? `\nNotița lui ${firstName} de azi: "${last.journal}"` : '';

    const prompt = `Ești naratorul amuzant al unui dashboard de somn pentru o echipă IT din Sibiu — Clara, Petrica, Cornel. Programatori care iubesc sportul, mâncarea sănătoasă, AI-ul.

Ultima noapte a lui ${firstName}: SS ${last.ss}, RHR ${last.rhr}, ${remTxt}, ${hrvTxt}.
Context: ${avgTxt}.${journalTxt}

Verdict: ${firstName} ${MODE_INSTRUCTIONS[mode]}

Reguli stricte:
- 1-2 propoziții scurte
- Română
- Fără emoji, fără bullet points
- Folosește cifrele REALE
- Dacă există notiță, integreaz-o natural
- Răspunde DOAR cu textul, nimic altceva`;

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

    return NextResponse.json({ text, mode });
  } catch (err) {
    console.error('[/api/roast]', err);
    return NextResponse.json({ text: '', error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
