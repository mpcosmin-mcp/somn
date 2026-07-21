import { NextRequest, NextResponse } from 'next/server';
import { type SleepEntry } from '@/lib/sleep';
import { getCachedEntries, setCachedEntries, invalidateEntriesCache } from '@/lib/sheets-cache';
import { getAllEntries, upsertEntry, deleteEntry, hasPostgres } from '@/lib/db';
import { fetchSheetEntries, hasSheetsSource, parseInRange, RANGES } from '@/lib/sheets-source';

/**
 * /api/sheets — sleep entries, now backed by Neon (Vercel Postgres).
 *
 * The route name is kept for backwards-compat with the client; the backend is
 * Postgres. Response shape is unchanged: { entries: SleepEntry[] }.
 *
 * Read path: Neon first. While Neon is still empty (before the one-time
 * migration has run) it falls back to the Google Sheet, so the cutover has zero
 * downtime — prod keeps serving Sheet data until `/api/migrate` populates Neon,
 * then switches over on its own.
 *
 * 60s in-memory cache still coalesces burst reloads.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // `?fresh=1` bypasses the 60s server-side cache — used when the user hit
    // "sync" or returned to the tab after an edit.
    const fresh = req.nextUrl.searchParams.get('fresh') === '1';
    if (!fresh) {
      const cached = getCachedEntries();
      if (cached) return NextResponse.json({ entries: cached });
    }

    let entries: SleepEntry[] = [];
    if (hasPostgres()) {
      // A Neon hiccup (cold start, transient timeout) must NOT take the app
      // down — swallow it here so the Sheet fallback below can still fire,
      // rather than letting it bubble to a 500.
      try {
        entries = await getAllEntries();
      } catch (e) {
        console.error('[/api/sheets GET] neon read failed', e);
      }
    }

    // Cutover fallback: Neon not linked yet, linked but not migrated, or the
    // read above failed. Serve the Sheet so nothing breaks in the meantime.
    if (entries.length === 0 && hasSheetsSource()) {
      try {
        entries = await fetchSheetEntries();
      } catch (e) {
        console.error('[/api/sheets GET] sheet fallback failed', e);
      }
    }

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
 * POST /api/sheets — insert/update one entry in Neon (keyed by date+name).
 * Body: { date, name, ss, rhr, hrv?, rem?, journal?, start?, end? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, name, ss, rhr, hrv, rem, journal, start, end } = body as Partial<SleepEntry>;
    if (!date || !name || ss == null || rhr == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Reject out-of-range values at the door rather than storing them and
    // filtering on read — a bad row is a bad row forever.
    const offender = ([
      ['ss', ss], ['rhr', rhr], ['hrv', hrv], ['rem', rem],
    ] as [keyof typeof RANGES, number | null | undefined][])
      .find(([k, v]) => v != null && parseInRange(v, k) == null);
    if (offender) {
      const [k, v] = offender;
      return NextResponse.json(
        { error: `${k}=${v} în afara intervalului permis (${RANGES[k][0]}–${RANGES[k][1]})` },
        { status: 400 },
      );
    }

    await upsertEntry({
      date: String(date),
      name: String(name),
      ss: Number(ss),
      rhr: Number(rhr),
      hrv: hrv == null ? null : Number(hrv),
      rem: rem == null ? null : Number(rem),
      journal: journal ?? null,
      start: start ?? null,
      end: end ?? null,
    });
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
 * DELETE /api/sheets — remove one entry by (date, name).
 * Body: { date, name }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { date, name } = await req.json() as { date?: string; name?: string };
    if (!date || !name) {
      return NextResponse.json({ error: 'Missing date or name' }, { status: 400 });
    }
    await deleteEntry(date, name);
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
