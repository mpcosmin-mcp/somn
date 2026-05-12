'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';

interface Observation {
  key: string;
  label: string;
  icon: string;
  text: string;
}

// v1 — first insights endpoint. Bump if prompt shape changes substantially.
const CACHE_KEY = (user: string, lastDate: string) => `somn_insights_v1_${user}_${lastDate}`;

/**
 * Sforăilă Insights — the bear's read on the squad.
 *
 *   3 observations rendered as a stack:
 *     📅 azi          · who logged today, who's still asleep
 *     📈 săptămâna    · weekly trend in his voice
 *     👑 clasament    · who's leading, by how much
 *
 *   Fetched from /api/insights, cached client-side per
 *   (user, latestLogDate). New data → new insights. Renders nothing
 *   silently while loading or if the AI can't reach Anthropic.
 */
export function SforailaInsights({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const [observations, setObservations] = useState<Observation[] | null>(null);
  const [loading, setLoading] = useState(false);

  const lastDate = [...new Set(entries.map(e => e.date))].sort().slice(-1)[0] ?? '';

  useEffect(() => {
    if (!user || !lastDate) return;
    const k = CACHE_KEY(user, lastDate);
    try {
      const cached = localStorage.getItem(k);
      if (cached) {
        const parsed = JSON.parse(cached) as Observation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setObservations(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    if (entries.length < 3) return;

    setLoading(true);
    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, entries }),
    })
      .then(r => r.json())
      .then((j: { observations?: Observation[] }) => {
        if (j.observations && j.observations.length > 0) {
          setObservations(j.observations);
          try { localStorage.setItem(k, JSON.stringify(j.observations)); } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, lastDate, entries]);

  // Render nothing until we have something to show — no empty placeholder.
  if (!observations && !loading) return null;

  return (
    <section
      className="card px-4 sm:px-5 py-4 lg:py-5 relative overflow-hidden"
    >
      {/* Soft indigo glow accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(99,102,241,0.12), transparent 60%)' }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-base shrink-0" aria-hidden>🐻</span>
          <span className="label" style={{ color: 'var(--color-accent)' }}>
            Sforăilă · ce a observat
          </span>
        </div>

        {/* Observations stack */}
        {loading && !observations && (
          <div className="text-xs text-[var(--color-fg-muted)] italic">
            ursul se gândește...
          </div>
        )}

        {observations && (
          <div className="space-y-2">
            {observations.map(o => (
              <div key={o.key} className="flex items-start gap-2.5">
                <span className="text-sm shrink-0 mt-0.5" aria-hidden>{o.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="label text-[var(--color-fg-muted)] text-[9px] mb-0.5">
                    {o.label}
                  </div>
                  <p className="text-sm text-[var(--color-fg)] leading-relaxed">
                    {o.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
