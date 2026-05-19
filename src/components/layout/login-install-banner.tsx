'use client';
import { useState } from 'react';
import { useInstall } from '@/lib/use-install';

/**
 * Big, friendly install CTA shown on the login picker.
 *
 * Unlike the floating `<InstallToast />` (which auto-dismisses and lives
 * on the dashboard), this banner stays visible on every fresh login
 * until the user is actually running in standalone mode. The point:
 * mobile users land here every session, so they can't miss the option
 * to install.
 *
 * Hidden when:
 *   • The app is already installed (`isStandalone`), OR
 *   • There's no install path at all (no Chromium prompt AND not iOS).
 */
export function LoginInstallBanner() {
  const { canInstall, isStandalone, iosHint, install } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (isStandalone) return null;
  if (!canInstall && !iosHint) return null;

  const onPrimary = () => {
    if (canInstall) {
      void install();
      return;
    }
    if (iosHint) setIosOpen((v) => !v);
  };

  return (
    <div className="mb-4">
      <div
        className="relative overflow-hidden rounded-2xl border px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 5%, transparent))',
          borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 24%, transparent)',
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
          <div className="text-sm font-bold text-[var(--color-fg)] leading-tight">Instalează somn ca aplicație</div>
          <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
            {canInstall
              ? 'Pe ecranul de start, fără chrome de browser.'
              : 'Share → Add to Home Screen pe iPhone.'}
          </div>
        </div>
        <button
          onClick={onPrimary}
          className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
          }}
        >
          {canInstall ? 'Instalează' : 'Cum?'}
        </button>
      </div>

      {iosOpen && iosHint && (
        <div
          className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 fade-in-up"
          role="dialog"
          aria-label="Cum instalez pe iPhone"
        >
          <ol className="text-[11px] text-[var(--color-fg-muted)] leading-relaxed space-y-1 list-decimal pl-4">
            <li>Apasă pictograma <strong className="text-[var(--color-fg)]">Share</strong> din bara Safari (sus sau jos).</li>
            <li>Scrollează în meniu și alege <strong className="text-[var(--color-fg)]">Add to Home Screen</strong>.</li>
            <li>Confirmă cu <strong className="text-[var(--color-fg)]">Add</strong> sus-dreapta.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
