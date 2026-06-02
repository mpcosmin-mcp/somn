'use client';
import { useEffect, useState } from 'react';
import { LogEntry } from '@/components/dashboard/log-entry';
import { useEntries } from '@/lib/entries-provider';

/**
 * Floating button (bottom-right) that opens the LogEntry form in a modal.
 * The form has a date picker so the user can log for past days (e.g. weekend
 * data entered Monday).
 */
export function LogEntryButton({ user }: { user: string }) {
  const [open, setOpen] = useState(false);
  const { entries, refetch, upsertLocal } = useEntries();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Adaugă log"
        className="fixed bottom-5 right-5 z-40 h-14 pl-4 pr-5 rounded-full flex items-center gap-2 font-bold text-sm text-white shadow-xl shadow-black/40 transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))',
          boxShadow: '0 12px 28px -8px var(--color-accent-glow)',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <span className="text-xl leading-none">+</span>
        <span>log</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 fade-in-up"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full md:max-w-md max-h-[92vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Adaugă log"
          >
            <LogEntry
              user={user}
              entries={entries}
              onSaved={(entry) => {
                upsertLocal(entry);
                refetch();
              }}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
