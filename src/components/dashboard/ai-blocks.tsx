'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { fetchDailyRoast, fetchWeeklyStory } from '@/lib/client-api';
import { weekKey } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const ROAST_KEY = (user: string, date: string) => `somn_roast_${user}_${date}`;
const STORY_KEY = (week: string) => `somn_story_${week}`;

/* AI Daily Roast — 1-2 line cheeky comment per user, cached per day */
export function DailyRoast({ user, entries }: { user: string; entries: SleepEntry[] }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mine = entries.filter(e => e.name === user).sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = mine[0]?.date;

  useEffect(() => {
    if (!lastDate) { setText(null); return; }
    const cacheKey = ROAST_KEY(user, lastDate);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setText(cached); return; }
    } catch { /* ignore */ }
    setLoading(true);
    fetchDailyRoast(user, entries)
      .then(t => {
        if (t) {
          setText(t);
          try { localStorage.setItem(cacheKey, t); } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, [user, lastDate, entries]);

  if (!lastDate) return null;

  return (
    <Card className="px-5 py-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-50" />
      <div className="flex items-start gap-3">
        <div className="num text-xl font-bold text-[var(--color-accent)] mt-0.5">~$</div>
        <div className="flex-1">
          <div className="label mb-1">claude · daily roast</div>
          {loading && (
            <div className="text-sm text-[var(--color-fg-muted)] italic">se generează...</div>
          )}
          {!loading && text && (
            <p className="text-sm leading-relaxed">{text}</p>
          )}
          {!loading && !text && (
            <p className="text-sm text-[var(--color-fg-dim)] italic">
              AI offline — adaugă <span className="num text-[var(--color-fg-muted)]">ANTHROPIC_API_KEY</span> în Vercel ca să primești roast-ul zilnic.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Weekly Story — team-wide narrative, cached per ISO week */
export function WeeklyStory({ entries }: { entries: SleepEntry[] }) {
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wk = weekKey();

  useEffect(() => {
    const cacheKey = STORY_KEY(wk);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setText(cached); return; }
    } catch { /* ignore */ }
    setLoading(true);
    fetchWeeklyStory(entries)
      .then(t => {
        if (t) {
          setText(t);
          try { localStorage.setItem(cacheKey, t); } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, [wk, entries]);

  return (
    <Card className="px-5 py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <div className="label">povestea săptămânii · {wk}</div>
          <div className="text-sm font-semibold mt-0.5">
            {loading ? 'se generează...' : text ? 'apasă să citești' : 'AI offline'}
          </div>
        </div>
        <span className="text-[var(--color-fg-muted)] text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && text && (
        <p className="text-sm leading-relaxed mt-3 pt-3 border-t border-[var(--color-border)]">
          {text}
        </p>
      )}
      {open && !text && !loading && (
        <p className="text-xs text-[var(--color-fg-dim)] italic mt-3 pt-3 border-t border-[var(--color-border)]">
          AI nu e configurat. Adaugă <span className="num">ANTHROPIC_API_KEY</span> în env vars.
        </p>
      )}
    </Card>
  );
}
