'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { fetchAllEntries } from '@/lib/client-api';

interface Ctx {
  entries: SleepEntry[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  /** Optimistic update: replace any (date, name) match with the new entry */
  upsertLocal: (entry: SleepEntry) => void;
}

const EntriesContext = createContext<Ctx | null>(null);

/* ─── localStorage cache (stale-while-revalidate) ──────────
 * On mount we hydrate from the cached snapshot INSTANTLY, then
 * refetch in the background. The slow Google Apps Script call
 * (4-10s) never blocks the first paint.
 *
 * Bump CACHE_VERSION whenever the SleepEntry shape changes so old
 * cached records don't poison the app. */
const CACHE_VERSION = 1;
const CACHE_KEY = `somn_entries_cache_v${CACHE_VERSION}`;

interface CachedSnapshot {
  ts: number;
  entries: SleepEntry[];
}

function readCache(): CachedSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSnapshot;
    if (!parsed?.entries || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(entries: SleepEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    const snap: CachedSnapshot = { ts: Date.now(), entries };
    localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
  } catch { /* quota / unavailable — non-fatal */ }
}

/**
 * Team-wide sleep data provider.
 *
 *   • First paint hydrates from localStorage cache (instant).
 *   • A background refetch keeps the data fresh — when it returns,
 *     state + cache update together.
 *   • Pages just read entries / loading / refetch from this context.
 */
export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    try {
      setError('');
      const data = await fetchAllEntries();
      setEntries(data);
      writeCache(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'eroare la sync');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: pull cached snapshot into state INSTANTLY so the UI has
  // something to show. Then refetch in the background (the result
  // overwrites both state and cache when it arrives).
  useEffect(() => {
    const cached = readCache();
    if (cached?.entries.length) {
      setEntries(cached.entries);
      setLoading(false);  // we have data to render right now
    }
    refetch();
  }, [refetch]);

  const upsertLocal = useCallback((entry: SleepEntry) => {
    setEntries(prev => {
      const filtered = prev.filter(e => !(e.date === entry.date && e.name === entry.name));
      const next = [...filtered, entry];
      writeCache(next);
      return next;
    });
  }, []);

  return (
    <EntriesContext.Provider value={{ entries, loading, error, refetch, upsertLocal }}>
      {children}
    </EntriesContext.Provider>
  );
}

export function useEntries(): Ctx {
  const ctx = useContext(EntriesContext);
  if (!ctx) {
    return {
      entries: [],
      loading: false,
      error: '',
      refetch: async () => {},
      upsertLocal: () => {},
    };
  }
  return ctx;
}
