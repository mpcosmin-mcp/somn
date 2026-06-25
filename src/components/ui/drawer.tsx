'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Drawer — the app's overlay primitive. Bottom-sheet on mobile, right slide-in
 * on desktop. Reuses the metric-modal overlay mechanics (backdrop, Escape,
 * scroll-lock) and adds a focus-trap with focus restore on close.
 *
 * Minimal 6-prop contract — nav / pills / titles compose inside `title`/children.
 * Single-drawer-at-a-time (no nesting in v1).
 */
export function Drawer({ open, onClose, title, widthClass = 'md:w-[40rem]', children }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Desktop panel width (md+). Mobile is always full-width sheet. */
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
      className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end bg-black/55 backdrop-blur-sm backdrop-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={`drawer-anim outline-none overflow-y-auto bg-[var(--color-bg)] shadow-2xl shadow-black/50
          w-full max-h-[92dvh] rounded-t-3xl border-t border-[var(--color-border)]
          md:h-dvh md:max-h-none md:rounded-t-none md:rounded-l-3xl md:border-t-0 md:border-l ${widthClass} md:max-w-[94vw] pb-safe`}
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
