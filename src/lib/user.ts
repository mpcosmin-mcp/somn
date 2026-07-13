'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, createElement } from 'react';

interface Ctx {
  user: string | null;
  setUser: (n: string | null) => void;
  /** False until the stored pick has been read. AppShell waits on this so the
   *  login screen doesn't flash for a fraction of a second on every open. */
  hydrated: boolean;
}

const STORAGE_KEY = 'somn_user';

const UserContext = createContext<Ctx | null>(null);

/**
 * Persisted user state.
 *
 * The pick survives reloads and app restarts (localStorage). This is a private
 * 3-person tracker installed as a PWA — a mandatory re-login on every open cost
 * two taps a day and protected nothing. Signing out is explicit: the profile
 * popover's "Schimbă utilizator" clears the key.
 *
 * Restored in an effect rather than during render: reading localStorage while
 * rendering would make the server and client markup disagree and hydration
 * would blow up.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(stored);
    } catch {
      /* private mode / storage disabled — fall back to a session-only pick */
    }
    setHydrated(true);
  }, []);

  const set = useCallback((n: string | null) => {
    setUser(n);
    try {
      if (n) localStorage.setItem(STORAGE_KEY, n);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore — the in-memory pick still works for this session */
    }
  }, []);

  return createElement(UserContext.Provider, { value: { user, setUser: set, hydrated } }, children);
}

export function useUser(): Ctx {
  const ctx = useContext(UserContext);
  if (!ctx) return { user: null, setUser: () => {}, hydrated: true };
  return ctx;
}
