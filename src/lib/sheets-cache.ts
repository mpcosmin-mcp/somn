/**
 * In-memory cache for the parsed sheets entries.
 *
 * Shared between /api/sheets (read) and any route that mutates the sheet
 * (POST/DELETE on /api/sheets).
 *
 * Lives as a module-level singleton — in the Next.js server process it's
 * one cache per Node instance. On Vercel that means one cache per region/
 * lambda warm-up, which is fine for our 3-user team scale.
 */
import { type SleepEntry } from '@/lib/sleep';

const TTL_MS = 60_000; // 60 seconds — enough to coalesce burst reloads

interface Entry {
  data: SleepEntry[];
  ts: number;
}

let cache: Entry | null = null;

export function getCachedEntries(): SleepEntry[] | null {
  if (!cache) return null;
  if (Date.now() - cache.ts > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function setCachedEntries(entries: SleepEntry[]): void {
  cache = { data: entries, ts: Date.now() };
}

export function invalidateEntriesCache(): void {
  cache = null;
}
