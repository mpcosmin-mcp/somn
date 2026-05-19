'use client';
import { useInstall } from '@/lib/use-install';

/**
 * One-time floating bottom-right toast prompting the user to install the
 * app. Auto-dismisses on click "Instalează" (Chromium) or after the user
 * hits "Mai târziu". The dismissal is persisted, so we don't nag.
 *
 * On iOS Safari, the same toast turns into a small instruction card
 * because the native prompt isn't available there.
 */
export function InstallToast() {
  const { canInstall, iosHint, toastVisible, install, dismissToast } = useInstall();

  if (!toastVisible) return null;

  const onInstall = async () => {
    await install();
    dismissToast();
  };

  return (
    <div
      className="fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-md shadow-2xl shadow-black/40 p-4 fade-in-up"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
            color: 'var(--color-accent)',
          }}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-[var(--color-fg)]">Instalează somn</h3>
          {canInstall ? (
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              Adaug-o pe desktop sau homescreen pentru un acces ca la o aplicație nativă.
            </p>
          ) : iosHint ? (
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              Pe iPhone: <strong className="text-[var(--color-fg)]">Share</strong> → <strong className="text-[var(--color-fg)]">Add to Home Screen</strong>.
            </p>
          ) : null}
          <div className="flex gap-2 mt-3">
            {canInstall && (
              <button
                onClick={onInstall}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-bg)',
                }}
              >
                Instalează
              </button>
            )}
            <button
              onClick={dismissToast}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            >
              {canInstall ? 'Mai târziu' : 'Am înțeles'}
            </button>
          </div>
        </div>
        <button
          onClick={dismissToast}
          aria-label="Închide"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] shrink-0 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
