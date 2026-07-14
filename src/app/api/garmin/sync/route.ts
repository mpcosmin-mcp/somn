import { NextRequest, NextResponse } from 'next/server';
import { SHEETS_API } from '@/lib/config';
import { normalizeDate, type Cell } from '@/lib/sheet-parse';
import { invalidateEntriesCache } from '@/lib/sheets-cache';
import { fetchWithRetry } from '@/lib/fetch-retry';
import { accountFromEnv, garminLogin, fetchNight } from '@/lib/garmin';
import type { SleepEntry } from '@/lib/sleep';

/**
 * GET /api/garmin/sync — pulls the last few nights from Garmin Connect and
 * writes any MISSING (date, name) rows to the Sheet. Existing rows are never
 * touched, so manual edits (journal, corrections) are safe and the endpoint
 * is idempotent — the daily Vercel cron can fire it blindly.
 *
 * Query: ?days=N  how many wake-dates to look back, ending today (default 3 —
 *                 self-heals a missed cron run or a late watch sync).
 *        ?dry=1   read Garmin + report what WOULD be written, write nothing.
 *
 * Auth: when CRON_SECRET is set (it is, in prod), requires either the
 * `Authorization: Bearer <CRON_SECRET>` header (what Vercel cron sends) or
 * `?key=<CRON_SECRET>` for manual runs from a browser.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Garmin login + Apps Script writes are slow

const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 92; // ~3 luni — plafonul pentru backfill manual

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production'; // local dev: open
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.nextUrl.searchParams.get('key') === secret
  );
}

/** (date, name) pairs already in the Sheet — the only thing we need to read. */
async function existingKeys(): Promise<Set<string>> {
  const res = await fetchWithRetry(`${SHEETS_API}?v=${Date.now()}`, {
    cache: 'no-store', retries: 2, timeoutMs: 15_000,
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}`);
  const json = (await res.json()) as { data?: { date?: Cell; name?: Cell }[] };
  return new Set(
    (json.data ?? []).map(r => `${normalizeDate(r.date)}::${String(r.name ?? '').trim()}`),
  );
}

async function writeEntry(e: SleepEntry): Promise<void> {
  const params = new URLSearchParams({
    action: 'write',
    date: e.date,
    name: e.name,
    sleep_score: String(e.ss),
    rhr: String(e.rhr),
    hrv: e.hrv == null ? '' : String(e.hrv),
    rem: e.rem == null ? '' : String(e.rem),
    journal: '',
    start: e.start ?? '',
    end: e.end ?? '',
  });
  const res = await fetch(`${SHEETS_API}?${params}`, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheets API write ${res.status}`);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const account = accountFromEnv();
    const daysRaw = parseInt(req.nextUrl.searchParams.get('days') ?? '', 10);
    const days = Math.min(
      Math.max(isNaN(daysRaw) ? DEFAULT_LOOKBACK_DAYS : daysRaw, 1),
      MAX_LOOKBACK_DAYS,
    );

    const dry = req.nextUrl.searchParams.get('dry') === '1';

    const existing = await existingKeys();
    const client = await garminLogin(account);

    const synced: string[] = [];
    const skipped: string[] = [];
    const empty: string[] = [];
    const preview: SleepEntry[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      if (existing.has(`${iso}::${account.player}`)) {
        skipped.push(iso);
        continue;
      }
      const entry = await fetchNight(client, account.player, d);
      if (!entry) {
        empty.push(iso);
        continue;
      }
      // fetchNight keys the entry by Garmin's own calendarDate — re-check it,
      // since it may differ from the probe date around midnight boundaries.
      if (existing.has(`${entry.date}::${entry.name}`)) {
        skipped.push(entry.date);
        continue;
      }
      if (dry) {
        preview.push(entry);
      } else {
        await writeEntry(entry);
        synced.push(entry.date);
      }
      existing.add(`${entry.date}::${entry.name}`);
    }

    if (synced.length) invalidateEntriesCache();
    return NextResponse.json({
      ok: true, dry, player: account.player, synced, skipped, empty,
      ...(dry ? { preview } : {}),
    });
  } catch (err) {
    console.error('[/api/garmin/sync]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
