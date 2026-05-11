'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';

const VIBE_KEY = (user: string, lastDate: string) => `somn_vibe_${user}_${lastDate}`;

/**
 * Top-of-dashboard AI greeting. A short, personalized 2-sentence message
 * generated daily by Haiku. Sets the tone for the page.
 *
 * Cached per (user, most-recent-log-date). Bumps on new log.
 */
export function PageVibe({ user, entries }: { user: string; entries: SleepEntry[] }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Use the latest date the team has logged as cache key (any log = potential new vibe)
  const lastDate = [...new Set(entries.map(e => e.date))].sort().slice(-1)[0] ?? '';

  useEffect(() => {
    if (!user || !lastDate) { setText(null); return; }
    const cacheKey = VIBE_KEY(user, lastDate);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setText(cached); return; }
    } catch { /* ignore */ }
    if (entries.length < 3) return;
    setLoading(true);
    fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, entries }),
    })
      .then(r => r.json())
      .then((j: { text?: string }) => {
        if (j.text) {
          setText(j.text);
          try { localStorage.setItem(cacheKey, j.text); } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, lastDate, entries]);

  if (!text && !loading) return null;

  return (
    <Card className="px-4 py-3 relative overflow-hidden">
      {/* Soft gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle at 0% 100%, rgba(239, 68, 68, 0.12), transparent 60%)' }}
      />
      <div className="relative flex items-start gap-3">
        <div className="shrink-0">
          <Lobster size={48} talking={loading} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label mb-1">somn ai · zice ceva</div>
          {loading && <div className="text-xs text-[var(--color-fg-muted)] italic">se gândește...</div>}
          {!loading && text && (
            <p className="text-sm leading-relaxed">{text}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
