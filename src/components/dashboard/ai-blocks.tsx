'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { fetchWeeklyStory, fetchPatterns, type Patterns } from '@/lib/client-api';
import { weekKey } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const ROAST_KEY = (user: string, date: string) => `somn_roast_${user}_${date}`;
const STORY_KEY = (week: string) => `somn_story_${week}`;
const PATTERNS_KEY = (user: string, week: string) => `somn_patterns_${user}_${week}`;

/* AI Daily — adaptive comment per user, cached per (user, last_log_date).
   Title rotates: "🔥 daily roast" / "🎉 daily celebration" / "👀 daily check"
   based on the AI's mode response. */
export function DailyRoast({ user, entries }: { user: string; entries: SleepEntry[] }) {
  const [text, setText] = useState<string | null>(null);
  const [mode, setMode] = useState<'celebrate' | 'observe' | 'roast' | null>(null);
  const [loading, setLoading] = useState(false);

  const mine = entries.filter(e => e.name === user).sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = mine[0]?.date;
  const lastJournalLen = mine[0]?.journal?.length ?? 0;
  // Cache key includes journal length so a newly-added journal busts the cache
  const cacheKey = lastDate ? `${ROAST_KEY(user, lastDate)}_j${lastJournalLen}` : '';

  useEffect(() => {
    if (!lastDate || !cacheKey) { setText(null); setMode(null); return; }
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { text: string; mode: typeof mode };
        setText(parsed.text);
        setMode(parsed.mode);
        return;
      }
    } catch { /* ignore */ }
    setLoading(true);
    fetch('/api/roast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user, entries: entries.slice(-7) }),
    })
      .then(r => r.json())
      .then((j: { text?: string; mode?: typeof mode }) => {
        if (j.text) {
          setText(j.text);
          setMode(j.mode ?? null);
          try { localStorage.setItem(cacheKey, JSON.stringify({ text: j.text, mode: j.mode })); } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, lastDate, cacheKey, entries]);

  if (!lastDate) return null;

  const modeMeta = mode === 'celebrate'
    ? { icon: '🎉', label: 'daily celebration', accent: '#a3e635' }
    : mode === 'observe'
    ? { icon: '👀', label: 'daily check', accent: '#60a5fa' }
    : mode === 'roast'
    ? { icon: '🔥', label: 'daily roast', accent: '#f87171' }
    : { icon: '~$', label: 'daily', accent: 'var(--color-accent)' };

  return (
    <Card className="px-5 py-4 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${modeMeta.accent}, transparent)`, opacity: 0.5 }}
      />
      <div className="flex items-start gap-3">
        <div className="text-xl mt-0.5 shrink-0">{modeMeta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="label mb-1" style={{ color: modeMeta.accent }}>claude · {modeMeta.label}</div>
          {loading && <div className="text-sm text-[var(--color-fg-muted)] italic">se generează...</div>}
          {!loading && text && <p className="text-sm leading-relaxed">{text}</p>}
          {!loading && !text && (
            <p className="text-sm text-[var(--color-fg-dim)] italic">
              AI offline — adaugă <span className="num text-[var(--color-fg-muted)]">ANTHROPIC_API_KEY</span> ca să primești roast-ul zilnic.
            </p>
          )}
          {!loading && text && lastJournalLen === 0 && (
            <div className="text-[10px] text-[var(--color-fg-dim)] mt-2">
              💡 scrie o notiță când loghezi → AI-ul dă răspunsuri mai ascuțite
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Weekly Story — team-wide narrative, cached per ISO week */
export function WeeklyStory({ entries, defaultOpen = false }: { entries: SleepEntry[]; defaultOpen?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
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

/* AI Pattern Finder — weekly per-user + team patterns. Cached per ISO week per user. */
export function PatternCard({
  user,
  entries,
  defaultOpen = false,
}: {
  user: string;
  entries: SleepEntry[];
  defaultOpen?: boolean;
}) {
  const [data, setData] = useState<Patterns | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const wk = weekKey();
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

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

  return (
    <Card className="px-5 py-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <div className="flex-1 min-w-0">
          <div className="label">📊 pattern finder · săptămâna {wk}</div>
          <div className="text-sm font-semibold mt-0.5">
            {loading ? 'caută pattern-uri...' : data ? `pattern-uri pentru ${fn} + echipă` : 'AI offline sau date insuficiente'}
          </div>
        </div>
        <span className="text-[var(--color-fg-muted)] text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && data && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
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
      {open && !data && !loading && (
        <p className="text-xs text-[var(--color-fg-dim)] italic mt-3 pt-3 border-t border-[var(--color-border)]">
          {entries.length < 5 ? 'minim 5 loguri necesare pentru pattern-uri.' : 'AI nu a returnat nimic. Verifică ANTHROPIC_API_KEY.'}
        </p>
      )}
    </Card>
  );
}
