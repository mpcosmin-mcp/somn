'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Collapsed state for the left rail, persisted so it stays how you left it. */
const KEY = 'somn:rail-collapsed';
const RailCtx = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => {},
});

export function RailProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    // No saved preference → open on desktop, closed on mobile (where the rail
    // is a full-screen overlay and shouldn't cover the dashboard on load).
    setCollapsed(stored != null ? stored === '1' : window.innerWidth < 1024);
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Before hydration, render as expanded to match SSR and avoid a layout flash.
  return (
    <RailCtx.Provider value={{ collapsed: hydrated ? collapsed : false, toggle }}>
      {children}
    </RailCtx.Provider>
  );
}

export function useRail() {
  return useContext(RailCtx);
}
