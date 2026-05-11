'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, createElement } from 'react';

const KEY = 'somn_user';

interface Ctx {
  user: string | null;
  setUser: (n: string | null) => void;
  hydrated: boolean;
}

const UserContext = createContext<Ctx | null>(null);

/**
 * Provides a single source-of-truth user state across the app.
 *
 * BEFORE this provider: every `useUser()` call created its own local
 * useState. When Sidebar called setUser(), only the Sidebar's local
 * copy updated — Hero, Leaderboard, AI cards etc. kept the OLD user
 * until the next page reload. That was the "switching user updates
 * only the menu" bug.
 *
 * NOW: the state lives in this Provider, `useUser()` is just useContext,
 * and setUser() updates everyone synchronously.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserRaw] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setUserRaw(v);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const setUser = useCallback((n: string | null) => {
    setUserRaw(n);
    try {
      if (n) localStorage.setItem(KEY, n);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }, []);

  return createElement(UserContext.Provider, { value: { user, setUser, hydrated } }, children);
}

export function useUser(): Ctx {
  const ctx = useContext(UserContext);
  if (!ctx) {
    // Safety fallback if hook is used outside provider (shouldn't happen in app)
    return { user: null, setUser: () => {}, hydrated: false };
  }
  return ctx;
}
