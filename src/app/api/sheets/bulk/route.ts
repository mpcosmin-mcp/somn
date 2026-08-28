import { NextRequest, NextResponse } from 'next/server';
import { type SleepEntry, RANGES, parseInRange, type RangeKey } from '@/lib/sleep';
import { invalidateEntriesCache } from '@/lib/sheets-cache';
import { upsertEntryFilling } from '@/lib/db';

/**
 * POST /api/sheets/bulk — write several nights in one round trip.
 *
 * Body: { entries: SleepEntry[] }
 *
 * Every night is judged on its own. A typo in Wednesday's RHR rejects
 * Wednesday and nothing else, so a week of hand-entered data never has to be
 * typed twice. The response says exactly which dates landed:
 *
 *   { written: string[], rejected: { date, error }[] }
 *
 * The read cache is invalidated once, after the last write.
 *
 * Writes through `upsertEntryFilling`, so a night submitted with only Scor and
 * RHR keeps whatever HRV / REM / sleep times Garmin already put there.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** A month at a time is plenty; anything larger is a script, not a person. */
const MAX_ROWS = 31;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { entries?: Partial<SleepEntry>[] };
    const rows = body.entries;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Nicio noapte de salvat' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Maxim ${MAX_ROWS} nopți odată` }, { status: 400 });
    }

    const written: string[] = [];
    const rejected: { date: string; error: string }[] = [];

    for (const r of rows) {
      const date = String(r.date ?? '');
      const name = String(r.name ?? '');
      if (!date || !name || r.ss == null || r.rhr == null) {
        rejected.push({ date: date || '?', error: 'Scor și RHR sunt obligatorii' });
        continue;
      }
      const offender = ([
        ['ss', r.ss], ['rhr', r.rhr], ['hrv', r.hrv], ['rem', r.rem],
      ] as [RangeKey, number | null | undefined][])
        .find(([k, v]) => v != null && parseInRange(v, k) == null);
      if (offender) {
        const [k, v] = offender;
        rejected.push({ date, error: `${k}=${v} în afara intervalului permis (${RANGES[k][0]}–${RANGES[k][1]})` });
        continue;
      }

      try {
        await upsertEntryFilling({
          date,
          name,
          ss: Number(r.ss),
          rhr: Number(r.rhr),
          hrv: r.hrv == null ? null : Number(r.hrv),
          rem: r.rem == null ? null : Number(r.rem),
          journal: r.journal ?? null,
          start: r.start ?? null,
          end: r.end ?? null,
        });
        written.push(date);
      } catch (err) {
        rejected.push({ date, error: err instanceof Error ? err.message : 'Eroare la scriere' });
      }
    }

    if (written.length) invalidateEntriesCache();
    return NextResponse.json({ written, rejected });
  } catch (err) {
    console.error('[/api/sheets/bulk POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
