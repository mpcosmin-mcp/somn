'use client';
import { useMemo, useState } from 'react';
import { type SleepEntry, FIRST_NAME, personColor, ssColor, remColor, rhrColor, hrvColor } from '@/lib/sleep';
import { fmtDateShort, todayStr } from '@/lib/utils';
import { Avi } from '@/components/ui/avi';
import { EntryReactions } from '@/components/dashboard/entry-reactions';
import { useSocial } from '@/lib/social';

type Range = 'today' | 'recent';

/**
 * Team Feed — the social layer of somn.
 *
 * Default scope is TODAY only — keeps the conversation anchored to
 * last night's sleep, prevents like/comment volume from accumulating
 * forever on old entries, and the feed stays small and fast.
 *
 * If today is empty (early morning, nobody logged yet), the user can
 * flip the "Recente" tab to see the most recent few across the team.
 */
export function TeamFeed({ entries, currentUser, limit = 5 }: {
  entries: SleepEntry[];
  currentUser: string;
  limit?: number;
}) {
  const [range, setRange] = useState<Range>('today');
  const { syncError } = useSocial();

  const today = todayStr();

  const feed = useMemo(() => {
    const scoped = range === 'today'
      ? entries.filter(e => e.date === today)
      : entries;
    return scoped
      .slice()
      .sort((a, b) => {
        // Date desc, then by SS desc as tiebreak
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.ss - a.ss;
      })
      .slice(0, range === 'today' ? 10 : limit);
  }, [entries, range, today, limit]);

  const todayCount = useMemo(
    () => entries.filter(e => e.date === today).length,
    [entries, today],
  );

  return (
    <section className="card px-4 sm:px-5 py-4 lg:py-5">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <div>
          <div className="label flex items-center gap-2">
            <span>Feed echipă{range === 'today' ? ' · azi' : ''}</span>
            {syncError === 'kv-unavailable' && (
              <span
                className="num text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--color-warn)' }}
                title="Vercel KV nu e configurat — reacțiile rămân doar pe acest device. Vezi SOCIAL_SYNC.md."
              >
                offline
              </span>
            )}
          </div>
          <div className="text-[10px] num text-[var(--color-fg-dim)] mt-0.5">
            {range === 'today'
              ? `${todayCount}/3 din echipă au logat azi`
              : `ultimele ${feed.length} loguri din echipă`}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ScopeChip active={range === 'today'} onClick={() => setRange('today')} label="Azi" />
          <ScopeChip active={range === 'recent'} onClick={() => setRange('recent')} label="Recente" />
        </div>
      </div>

      {/* Feed */}
      {feed.length === 0 ? (
        <div className="text-xs text-[var(--color-fg-muted)] italic py-6 text-center">
          {range === 'today' ? (
            <>
              nimeni n-a logat încă azi. fii primul — scrie o notiță și{' '}
              <button onClick={() => setRange('recent')} className="text-[var(--color-accent)] font-bold hover:underline">
                vezi feed-ul recent
              </button>{' '}
              cât aștepți.
            </>
          ) : (
            'niciun log încă.'
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {feed.map(e => (
            <FeedItem
              key={`${e.date}_${e.name}`}
              entry={e}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Filter chip ─────────────────────────────────────────── */

function ScopeChip({ active, onClick, label }: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${
        active
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-fg)] ring-1 ring-[var(--color-accent)]/40'
          : 'border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Single feed card ────────────────────────────────────── */

function FeedItem({ entry, currentUser }: {
  entry: SleepEntry;
  currentUser: string;
}) {
  const c = personColor(entry.name);
  const isMe = entry.name === currentUser;
  const fn = FIRST_NAME[entry.name] ?? entry.name.split(' ')[0];

  return (
    <div
      className="rounded-xl border p-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${c}08, transparent 70%)`,
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left edge person color stripe */}
      <div className="absolute inset-y-0 left-0 w-0.5" style={{ background: c, opacity: 0.6 }} />

      <div className="flex items-start gap-2.5 pl-1">
        <Avi name={entry.name} size="sm" />
        <div className="flex-1 min-w-0">
          {/* Header line */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-bold text-sm" style={{ color: c }}>{fn}</span>
            {isMe && (
              <span className="text-[8px] uppercase tracking-wider text-[var(--color-accent)] font-bold">tu</span>
            )}
            <span className="text-[10px] num text-[var(--color-fg-muted)]">{fmtDateShort(entry.date)}</span>
            <span className="text-[var(--color-fg-dim)]">·</span>
            <Metric label="SS"  value={entry.ss}  color={ssColor(entry.ss)} />
            {entry.rem != null && <Metric label="REM" value={`${entry.rem}m`} color={remColor(entry.rem)} />}
            {entry.rhr > 0 && <Metric label="RHR" value={entry.rhr} color={rhrColor(entry.rhr)} />}
            {entry.hrv != null && <Metric label="HRV" value={entry.hrv} color={hrvColor(entry.hrv)} />}
          </div>

          {/* Journal body */}
          {entry.journal && entry.journal.trim().length > 0 ? (
            <p className="text-sm text-[var(--color-fg)] mt-1.5 leading-relaxed whitespace-pre-line break-words">
              {entry.journal.trim()}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-fg-dim)] italic mt-1.5">
              fără notiță în acest log
            </p>
          )}
        </div>
      </div>

      {/* Reactions footer */}
      <EntryReactions entry={entry} currentUser={currentUser} />
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <span className="num text-[10px] font-bold inline-flex items-baseline gap-0.5" style={{ color }}>
      <span className="text-[8px] opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}
