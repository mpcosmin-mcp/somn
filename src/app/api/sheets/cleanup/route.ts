import { NextRequest, NextResponse } from 'next/server';
import { requireSheetsApi, withToken } from '@/lib/config';

/**
 * POST /api/sheets/cleanup
 * Calls the Apps Script with `action=cleanup` to physically remove
 * duplicate (date, name) rows from the Sheet, keeping the most-complete one.
 *
 * DESTRUCTIVE + unauthenticated-by-default is a bad combination: this deletes
 * rows the UI may be showing (incl. journal-bearing ones). It is gated behind
 * CRON_SECRET and has no UI caller — run it deliberately, never on a whim.
 *
 * Returns: { ok: boolean, removed: number }
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
    const url = withToken(`${requireSheetsApi()}?action=cleanup`);
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets cleanup ${res.status}`);
    const json = (await res.json()) as { status?: string; removed?: number };
    return NextResponse.json({ ok: json.status === 'ok', removed: json.removed ?? 0 });
  } catch (err) {
    console.error('[/api/sheets/cleanup]', err);
    return NextResponse.json(
      { ok: false, removed: 0, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
