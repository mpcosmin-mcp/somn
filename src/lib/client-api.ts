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

export async function fetchDailyRoast(name: string, entries: SleepEntry[]): Promise<string> {
  const res = await fetch('/api/roast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, entries: entries.slice(-7) }),
  });
  if (!res.ok) return '';
  const json = (await res.json()) as { text?: string };
  return json.text ?? '';
}

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

export async function chatTurn(user: string, messages: ChatMessage[], entries: SleepEntry[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, messages, entries }),
  });
  if (!res.ok) return 'Eroare la generare.';
  const json = (await res.json()) as { text?: string };
  return json.text ?? '';
}
