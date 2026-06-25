'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Modal — centered overlay (ShapeSquad-style). A contained card fixed in the
 * middle of the screen on desktop, bottom-sheet on mobile. Backdrop dim+blur,
 * Escape + backdrop-click to close, focus-trap with focus restore on close.
 *
 * Minimal 5-prop contract — header chips / titles compose inside `title`.
 */
export function Modal({ open, onClose, title, widthClass = 'md:max-w-md', children }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Desktop max width (md+). Mobile is a full-width bottom sheet. */
  widthClass?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    document.body.style.overflow = 'hidden';

    // Focus into the panel on open.
    const panel = panelRef.current;
    requestAnimationFrame(() => panel?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const f = panel.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-6 bg-black/60 backdrop-blur-sm backdrop-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={`modal-pop outline-none overflow-y-auto bg-[var(--color-bg)] shadow-2xl shadow-black/50
          w-full max-h-[92dvh] rounded-t-3xl border-t border-[var(--color-border)]
          md:max-h-[85vh] md:rounded-2xl md:border ${widthClass} pb-safe`}
      >
        {title != null && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-md">
            <div className="min-w-0">{title}</div>
            <button
              onClick={onClose}
              aria-label="Închide"
              className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-xl leading-none text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
