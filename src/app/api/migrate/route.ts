import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetEntries, hasSheetsSource } from '@/lib/sheets-source';
import { getAllEntries, upsertMany, hasPostgres } from '@/lib/db';
import { invalidateEntriesCache } from '@/lib/sheets-cache';

/**
 * One-time migration: Google Sheet → Neon (Vercel Postgres).
 *
 * Reads every row from the Sheet (via the tolerant parser) and upserts it into
 * the `entries` table. Idempotent — safe to run more than once; upserts by
 * (date, name), so re-running just refreshes rows, never duplicates them.
 *
 * Gated behind CRON_SECRET (same as the other privileged routes). Run once from
 * a browser on an environment that has SHEETS_API_URL set (prod does):
 *   https://<deployment>/api/migrate?key=<CRON_SECRET>
 *
 * After it runs, `/api/sheets` reads from Neon and the Sheet fallback goes
 * dormant. This route can be deleted once the migration is confirmed.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get('key') === secret
  );
}

async function run() {
  if (!hasPostgres()) {
    return NextResponse.json(
      { ok: false, error: 'POSTGRES_URL not set — link a Neon database to the project first.' },
      { status: 500 },
    );
  }
  if (!hasSheetsSource()) {
    return NextResponse.json(
      { ok: false, error: 'SHEETS_API_URL not set on this environment — cannot read the source Sheet.' },
      { status: 500 },
    );
  }

  const source = await fetchSheetEntries();
  const written = await upsertMany(source);
  invalidateEntriesCache();
  const total = (await getAllEntries()).length;

  return NextResponse.json({
    ok: true,
    read_from_sheet: source.length,
    written,
    total_in_neon: total,
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    return await run();
  } catch (err) {
    console.error('[/api/migrate]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export const POST = GET;
