'use client';
import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'somn_theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(KEY) as Theme | null) || 'dark';
      setThemeState(saved);
      document.documentElement.classList.toggle('light', saved === 'light');
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle('light', t === 'light');
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggle, hydrated };
}

/* Inline script to set theme before hydration — prevents flash */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}')||'dark';if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;
