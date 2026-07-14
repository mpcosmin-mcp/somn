/**
 * Standalone Garmin → Sheet sync, run by GitHub Actions (see
 * .github/workflows/garmin-sync.yml) on a daily cron.
 *
 * Why not the Vercel /api/garmin/sync route: @gooin/garmin-connect drags a
 * heavy transitive tree (axios → form-data → …) that Vercel's serverless
 * tracer keeps dropping. In an Actions runner `npm ci` installs the whole tree,
 * so the library just works — the same code path that passes locally.
 *
 * Env (from GitHub repo secrets):
 *   GARMIN_EMAIL, GARMIN_PASSWORD, GARMIN_PLAYER  — the account + Sheet name
 *   SHEETS_API_URL                                — Apps Script Web App URL
 *   SHEETS_TOKEN                                  — write token (gates mutations)
 *   SYNC_DAYS (optional, default 3)               — look-back window
 */

import pkg from '@gooin/garmin-connect';
const { GarminConnect } = pkg;

const {
  GARMIN_EMAIL, GARMIN_PASSWORD, GARMIN_PLAYER,
  SHEETS_API_URL, SHEETS_TOKEN, SYNC_DAYS,
} = process.env;

for (const [k, v] of Object.entries({ GARMIN_EMAIL, GARMIN_PASSWORD, GARMIN_PLAYER, SHEETS_API_URL, SHEETS_TOKEN })) {
  if (!v) { console.error(`Missing env ${k}`); process.exit(1); }
}

const DAYS = Math.min(Math.max(parseInt(SYNC_DAYS ?? '3', 10) || 3, 1), 92);

/** Normalize whatever the Sheet returns (Google coerces dates) to YYYY-MM-DD. */
function normDate(raw) {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return new Date(d.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
}

function localHHMM(tsLocal) {
  if (!tsLocal) return '';
  const d = new Date(tsLocal);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

async function existingKeys() {
  const res = await fetch(`${SHEETS_API_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheets read ${res.status}`);
  const json = await res.json();
  const set = new Set();
  for (const r of json.data ?? []) set.add(`${normDate(r.date)}::${String(r.name ?? '').trim()}`);
  return set;
}

async function writeEntry(e) {
  const p = new URLSearchParams({
    action: 'write', token: SHEETS_TOKEN,
    date: e.date, name: e.name,
    sleep_score: String(e.ss), rhr: String(e.rhr),
    hrv: e.hrv == null ? '' : String(e.hrv),
    rem: e.rem == null ? '' : String(e.rem),
    journal: '', start: e.start ?? '', end: e.end ?? '',
  });
  const res = await fetch(`${SHEETS_API_URL}?${p}`, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheets write ${res.status}`);
  const j = await res.json().catch(() => ({}));
  if (j.status === 'error') throw new Error(`Sheets write rejected: ${j.error}`);
}

async function fetchNight(client, player, date) {
  const sleep = await client.getSleepData(date);
  const dto = sleep?.dailySleepDTO;
  if (!dto?.calendarDate || !dto.sleepTimeSeconds) return null;

  const ss = dto.sleepScores?.overall?.value;
  let rhr = sleep.restingHeartRate;
  if (!rhr) {
    try { rhr = (await client.getHeartRate(date))?.restingHeartRate; } catch { rhr = 0; }
  }
  if (!ss || !rhr) return null;

  const remSec = dto.remSleepSeconds;
  const hrv = sleep.avgOvernightHrv;
  return {
    date: dto.calendarDate,
    name: player,
    ss: Math.round(ss),
    rhr: Math.round(rhr),
    hrv: hrv ? Math.round(hrv) : null,
    rem: dto.deviceRemCapable && remSec ? Math.round(remSec / 60) : null,
    start: localHHMM(dto.sleepStartTimestampLocal),
    end: localHHMM(dto.sleepEndTimestampLocal),
  };
}

async function main() {
  const existing = await existingKeys();
  const client = new GarminConnect({ username: GARMIN_EMAIL, password: GARMIN_PASSWORD });
  await client.login();

  const synced = [], skipped = [], empty = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (existing.has(`${iso}::${GARMIN_PLAYER}`)) { skipped.push(iso); continue; }
    const entry = await fetchNight(client, GARMIN_PLAYER, d);
    if (!entry) { empty.push(iso); continue; }
    if (existing.has(`${entry.date}::${entry.name}`)) { skipped.push(entry.date); continue; }
    await writeEntry(entry);
    existing.add(`${entry.date}::${entry.name}`);
    synced.push(entry.date);
  }

  console.log(JSON.stringify({ ok: true, player: GARMIN_PLAYER, synced, skipped, empty }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
