'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { fetchPatterns, type Patterns } from '@/lib/client-api';
import { FIRST_NAME } from '@/lib/sleep';
import { weekKey } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const PATTERNS_KEY = (user: string, week: string) => `somn_patterns_${user}_${week}`;

/**
 * Small AI icon button that opens a popup with weekly pattern insights.
 * Cached per ISO week per user. Replaces the always-open PatternCard.
 */
export function PatternPopup() {
  const { user } = useUser();
  const { entries } = useEntries();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Patterns | null>(null);
  const [loading, setLoading] = useState(false);

  const wk = weekKey();
  const fn = user ? (FIRST_NAME[user] ?? user.split(' ')[0]) : '';

  // Prefetch on mount so the popup opens with content already there
  useEffect(() => {
    if (!user) return;
    const cacheKey = PATTERNS_KEY(user, wk);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached) as Patterns);
        return;
      }
    } catch { /* ignore */ }
    if (entries.length < 5) return;
    setLoading(true);
    fetchPatterns(user, entries)
      .then(p => {
        if (p.personal || p.team) {
          setData(p);
          try { localStorage.setItem(cacheKey, JSON.stringify(p)); } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, [user, wk, entries]);

  // Esc closes popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;

  return (
    <>
      {/* Trigger button — round AI icon */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Pattern finder · săptămâna asta"
        aria-label="Pattern finder"
        className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 transition-colors w-full"
      >
        <span className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-base shrink-0">
          📊
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wider font-semibold">pattern finder</span>
          <span className="block text-xs text-[var(--color-fg)] truncate">
            {loading ? 'caut pattern-uri...' : data ? `vezi ${fn} vs echipa` : 'apasă pentru insight'}
          </span>
        </span>
      </button>

      {/* Popup overlay */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            aria-hidden
          />
          <div
            className="fixed z-[70] inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto"
            role="dialog"
            aria-label="Pattern finder"
          >
            <Card className="p-5 relative">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-lg">📊</div>
                <div className="flex-1">
                  <div className="label">pattern finder · {wk}</div>
                  <div className="text-sm font-bold">despre {fn} + echipă</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
                  aria-label="Închide"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {loading && (
                <div className="text-xs text-[var(--color-fg-muted)] italic py-4 text-center">caut pattern-uri...</div>
              )}

              {!loading && data && (
                <div className="space-y-4">
                  {data.personal && (
                    <div>
                      <div className="label mb-1.5">despre {fn}</div>
                      <p className="text-sm leading-relaxed">{data.personal}</p>
                    </div>
                  )}
                  {data.team && (
                    <div>
                      <div className="label mb-1.5">despre echipă</div>
                      <p className="text-sm leading-relaxed">{data.team}</p>
                    </div>
                  )}
                </div>
              )}

              {!loading && !data && (
                <p className="text-xs text-[var(--color-fg-dim)] italic py-4 text-center">
                  {entries.length < 5 ? 'minim 5 loguri necesare pentru pattern-uri.' : 'AI nu a returnat nimic.'}
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
