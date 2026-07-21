import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, hasPostgres } from '@/lib/db';

/**
 * POST /api/sheets/cleanup
 *
 * Historically removed duplicate (date, name) rows from the Google Sheet. On
 * Neon the primary key is (date, name), so duplicates are structurally
 * impossible — this is now a no-op kept only so the existing client helper
 * (`cleanupDuplicates`) keeps working. Always reports `removed: 0`.
 *
 * Still gated behind CRON_SECRET, mirroring the old destructive contract.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get('key') === secret
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    if (hasPostgres()) await ensureSchema();
    return NextResponse.json({ ok: true, removed: 0 });
  } catch (err) {
    console.error('[/api/sheets/cleanup]', err);
    return NextResponse.json(
      { ok: false, removed: 0, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
