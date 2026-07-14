/* Shared Sheet-cell parsing — used by /api/sheets (read path) and
 * /api/garmin/sync (existence check). One definition so the two
 * routes can never disagree on what date a row belongs to. */

export type Cell = string | number | null | undefined;

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
export function normalizeDate(raw: Cell): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;       // already a clean date
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);     // unparseable, best effort
  const adjusted = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}
