'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';

// v3 — Hipnos retired, Sforăilă (grumpy bear / beast mode) prompt. Old
// cached one-liners must not show up.
const KEY = (user: string, lastDate: string) => `somn_vibe_v3_${user}_${lastDate}`;

/**
 * Sforăilă one-liner — sits at the very top of the dashboard.
 *
 *   🦞 SFORĂILĂ · "una linie scurtă, după date — sau morocănos sau bestie"
 *
 * Single line. Fetched once per (user, latestLogDate), cached in
 * localStorage. Renders nothing if no AI text yet — silent, never empty
 * placeholder.
 */
export function SforailaLine({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const [text, setText] = useState<string | null>(null);
  const lastDate = [...new Set(entries.map(e => e.date))].sort().slice(-1)[0] ?? '';

  useEffect(() => {
    if (!user || !lastDate) return;
    const k = KEY(user, lastDate);
    try {
      const cached = localStorage.getItem(k);
      if (cached) { setText(cached); return; }
    } catch { /* ignore */ }
    if (entries.length < 3) return;

    fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, entries }),
    })
      .then(r => r.json())
      .then((j: { text?: string }) => {
        if (j.text) {
          setText(j.text);
          try { localStorage.setItem(k, j.text); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, [user, lastDate, entries]);

  if (!text) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border relative overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(99,102,241,0.08), transparent 70%)',
        borderColor: 'rgba(129,140,248,0.18)',
      }}
    >
      <span className="text-base shrink-0" aria-hidden>🐻</span>
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] shrink-0">
        Sforăilă
      </span>
      <span className="text-[var(--color-fg-dim)] shrink-0 hidden sm:inline">·</span>
      <p className="text-sm text-[var(--color-fg)] truncate flex-1 min-w-0">{text}</p>
    </div>
  );
}
