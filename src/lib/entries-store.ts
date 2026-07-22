/**
 * Unified read path for sleep entries: Neon ∪ Google Sheet.
 *
 * The cutover left data split across two stores: history lives in the Sheet
 * until `/api/migrate` runs, while new writes land in Neon. The old fallback
 * ("Sheet only while Neon is EMPTY") went dormant the moment the first row hit
 * Neon — serving a few days of data and silently hiding months of history.
 *
 * This module serves the union instead (Neon wins on a (date, name) collision,
 * since that's where edits go), and self-heals: any Sheet row missing from
 * Neon is backfilled after the response, so the store converges to complete
 * without anyone having to run the migration endpoint by hand. Once a read
 * proves the Sheet is fully covered, the Sheet call is skipped for the rest of
 * this lambda's life — steady-state reads stay Neon-fast.
 */
import { after } from 'next/server';
import { type SleepEntry } from '@/lib/sleep';
import { getAllEntries, upsertMany, hasPostgres } from '@/lib/db';
import { fetchSheetEntries, hasSheetsSource } from '@/lib/sheets-source';

const key = (e: SleepEntry) => `${e.date}::${e.name}`;

/** Per-lambda: the Sheet held nothing Neon didn't — stop paying for its read. */
let sheetDrained = false;

const byDate = (a: SleepEntry, b: SleepEntry) =>
  a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

/**
 * Best-effort merged read. Never throws: a dead source is logged and skipped,
 * mirroring the old route's tolerance — worst case is an empty array.
 */
export async function getMergedEntries(): Promise<SleepEntry[]> {
  let neon: SleepEntry[] = [];
  let neonOk = false;
  if (hasPostgres()) {
    try {
      neon = await getAllEntries();
      neonOk = true;
    } catch (e) {
      console.error('[entries-store] neon read failed', e);
    }
  }

  if ((sheetDrained && neonOk) || !hasSheetsSource()) return neon.sort(byDate);

  let sheet: SleepEntry[] = [];
  try {
    sheet = await fetchSheetEntries();
  } catch (e) {
    console.error('[entries-store] sheet read failed', e);
    return neon.sort(byDate);
  }

  const have = new Set(neon.map(key));
  const missing = sheet.filter(e => !have.has(key(e)));

  if (missing.length === 0) {
    if (neonOk) sheetDrained = true;
    return (neonOk ? neon : sheet).sort(byDate);
  }

  // Backfill Neon after the response goes out. Idempotent (PK upsert) and
  // resumable — rows written before a lambda freeze are durable, so repeated
  // reads converge even if one pass gets cut short.
  if (neonOk) {
    after(async () => {
      try {
        const n = await upsertMany(missing);
        console.log(`[entries-store] backfilled ${n} sheet rows into neon`);
      } catch (e) {
        console.error('[entries-store] backfill failed', e);
      }
    });
  }

  return [...neon, ...missing].sort(byDate);
}
