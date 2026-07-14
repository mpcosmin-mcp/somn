/* Server-side Garmin Connect client — never imported from client components.
 *
 * Uses the unofficial @gooin/garmin-connect library (email + password, same
 * auth flow as the official app). OAuth tokens are persisted in Vercel KV so
 * the daily cron reuses the session instead of re-logging with the password
 * every run (Garmin throttles repeated password logins).
 *
 * Credentials come from env: GARMIN_EMAIL / GARMIN_PASSWORD, and
 * GARMIN_PLAYER must hold the exact Sheet name the entries belong to
 * (e.g. "Petrica Cosmin Moga"). No account is hardcoded here.
 */

import type { GarminConnect } from '@gooin/garmin-connect';
import type { IGarminTokens, IOauth1Token, IOauth2Token } from '@gooin/garmin-connect/dist/garmin/types';
import { kv } from '@vercel/kv';
import type { SleepEntry } from '@/lib/sleep';

const TOKEN_KEY_PREFIX = 'garmin:tokens:';

/** KV is optional locally (no .env KV vars) — degrade to password login. */
function kvAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function loadTokens(email: string): Promise<IGarminTokens | null> {
  if (!kvAvailable()) return null;
  try {
    return await kv.get<IGarminTokens>(TOKEN_KEY_PREFIX + email);
  } catch {
    return null;
  }
}

async function saveTokens(email: string, tokens: IGarminTokens): Promise<void> {
  if (!kvAvailable()) return;
  try {
    await kv.set(TOKEN_KEY_PREFIX + email, tokens);
  } catch {
    // Token persistence is an optimization, not a requirement — next run
    // falls back to a password login.
  }
}

export interface GarminAccount {
  email: string;
  password: string;
  /** Exact `name` used in the Sheet (see NAMES in lib/sleep.ts). */
  player: string;
}

/** Read the single configured account from env. Throws if incomplete. */
export function accountFromEnv(): GarminAccount {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  const player = process.env.GARMIN_PLAYER;
  if (!email || !password || !player) {
    throw new Error('GARMIN_EMAIL / GARMIN_PASSWORD / GARMIN_PLAYER not configured');
  }
  return { email, password, player };
}

/**
 * Log in, preferring stored OAuth tokens over the password. Verifies the
 * session with a cheap profile call; on any failure falls back to a fresh
 * password login and stores the new tokens.
 */
export async function garminLogin(account: GarminAccount): Promise<GarminConnect> {
  // Import lazily inside the handler: this unofficial package runs code at
  // module load that crashes Next's serverless module graph on Vercel. Loading
  // it at call time keeps the crash inside the route's try/catch (surfaced as
  // JSON) instead of a bare 500 error page.
  const { GarminConnect } = await import('@gooin/garmin-connect');
  const client = new GarminConnect({ username: account.email, password: account.password });
  client.onSessionChange((tokens) => { void saveTokens(account.email, tokens); });

  const stored = await loadTokens(account.email);
  if (stored?.oauth1 && stored?.oauth2) {
    try {
      client.loadToken(stored.oauth1 as IOauth1Token, stored.oauth2 as IOauth2Token);
      await client.getUserProfile();
      return client;
    } catch {
      // stale/revoked tokens — fall through to password login
    }
  }

  await client.login();
  await saveTokens(account.email, client.exportToken());
  return client;
}

/** Format an epoch-ms timestamp that Garmin already shifted to local time. */
function localHHMM(tsLocal: number | null | undefined): string | null {
  if (!tsLocal) return null;
  const d = new Date(tsLocal);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Fetch one night and map it to a SleepEntry, or null when Garmin has no
 * usable data for that date (watch not worn, not yet synced, nap-only).
 * `date` is the WAKE date (Garmin's calendarDate convention — same as the app).
 */
export async function fetchNight(
  client: GarminConnect,
  player: string,
  date: Date,
): Promise<SleepEntry | null> {
  const sleep = await client.getSleepData(date);
  const dto = sleep?.dailySleepDTO;
  if (!dto?.calendarDate || !dto.sleepTimeSeconds) return null;

  const ss = dto.sleepScores?.overall?.value;
  // RHR: prefer the value on the sleep payload; fall back to the daily HR endpoint.
  let rhr = sleep.restingHeartRate;
  if (!rhr) {
    try {
      rhr = (await client.getHeartRate(date))?.restingHeartRate;
    } catch {
      rhr = 0;
    }
  }
  // Both are required by the Sheet write API — without them the night is unusable.
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
    journal: null,
    start: localHHMM(dto.sleepStartTimestampLocal),
    end: localHHMM(dto.sleepEndTimestampLocal),
  };
}
