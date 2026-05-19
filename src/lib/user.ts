'use client';
import { createContext, useCallback, useContext, useState, type ReactNode, createElement } from 'react';

interface Ctx {
  user: string | null;
  setUser: (n: string | null) => void;
  hydrated: boolean;
}

const UserContext = createContext<Ctx | null>(null);

/**
 * Session-only user state. No persistence — every fresh open of the app
 * lands on the login page (UserPicker). Closing the tab clears the pick.
 *
 * `hydrated` is always true now (no async restore step), but the field
 * stays for API compatibility with the rest of the app.
 */
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);

  const set = useCallback((n: string | null) => {
    setUser(n);
  }, []);

  return createElement(UserContext.Provider, { value: { user, setUser: set, hydrated: true } }, children);
}

export function useUser(): Ctx {
  const ctx = useContext(UserContext);
  if (!ctx) return { user: null, setUser: () => {}, hydrated: true };
  return ctx;
}
