/**
 * Neon (Vercel Postgres) data layer — the entries store.
 *
 * Replaces the Google Sheet as the source of truth for sleep entries. Reads
 * and writes go through here; the Sheet lives on only as a migration source
 * and a read-fallback during cutover (see lib/sheets-source.ts).
 *
 * Connection: `@vercel/postgres` auto-reads POSTGRES_URL, which Vercel injects
 * for every environment (prod + preview) once a Neon database is linked to the
 * project — so this works on preview deployments too, unlike the Sheet.
 *
 * `start`/`end` are SQL reserved words, so the columns are named `bedtime` /
 * `wake` and mapped back to the SleepEntry field names on the way out.
 */
import { sql } from '@vercel/postgres';
import { type SleepEntry } from '@/lib/sleep';

export function hasPostgres(): boolean {
  return !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

/** Create the table once per warm lambda. CREATE TABLE IF NOT EXISTS is cheap
 *  but we still guard it behind a module-level promise to avoid racing it on
 *  every request. */
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS entries (
          date     TEXT    NOT NULL,
          name     TEXT    NOT NULL,
          ss       INTEGER NOT NULL DEFAULT 0,
          rhr      INTEGER NOT NULL DEFAULT 0,
          hrv      INTEGER,
          rem      INTEGER,
          journal  TEXT,
          bedtime  TEXT,
          wake     TEXT,
          PRIMARY KEY (date, name)
        )
      `;
    })().catch(err => {
      // Reset so a transient failure (cold DB) can be retried next call.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

interface Row {
  date: string;
  name: string;
  ss: number;
  rhr: number;
  hrv: number | null;
  rem: number | null;
  journal: string | null;
  bedtime: string | null;
  wake: string | null;
}

function toEntry(r: Row): SleepEntry {
  return {
    date: r.date,
    name: r.name,
    ss: r.ss,
    rhr: r.rhr,
    hrv: r.hrv,
    rem: r.rem,
    journal: r.journal,
    start: r.bedtime,
    end: r.wake,
  };
}

/** All entries, newest date first. */
export async function getAllEntries(): Promise<SleepEntry[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT date, name, ss, rhr, hrv, rem, journal, bedtime, wake
    FROM entries
    ORDER BY date DESC, name ASC
  `;
  return (rows as Row[]).map(toEntry);
}

/** Insert or update one entry, keyed by (date, name). */
export async function upsertEntry(e: SleepEntry): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO entries (date, name, ss, rhr, hrv, rem, journal, bedtime, wake)
    VALUES (
      ${e.date}, ${e.name}, ${e.ss}, ${e.rhr},
      ${e.hrv ?? null}, ${e.rem ?? null}, ${e.journal ?? null},
      ${e.start ?? null}, ${e.end ?? null}
    )
    ON CONFLICT (date, name) DO UPDATE SET
      ss = EXCLUDED.ss,
      rhr = EXCLUDED.rhr,
      hrv = EXCLUDED.hrv,
      rem = EXCLUDED.rem,
      journal = EXCLUDED.journal,
      bedtime = EXCLUDED.bedtime,
      wake = EXCLUDED.wake
  `;
}

/**
 * Upsert that only fills the optional columns it was actually given.
 *
 * `upsertEntry` above sets every column from EXCLUDED, which is right when the
 * caller loaded the row first and is submitting the whole thing back. The bulk
 * logger isn't always in that position: after a week away, or on a cold open
 * where the entry list hasn't landed yet, it can hand us a night carrying only
 * Scor and RHR — and a plain upsert would blank the HRV, REM and sleep times
 * Garmin had already synced for that date.
 *
 * So here a null means "I don't have this one", not "make it empty". Scor, RHR
 * and journal are still authoritative; the trade is that the logger can't clear
 * an optional number back to empty, which is much the rarer intent.
 */
export async function upsertEntryFilling(e: SleepEntry): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO entries (date, name, ss, rhr, hrv, rem, journal, bedtime, wake)
    VALUES (
      ${e.date}, ${e.name}, ${e.ss}, ${e.rhr},
      ${e.hrv ?? null}, ${e.rem ?? null}, ${e.journal ?? null},
      ${e.start ?? null}, ${e.end ?? null}
    )
    ON CONFLICT (date, name) DO UPDATE SET
      ss = EXCLUDED.ss,
      rhr = EXCLUDED.rhr,
      hrv = COALESCE(EXCLUDED.hrv, entries.hrv),
      rem = COALESCE(EXCLUDED.rem, entries.rem),
      journal = COALESCE(EXCLUDED.journal, entries.journal),
      bedtime = COALESCE(EXCLUDED.bedtime, entries.bedtime),
      wake = COALESCE(EXCLUDED.wake, entries.wake)
  `;
}

/** Remove one entry by (date, name). Returns how many rows were deleted. */
export async function deleteEntry(date: string, name: string): Promise<number> {
  await ensureSchema();
  const { rowCount } = await sql`
    DELETE FROM entries WHERE date = ${date} AND name = ${name}
  `;
  return rowCount ?? 0;
}

/** Bulk upsert — used by the one-time migration. Returns the count written. */
export async function upsertMany(entries: SleepEntry[]): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const e of entries) {
    await upsertEntry(e);
    n++;
  }
  return n;
}
