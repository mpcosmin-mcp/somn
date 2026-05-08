import { NextResponse } from 'next/server';
import { SHEETS_API } from '@/lib/config';

/**
 * POST /api/sheets/cleanup
 * Calls the Apps Script with `action=cleanup` to physically remove
 * duplicate (date, name) rows from the Sheet, keeping the most-complete one.
 *
 * Returns: { ok: boolean, removed: number }
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  try {
    const url = `${SHEETS_API}?action=cleanup`;
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
