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
  start?: Cell;
  end?: Cell;
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
 * Parse a Sheets cell into a clean "HH:MM" 24h string, or null.
 * Handles three shapes seen in practice:
 *   1. a plain "HH:MM" text string — the clean case (Plain Text column, or a
 *      value written as a string by the Apps Script).
 *   2. a Date that Google coerced from a typed time, anchored to the 1899-12-30
 *      epoch. Its ISO is UTC with the sheet's *historical* Bucharest offset
 *      (LMT = +1:44:24) baked in, so the naive UTC hour reads ~1h44m low. We add
 *      the offset back and read HH:MM via UTC methods, so it's stable on a UTC
 *      server (the trap a naive getHours() would hit). Recovers times that were
 *      typed straight into non-text cells in the Sheet.
 *   3. a time-of-day stored as a fraction of a day (0.94166… = 22:36).
 */
const BUCHAREST_LMT_SEC = 6264; // +1h 44m 24s — the 1899-epoch offset Sheets bakes in

function parseTime(v: Cell): string | null {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  // 1. Clean "HH:MM"
  const hm = /^(\d{1,2}):(\d{2})/.exec(s);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  // 2. 1899-epoch Date coercion → undo the baked-in LMT offset
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() < 1970) {
    const c = new Date(d.getTime() + BUCHAREST_LMT_SEC * 1000);
    const mins = (c.getUTCHours() * 60 + c.getUTCMinutes()) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  // 3. fraction of a day
  const num = Number(s);
  if (!Number.isNaN(num) && num > 0 && num < 1) {
    const total = Math.round(num * 24 * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
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

export async function GET(req: NextRequest) {
  try {
    // `?fresh=1` bypasses the 60s server-side cache — used by the client when
    // someone hit "sync" or returned to the tab after editing the Sheet by hand.
    const fresh = req.nextUrl.searchParams.get('fresh') === '1';
    if (!fresh) {
      const cached = getCachedEntries();
      if (cached) {
        return NextResponse.json({ entries: cached });
      }
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
          start: parseTime(r.start),
          end: parseTime(r.end),
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
        const score = (x: SleepEntry) => (x.rem != null ? 1 : 0) + (x.journal ? 1 : 0) + (x.hrv != null ? 0.5 : 0) + (x.start ? 0.75 : 0) + (x.end ? 0.75 : 0);
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
 * Body: { date, name, ss, rhr, hrv?, rem?, journal?, start?, end? }
 * The Apps Script handler must accept ?action=write&date=...&name=...&sleep_score=...&rhr=...&hrv=...&rem=...&journal=...&start=...&end=...
 * (start/end are "HH:MM" bedtime/wake — new columns; old scripts simply ignore them.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, name, ss, rhr, hrv, rem, journal, start, end } = body as Partial<SleepEntry>;
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
      start: start ?? '',
      end: end ?? '',
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
