'use client';
import { useEffect, useMemo, useState } from 'react';
import { SleepLogger } from '@/components/dashboard/sleep-logger';
import { useEntries } from '@/lib/entries-provider';
import { missingNights } from '@/lib/sleep';
import { todayStr } from '@/lib/utils';

/**
 * Two ways in, both one tap.
 *
 *   • the button logs the newest night you haven't logged yet (usually today);
 *   • the pill above it, which only shows up when nights are actually missing,
 *     opens all of them at once — the week-away case.
 *
 * Whichever you pick, the sheet opens with the cursor already on the first
 * number, so the next thing you do is type.
 */
export function LogEntryButton({ user }: { user: string }) {
  const [dates, setDates] = useState<string[] | null>(null);
  const { entries, refetch, upsertLocal } = useEntries();

  const missing = useMemo(() => missingNights(entries, user), [entries, user]);
  const open = dates !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDates(null); };
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
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {missing.length > 1 && (
          <button
            onClick={() => setDates(missing)}
            className="h-9 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-lg shadow-black/30 border transition-all hover:scale-105 active:scale-95 bg-[var(--color-card)] text-[var(--color-fg)] border-[var(--color-accent)]/50"
          >
            <span className="num" style={{ color: 'var(--color-accent)' }}>{missing.length}</span>
            <span className="font-semibold text-[var(--color-fg-muted)]">nopți nelogate</span>
          </button>
        )}

        <button
          onClick={() => setDates([missing[0] ?? todayStr()])}
          aria-label="Adaugă log"
          className="h-14 pl-4 pr-5 rounded-full flex items-center gap-2 font-bold text-sm text-white shadow-xl shadow-black/40 transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))',
            boxShadow: '0 12px 28px -8px var(--color-accent-glow)',
          }}
        >
          <span className="text-xl leading-none">+</span>
          <span>log</span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 fade-in-up"
          onClick={() => setDates(null)}
          role="presentation"
        >
          <div
            className="w-full md:max-w-lg"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Adaugă log"
          >
            <SleepLogger
              user={user}
              entries={entries}
              initialDates={dates}
              onSavedMany={saved => {
                // Paint the new nights immediately, then reconcile with the
                // store once — not once per night.
                saved.forEach(upsertLocal);
                void refetch({ fresh: true });
              }}
              onClose={() => setDates(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
