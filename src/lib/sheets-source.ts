/**
 * Google Sheet → SleepEntry[] source.
 *
 * This is the ORIGINAL data backend, kept as a read source for two reasons:
 *   1. the one-time migration into Neon (`/api/migrate`) reads from here;
 *   2. `/api/sheets` GET falls back to it while Neon is still empty, so the
 *      cutover has zero downtime — prod keeps serving Sheet data until the
 *      migration has run, then switches to Neon automatically.
 *
 * All the tolerant parsing that used to live inline in the route handler now
 * lives here.
 */
import { requireSheetsApi, SHEETS_API, DUEL_ROW_MARKER } from '@/lib/config';
import { type SleepEntry } from '@/lib/sleep';
import { fetchWithRetry } from '@/lib/fetch-retry';
import { normalizeDate, type Cell } from '@/lib/sheet-parse';

export function hasSheetsSource(): boolean {
  return !!SHEETS_API;
}

interface RawSheetRow {
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

/**
 * Physiological sanity bounds. Hand-edited data, so a fat-fingered "999" used
 * to sail straight into the XP engine. Out-of-range values are dropped (null),
 * not clamped — a clamp would silently invent a plausible-looking number.
 */
export const RANGES = {
  ss:  [0, 100],
  rhr: [25, 150],
  hrv: [1, 300],
  rem: [0, 600],
} as const;

export function parseInRange(v: Cell, key: keyof typeof RANGES): number | null {
  const n = parseNum(v);
  if (n == null) return null;
  const [lo, hi] = RANGES[key];
  return n >= lo && n <= hi ? n : null;
}

function parseStr(v: Cell): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Parse a Sheets cell into a clean "HH:MM" 24h string, or null.
 * Handles three shapes seen in practice: a plain "HH:MM" string, a Date that
 * Google coerced from a typed time (1899 epoch, LMT offset baked in), and a
 * time-of-day stored as a fraction of a day.
 */
const BUCHAREST_LMT_SEC = 6264; // +1h 44m 24s — the 1899-epoch offset Sheets bakes in

function parseTime(v: Cell): string | null {
  if (v === '' || v == null) return null;
  const s = String(v).trim();
  const hm = /^(\d{1,2}):(\d{2})/.exec(s);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() < 1970) {
    const c = new Date(d.getTime() + BUCHAREST_LMT_SEC * 1000);
    const mins = (c.getUTCHours() * 60 + c.getUTCMinutes()) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  const num = Number(s);
  if (!Number.isNaN(num) && num > 0 && num < 1) {
    const total = Math.round(num * 24 * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

/** Pick first non-empty value from a list of possible column names */
function pickFirst(row: RawSheetRow, keys: string[]): Cell {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/**
 * Fetch every row from the Google Sheet and map to clean, deduped SleepEntry[].
 * Tolerant of the Sheet's misnamed / shifted columns (see inline notes).
 */
export async function fetchSheetEntries(): Promise<SleepEntry[]> {
  const url = `${requireSheetsApi()}?v=${Date.now()}`;
  const res = await fetchWithRetry(url, { cache: 'no-store', retries: 2, timeoutMs: 15_000 });
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  const json = (await res.json()) as { data?: RawSheetRow[] };
  const rows = json.data ?? [];

  const mapped: SleepEntry[] = rows
    .filter(r => !String(r.name ?? '').startsWith(DUEL_ROW_MARKER))
    .map(r => {
      // REM: try rem → score: rem → journal (if it's numeric, REM was misplaced)
      let rem: number | null = parseInRange(pickFirst(r, ['rem', 'score: rem']), 'rem');
      const journalCandidate = pickFirst(r, ['journal']);
      if (rem == null && journalCandidate != null && /^\d+(\.\d+)?$/.test(String(journalCandidate))) {
        rem = parseInRange(journalCandidate, 'rem');
      }
      // Journal: try journal (only if not numeric) → '' → '_'
      let journal: string | null = null;
      const jVal = parseStr(r.journal);
      if (jVal && !/^\d+(\.\d+)?$/.test(jVal)) journal = jVal;
      if (!journal) journal = parseStr(pickFirst(r, ['', ' ']));

      return {
        date: normalizeDate(r.date),
        name: String(r.name ?? '').trim(),
        ss: parseInRange(r.sleep_score, 'ss') ?? 0,
        rhr: parseInRange(r.rhr, 'rhr') ?? 0,
        hrv: parseInRange(r.hrv, 'hrv'),
        rem,
        journal,
        start: parseTime(r.start),
        end: parseTime(r.end),
      };
    })
    .filter(r => r.date && r.name);

  // Dedupe by (date, name): the old Apps Script sometimes appended instead of
  // upserting. Keep the most "complete" row (rem/journal/hrv/start/end filled).
  const dedupedMap = new Map<string, SleepEntry>();
  for (const e of mapped) {
    const key = `${e.date}::${e.name}`;
    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, e);
    } else {
      const score = (x: SleepEntry) =>
        (x.rem != null ? 1 : 0) + (x.journal ? 1 : 0) + (x.hrv != null ? 0.5 : 0) +
        (x.start ? 0.75 : 0) + (x.end ? 0.75 : 0);
      if (score(e) > score(existing)) dedupedMap.set(key, e);
    }
  }
  return [...dedupedMap.values()];
}
