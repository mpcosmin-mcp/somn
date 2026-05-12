import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';

/**
 * POST /api/insights
 * Body:    { user: string, entries: SleepEntry[] }
 * Returns: { observations: { key, label, icon, text }[] }
 *
 * Sforăilă's read on the data — produces 3-4 fun observations about
 * different aspects of the squad's sleep:
 *   - azi         : who's logged today, who's still asleep
 *   - săpt        : trend on the week's averages (user vs team)
 *   - clasament   : who's leading, by how much
 *   - team feel   : aggregate mood (high SS together / together off)
 *
 * Each observation is a single sharp line in Sforăilă's voice —
 * grumpy bear when data is mid/bad, beast mode when data is great.
 * Cached client-side per (user, latestLogDate) so the AI call only
 * fires when there's new data.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Observation {
  key: string;
  label: string;
  icon: string;
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const { user, entries } = (await req.json()) as { user: string; entries: SleepEntry[] };
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ observations: [] });
    if (!user || !entries?.length) return NextResponse.json({ observations: [] });

    const fn = FIRST_NAME[user] ?? user.split(' ')[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    const last7 = lastNDays(entries, 7);

    // Build a compact data summary for the prompt
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

    const prompt = `Ești **SFORĂILĂ** — un urs pufos morocănos cu două dispoziții, mascotul echipei IT din Sibiu (Clara, Petrica, Cornel). User curent care citește: ${fn}. Azi e ${todayIso}.

Date echipă (ultimele 7 zile):
${teamLines}

## CARACTER

Două dispoziții, alegi per observație după datele din acea observație:
- **🐻💤 GROGGY** (date mid/slabe): vocabular "mârr", "of", "lasă-mă în peșteră", "mai dormeam", "mh".
- **🐻⚡ BEAST** (date bune): vocabular "LET'S GOOO", "bestie", "hai cu ele", "YEAH BABY".

## CE TREBUIE SĂ FACI

Generează EXACT 3 observații despre echipa de IT din Sibiu, fiecare un single one-liner (max 14 cuvinte). Folosește CIFRE REALE din date. Niciodată inventate.

Format de răspuns EXACT (linii separate, fără markdown extra):
\`\`\`
AZI: [observație despre cine a logat azi / cine n-a logat]
SAPT: [observație despre trendul săptămânii — media echipei sau evoluție pe ${fn}]
CLASAMENT: [observație despre cine domină / e pe locul 2 / diferențe]
\`\`\`

## REGULI

- Fiecare linie începe cu eticheta exactă (AZI / SAPT / CLASAMENT) urmată de doua puncte și un space.
- Pe ${fn} îl referi direct ("tu", "${fn}") când e despre el. Altfel folosește numele lor.
- Fără emoji, fără ghilimele, fără markdown. Doar text colocvial.
- Comită-te la GROGGY sau BEAST per linie — nu fence-sitting.

## EXEMPLE

AZI: mârr, doar Petrica a logat azi — Cornel și Clara încă în peșteră.
SAPT: bestie, media echipei urcă la 81 — săpt trecută era 74, HAI CU ELE.
CLASAMENT: Cornel conduce cu 84, tu pe 79 — la 5 puncte distanță, ${fn}, recuperezi?

Răspunde DOAR cu cele 3 linii, în ordinea dată.`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
      .trim();

    // Parse three lines with label prefixes.
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const observations: Observation[] = [];
    const meta: Record<string, { label: string; icon: string }> = {
      azi:        { label: 'azi',        icon: '📅' },
      sapt:       { label: 'săptămâna',  icon: '📈' },
      clasament:  { label: 'clasament',  icon: '👑' },
    };
    for (const line of lines) {
      const m = line.match(/^(AZI|SAPT|CLASAMENT)\s*:\s*(.+)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const text = m[2].trim();
      if (text && meta[key]) {
        observations.push({ key, label: meta[key].label, icon: meta[key].icon, text });
      }
    }

    return NextResponse.json({ observations });
  } catch (err) {
    console.error('[/api/insights]', err);
    return NextResponse.json({ observations: [], error: err instanceof Error ? err.message : 'unknown' }, { status: 200 });
  }
}
