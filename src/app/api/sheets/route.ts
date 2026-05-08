import { NextRequest, NextResponse } from 'next/server';
import { SHEETS_API, DUEL_ROW_MARKER } from '@/lib/config';
import { type SleepEntry } from '@/lib/sleep';

/**
 * GET /api/sheets — fetches all entries from the Google Sheet
 *
 * Response shape: { entries: SleepEntry[] }
 * Filters out special "__DUEL__" rows (legacy v1 feature).
 * REM column is optional — old rows return null.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RawSheetRow {
  date?: string;
  name?: string;
  sleep_score?: string | number;
  rhr?: string | number;
  hrv?: string | number | null | '';
  rem?: string | number | null | '';
  journal?: string | null | '';
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function parseStr(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function GET() {
  try {
    const url = `${SHEETS_API}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    const json = (await res.json()) as { data?: RawSheetRow[] };
    const rows = json.data ?? [];

    const entries: SleepEntry[] = rows
      .filter(r => !String(r.name || '').startsWith(DUEL_ROW_MARKER))
      .map(r => {
        // Date might come as ISO string from Apps Script — normalize to YYYY-MM-DD
        let dateStr = String(r.date || '').trim();
        if (dateStr.length > 10) dateStr = dateStr.slice(0, 10);
        return {
          date: dateStr,
          name: String(r.name || '').trim(),
          ss: parseNum(r.sleep_score) ?? 0,
          rhr: parseNum(r.rhr) ?? 0,
          hrv: parseNum(r.hrv),
          rem: parseNum(r.rem),
          journal: parseStr(r.journal),
        };
      })
      .filter(r => r.date && r.name);

    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[/api/sheets GET]', err);
    return NextResponse.json(
      { entries: [], error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sheets — writes a single entry to the Sheet
 *
 * Body: { date, name, ss, rhr, hrv?, rem? }
 * The Apps Script handler must accept ?action=write&date=...&name=...&sleep_score=...&rhr=...&hrv=...&rem=...
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, name, ss, rhr, hrv, rem, journal } = body as Partial<SleepEntry>;
    if (!date || !name || ss == null || rhr == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const params = new URLSearchParams({
      action: 'write',
      date: String(date),
      name: String(name),
      sleep_score: String(ss),
      rhr: String(rhr),
      hrv: hrv == null ? '' : String(hrv),
      rem: rem == null ? '' : String(rem),
      journal: journal ?? '',
    });
    const url = `${SHEETS_API}?${params}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/sheets POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
