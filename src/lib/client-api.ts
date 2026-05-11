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

/* fetchDailyRoast is intentionally NOT exported — DailyRoast component inlines
   the call so it can include the journal length in the cache key. */

export async function fetchWeeklyStory(entries: SleepEntry[]): Promise<string> {
  const res = await fetch('/api/story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as { text?: string };
  return json.text ?? '';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTurnResult {
  text: string;
  mutated: boolean;
  actions: { label: string }[];
}

export async function chatTurn(user: string, messages: ChatMessage[], entries: SleepEntry[]): Promise<ChatTurnResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, messages, entries }),
  });
  if (!res.ok) return { text: 'Eroare la generare.', mutated: false, actions: [] };
  const json = (await res.json()) as ChatTurnResult;
  return {
    text: json.text ?? '',
    mutated: !!json.mutated,
    actions: json.actions ?? [],
  };
}

export interface Patterns {
  personal: string;
  team: string;
}

export async function fetchPatterns(user: string, entries: SleepEntry[]): Promise<Patterns> {
  const res = await fetch('/api/patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, entries }),
  });
  if (!res.ok) return { personal: '', team: '' };
  const json = (await res.json()) as Patterns;
  return { personal: json.personal ?? '', team: json.team ?? '' };
}

export async function cleanupDuplicates(): Promise<{ ok: boolean; removed: number }> {
  const res = await fetch('/api/sheets/cleanup', { method: 'POST' });
  if (!res.ok) return { ok: false, removed: 0 };
  const json = (await res.json()) as { ok: boolean; removed: number };
  return json;
}
