'use client';
import { useEffect, useState } from 'react';

const KEY = 'somn_user';

export function useUser() {
  const [user, setUserRaw] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setUserRaw(v);
    } catch { /* localStorage may be blocked */ }
    setHydrated(true);
  }, []);

  const setUser = (n: string | null) => {
    setUserRaw(n);
    try {
      if (n) localStorage.setItem(KEY, n);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  };

  return { user, setUser, hydrated };
}
