'use client';
import { useState } from 'react';
import { useInstall } from '@/lib/use-install';

/**
 * TopBar download-icon button. Triggers the native PWA prompt on Chromium,
 * or opens a small popover with iOS-specific instructions on Safari.
 *
 * Hidden entirely when the app is already running as an installed PWA, or
 * when neither install path is available (e.g. desktop Firefox without
 * prompt support and no iOS hint).
 */
export function InstallButton() {
  const { canInstall, isStandalone, iosHint, install } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (isStandalone) return null;
  if (!canInstall && !iosHint) return null;

  const onClick = () => {
    if (canInstall) {
      void install();
      return;
    }
    if (iosHint) setIosOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        title={canInstall ? 'Instalează aplicația' : 'Adaugă pe ecran (iOS)'}
        aria-label="Instalează aplicația"
        className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {iosOpen && iosHint && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIosOpen(false)} aria-hidden />
          <div
            className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl shadow-black/40 p-3 z-40 fade-in-up"
            role="dialog"
            aria-label="Instalează pe iPhone"
          >
            <div className="text-xs font-bold mb-1.5">Adaugă pe iPhone</div>
            <ol className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed space-y-1 list-decimal pl-4">
              <li>Apasă pictograma Share <span aria-hidden>↑</span> din bara Safari.</li>
              <li>Scrollează și alege <strong className="text-[var(--color-fg)]">Add to Home Screen</strong>.</li>
              <li>Confirmă cu <strong className="text-[var(--color-fg)]">Add</strong> sus-dreapta.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
