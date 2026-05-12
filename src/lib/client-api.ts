/* Client-side helpers — call our own /api routes, no JSONP */
'use client';

import { type SleepEntry } from '@/lib/sleep';

export async function fetchAllEntries(): Promise<SleepEntry[]> {
  const res = await fetch('/api/sheets', { cache: 'no-store' });
  if (!res.ok) throw new Error(`/api/sheets ${res.status}`);
  const json = (await res.json()) as { entries: SleepEntry[] };
  return json.entries ?? [];
}

export async function submitEntry(e: Omit<SleepEntry, never>): Promise<void> {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(e),
  });
  if (!res.ok) throw new Error(`POST /api/sheets ${res.status}`);
}

export async function cleanupDuplicates(): Promise<{ ok: boolean; removed: number }> {
  const res = await fetch('/api/sheets/cleanup', { method: 'POST' });
  if (!res.ok) return { ok: false, removed: 0 };
  const json = (await res.json()) as { ok: boolean; removed: number };
  return json;
}
