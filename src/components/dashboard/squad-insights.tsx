'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry, NAMES, lastNDays } from '@/lib/sleep';

const VIBE_KEY = (user: string, lastDate: string) => `somn_vibe_${user}_${lastDate}`;

/**
 * Squad Insights — combined panel.
 *
 *   Top:    computed factual stat ("Echipa a dormit în medie 7h 12m...
 *           Ești pe locul #2 la Consistență")
 *   Bottom: AI-generated comment from Hipnos (cached daily)
 *
 * One compact card. Minimal chrome. Inspired by PDF page 4 bottom.
 */
export function SquadInsights({ entries, user }: { entries: SleepEntry[]; user: string }) {
  // ─── Computed insight ──────────────────────────────────
  const last7 = lastNDays(entries, 7);
  const teamSS = last7.length
    ? Math.round(last7.reduce((s, e) => s + e.ss, 0) / last7.length)
    : null;

  // Consistency ranking — # of distinct logged days in last 7 per user
  const consistency = NAMES.map(n => ({
    name: n,
    days: new Set(last7.filter(e => e.name === n).map(e => e.date)).size,
  })).sort((a, b) => b.days - a.days);
  const myRank = consistency.findIndex(r => r.name === user) + 1;
  const myDays = consistency.find(r => r.name === user)?.days ?? 0;

  // ─── AI vibe (cached per user+lastDate) ────────────────
  const [aiText, setAiText] = useState<string | null>(null);
  const lastDate = [...new Set(entries.map(e => e.date))].sort().slice(-1)[0] ?? '';

  useEffect(() => {
    if (!user || !lastDate) { setAiText(null); return; }
    const k = VIBE_KEY(user, lastDate);
    try {
      const cached = localStorage.getItem(k);
      if (cached) { setAiText(cached); return; }
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
          setAiText(j.text);
          try { localStorage.setItem(k, j.text); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, [user, lastDate, entries]);

  return (
    <section
      className="card px-5 py-4 lg:py-5 relative overflow-hidden"
    >
      {/* Soft indigo glow accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: 'radial-gradient(circle at 0% 0%, rgba(99,102,241,0.10), transparent 55%)' }}
      />

      <div className="relative space-y-3">
        {/* Factual stat */}
        <div className="flex items-start gap-3">
          <span className="text-base" aria-hidden>👥</span>
          <div className="flex-1 min-w-0">
            <div className="label">Squad Insights</div>
            <p className="text-sm text-[var(--color-fg)] mt-1 leading-relaxed">
              {teamSS != null ? (
                <>
                  Echipa a dormit cu un SS mediu de <strong className="num text-[var(--color-accent)]">{teamSS}</strong> săptămâna asta.{' '}
                  {myRank > 0 && (
                    <>
                      Ești pe locul <strong className="num text-[var(--color-accent)]">#{myRank}</strong> la consistență ({myDays}/7 zile).
                    </>
                  )}
                </>
              ) : (
                <span className="text-[var(--color-fg-muted)]">Nu sunt loguri în ultimele 7 zile.</span>
              )}
            </p>
          </div>
        </div>

        {/* AI comment from Hipnos */}
        {aiText && (
          <div className="flex items-start gap-3 pt-3 border-t border-[var(--color-border)]/70">
            <span className="text-base" aria-hidden>🦞</span>
            <div className="flex-1 min-w-0">
              <div className="label" style={{ color: 'var(--color-accent)' }}>Hipnos</div>
              <p className="text-sm text-[var(--color-fg)] mt-1 leading-relaxed">{aiText}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

