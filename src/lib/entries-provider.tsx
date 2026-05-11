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

/**
 * Provides the team's full sleep data set to every page in the app.
 *
 * Pages that previously fetched on mount now read from this context —
 * navigating from /  to /detail (or back) is instant, no re-fetch.
 *
 * Mounted in root layout so the fetch happens ONCE per session.
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'eroare la sync');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const upsertLocal = useCallback((entry: SleepEntry) => {
    setEntries(prev => {
      const filtered = prev.filter(e => !(e.date === entry.date && e.name === entry.name));
      return [...filtered, entry];
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
    // Useful default for components rendered outside the provider (tests, errors)
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
