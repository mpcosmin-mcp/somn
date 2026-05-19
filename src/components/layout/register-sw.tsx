'use client';
import { useEffect } from 'react';

/**
 * Registers the service worker once after mount. No UI — pure side effect.
 *
 * Skipped in development unless explicitly enabled, because Turbopack and
 * an active SW can fight over module updates. We register in production
 * builds only (`process.env.NODE_ENV === 'production'`).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[somn] SW registration failed', err);
    });
  }, []);

  return null;
}
