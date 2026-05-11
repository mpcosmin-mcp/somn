import { NextRequest, NextResponse } from 'next/server';
import { SHEETS_API, DUEL_ROW_MARKER } from '@/lib/config';
import { type SleepEntry } from '@/lib/sleep';
import { getCachedEntries, setCachedEntries, invalidateEntriesCache } from '@/lib/sheets-cache';

/**
 * GET /api/sheets — fetches all entries from the Google Sheet
 *
 * Response shape: { entries: SleepEntry[] }
 *
 * 60s in-memory cache (see lib/sheets-cache.ts). The Apps Script call
 * routinely takes 4–10s, and the data only changes when someone POSTs
 * here or the AI tools write. Both invalidate the cache.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Cell = string | number | null | undefined;

interface RawSheetRow {
  // Most fields are well-known. We use bracket access to also pull oddly-named
  // columns ("score: rem", empty header) without TypeScript complaining.
  date?: Cell;
  name?: Cell;
  sleep_score?: Cell;
  rhr?: Cell;
  hrv?: Cell;
  rem?: Cell;
  score?: Cell;
  journal?: Cell;
  [k: string]: Cell;
}

function parseNum(v: Cell): number | null {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function parseStr(v: Cell): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Normalize whatever Apps Script returns into a YYYY-MM-DD local date.
 *
 * Google Sheets often coerces YYYY-MM-DD strings into Date objects internally.
 * When Apps Script JSON-stringifies them, you get ISO timestamps like
 * "2026-05-07T21:00:00.000Z" — that's midnight Romania (UTC+3), serialized as
 * the previous day in UTC. A naive .slice(0,10) would lose a calendar day.
 *
 * Fix: add 12h to the parsed timestamp so any timezone shift up to ±12h still
 * lands on the original calendar day, then slice.
 */
function normalizeDate(raw: Cell): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;       // already a clean date
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);     // unparseable, best effort
  const adjusted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

/** Pick first non-empty value from a list of possible column names */
function pickFirst(row: RawSheetRow, keys: string[]): Cell {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

export async function GET() {
  try {
    // Fast path: serve from cache if still fresh (60s TTL).
    const cached = getCachedEntries();
    if (cached) {
      return NextResponse.json({ entries: cached });
    }

    const url = `${SHEETS_API}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    const json = (await res.json()) as { data?: RawSheetRow[] };
    const rows = json.data ?? [];

    // Map raw rows → SleepEntry. Tolerant of misnamed columns:
    //   - rem      may be in `rem`, `score: rem`, or even `journal` if headers were shifted
    //   - journal  may be in `journal` or in an empty-header column ('')
    // We pick the first non-empty match for each.
    const mapped: SleepEntry[] = rows
      .filter(r => !String(r.name ?? '').startsWith(DUEL_ROW_MARKER))
      .map(r => {
        // REM: try rem → score: rem → journal (if it's numeric, REM was misplaced)
        let rem: number | null = parseNum(pickFirst(r, ['rem', 'score: rem']));
        const journalCandidate = pickFirst(r, ['journal']);
        if (rem == null && journalCandidate != null && /^\d+(\.\d+)?$/.test(String(journalCandidate))) {
          rem = parseNum(journalCandidate);
        }
        // Journal: try journal (only if not numeric) → '' → '_' → any string column past index 5
        let journal: string | null = null;
        const jVal = parseStr(r.journal);
        if (jVal && !/^\d+(\.\d+)?$/.test(jVal)) journal = jVal;
        if (!journal) journal = parseStr(pickFirst(r, ['', ' ']));

        return {
          date: normalizeDate(r.date),
          name: String(r.name ?? '').trim(),
          ss: parseNum(r.sleep_score) ?? 0,
          rhr: parseNum(r.rhr) ?? 0,
          hrv: parseNum(r.hrv),
          rem,
          journal,
        };
      })
      .filter(r => r.date && r.name);

    // Dedupe by (date, name): if the Apps Script was previously appending instead
    // of upserting, there can be multiple rows for one (date, name). Keep the most
    // "complete" one — prefer the row that has rem and/or journal filled in.
    const dedupedMap = new Map<string, SleepEntry>();
    for (const e of mapped) {
      const key = `${e.date}::${e.name}`;
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, e);
      } else {
        const score = (x: SleepEntry) => (x.rem != null ? 1 : 0) + (x.journal ? 1 : 0) + (x.hrv != null ? 0.5 : 0);
        if (score(e) > score(existing)) dedupedMap.set(key, e);
      }
    }
    const entries = [...dedupedMap.values()];

    setCachedEntries(entries);
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
    invalidateEntriesCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/sheets POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sheets — removes a single entry by (date, name).
 * Body: { date, name }
 * Requires Apps Script to have action=delete handler.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { date, name } = await req.json() as { date?: string; name?: string };
    if (!date || !name) {
      return NextResponse.json({ error: 'Missing date or name' }, { status: 400 });
    }
    const params = new URLSearchParams({
      action: 'delete',
      date,
      name,
    });
    const res = await fetch(`${SHEETS_API}?${params}`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    invalidateEntriesCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/sheets DELETE]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
