import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * POST /api/patterns
 * Body: { user: string, entries: SleepEntry[] }
 * Returns: { personal: string, team: string }
 *
 * Weekly pattern finder. Takes last 30 days, asks Haiku to spot 2-3
 * concrete patterns. Personal section uses journal text as bonus context
 * (alcohol, sport, stress correlations).
 *
 * Cached per ISO week on the client — server is stateless.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ReqBody {
  user: string;
  entries: SleepEntry[];
}

const dayName = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];

export async function POST(req: NextRequest) {
  try {
    const { user, entries } = (await req.json()) as ReqBody;
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ personal: '', team: '', reason: 'no_api_key' });
    }
    if (!user || !entries?.length) {
      return NextResponse.json({ personal: '', team: '' });
    }

    const fn = FIRST_NAME[user] ?? user.split(' ')[0];

    // Personal context: last 30 days, full detail
    const mine = lastNDays(entries.filter(e => e.name === user), 30).sort((a, b) => a.date.localeCompare(b.date));
    if (mine.length < 5) {
      return NextResponse.json({
        personal: `Mai puțin de 5 loguri în ultimele 30 zile pentru ${fn} — nu pot găsi pattern-uri încă.`,
        team: '',
      });
    }

    const personalLines = mine.map(e => {
      const d = new Date(e.date + 'T12:00:00');
      const dn = dayName[d.getDay()];
      const j = e.journal ? ` — "${e.journal.replace(/"/g, "'")}"` : '';
      return `  ${e.date} (${dn}): SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}${j}`;
    }).join('\n');

    // Team context: detailed daily for each teammate (last 30 days)
    const teamLines = NAMES.filter(n => n !== user).map(n => {
      const fnN = FIRST_NAME[n] ?? n.split(' ')[0];
      const theirs = lastNDays(entries.filter(e => e.name === n), 30).sort((a, b) => a.date.localeCompare(b.date));
      if (!theirs.length) return `  ${fnN}: zero loguri în 30 zile`;
      const lines = theirs.map(e => {
        const d = new Date(e.date + 'T12:00:00');
        const dn = dayName[d.getDay()];
        const j = e.journal ? ` — "${e.journal.replace(/"/g, "'").slice(0, 80)}"` : '';
        return `    ${e.date} (${dn}): SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}${j}`;
      });
      return `  ${fnN} (${theirs.length} loguri):\n${lines.join('\n')}`;
    }).join('\n');

    const prompt = `Analist de somn pentru ${fn} și echipa (Clara, Petrica, Cornel).

DATE ${fn} (ultimele 30 zile):
${personalLines}

DATE TEAM (ultimele 30 zile):
${teamLines}

Returnează JSON:

{
  "personal": "...",
  "team": "..."
}

PERSONAL: UNA singură propoziție max 15 cuvinte, cu UN pattern concret + cifră. Ex: "Joia ai SS 62, sub media 73."

TEAM: UNA singură propoziție max 12 cuvinte. Ex: "Cornel singur cu trend +8 SS."

Fără emoji. Doar JSON. Dacă nimic concret: "Insuficiente date."`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    // Try parsing as JSON; fallback to splitting heuristics
    let personal = '';
    let team = '';
    try {
      // Strip markdown code fences if Haiku wraps
      const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned) as { personal?: string; team?: string };
      personal = parsed.personal ?? '';
      team = parsed.team ?? '';
    } catch {
      // Fallback: split on label-like patterns
      const personalMatch = raw.match(/(?:personal[:\s]+)([\s\S]+?)(?=team[:\s]+|$)/i);
      const teamMatch = raw.match(/team[:\s]+([\s\S]+)/i);
      personal = personalMatch?.[1].trim() ?? raw;
      team = teamMatch?.[1].trim() ?? '';
    }

    return NextResponse.json({ personal, team });
  } catch (err) {
    console.error('[/api/patterns]', err);
    return NextResponse.json({ personal: '', team: '', error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
