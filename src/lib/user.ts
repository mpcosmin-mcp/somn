'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, createElement } from 'react';

const KEY = 'somn_user';
const COOKIE = 'somn_user';
const YEAR_SECONDS = 60 * 60 * 24 * 365;

interface Ctx {
  user: string | null;
  setUser: (n: string | null) => void;
  hydrated: boolean;
}

const UserContext = createContext<Ctx | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return;
  if (value === null) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${YEAR_SECONDS}; Path=/; SameSite=Lax`;
  }
}

/**
 * Provides a single source-of-truth user state across the app.
 *
 * Persistence is DOUBLE-BACKED:
 *   • localStorage — primary, survives forever unless cleared
 *   • cookie       — 1-year max-age, survives even some "Clear site data"
 *                    flows and works on more browser configs (private modes,
 *                    embedded webviews, etc)
 * On load we read both and prefer the one that has a value.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserRaw] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let restored: string | null = null;
    try {
      restored = localStorage.getItem(KEY);
    } catch { /* ignore */ }
    if (!restored) restored = readCookie(COOKIE);
    if (restored) setUserRaw(restored);
    setHydrated(true);
  }, []);

  const setUser = useCallback((n: string | null) => {
    setUserRaw(n);
    try {
      if (n) localStorage.setItem(KEY, n);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    writeCookie(COOKIE, n);
  }, []);

  return createElement(UserContext.Provider, { value: { user, setUser, hydrated } }, children);
}

export function useUser(): Ctx {
  const ctx = useContext(UserContext);
  if (!ctx) return { user: null, setUser: () => {}, hydrated: false };
  return ctx;
}
