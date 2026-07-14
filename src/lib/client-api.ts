/* Client-side helpers — call our own /api routes, no JSONP */
'use client';

import { type SleepEntry } from '@/lib/sleep';
import { fetchWithRetry } from '@/lib/fetch-retry';

export async function fetchAllEntries(opts: { fresh?: boolean } = {}): Promise<SleepEntry[]> {
  const url = opts.fresh ? '/api/sheets?fresh=1' : '/api/sheets';
  const res = await fetchWithRetry(url, { cache: 'no-store', retries: 2, timeoutMs: 12_000 });
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
  if (!res.ok) {
    // Surface the server's Romanian validation message (e.g. "rhr=20 în afara
    // intervalului permis") instead of the raw "POST /api/sheets 400".
    const msg = await res.json().then(j => j?.error).catch(() => null);
    throw new Error(msg || `Eroare la salvare (${res.status})`);
  }
}

export async function cleanupDuplicates(): Promise<{ ok: boolean; removed: number }> {
  const res = await fetch('/api/sheets/cleanup', { method: 'POST' });
  if (!res.ok) return { ok: false, removed: 0 };
  const json = (await res.json()) as { ok: boolean; removed: number };
  return json;
}
