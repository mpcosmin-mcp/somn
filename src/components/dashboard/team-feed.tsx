'use client';
import { useMemo, useState } from 'react';
import { type SleepEntry, FIRST_NAME, personColor, ssColor, remColor, rhrColor, hrvColor } from '@/lib/sleep';
import { fmtDateShort } from '@/lib/utils';
import { Avi } from '@/components/ui/avi';
import { EntryReactions } from '@/components/dashboard/entry-reactions';

/**
 * Team Feed — the social layer of somn.
 *
 * Surfaces journal entries from across the team so people can discover
 * common patterns and react to each other's nights. Recent entries
 * with journals first; an option to also show recent entries WITHOUT
 * journals so the feed is never empty on quiet weeks.
 *
 * Each card: avatar + name (colored) + date + headline stats →
 * journal body → reactions footer (likes + comment thread).
 */
export function TeamFeed({ entries, currentUser, limit = 5 }: {
  entries: SleepEntry[];
  currentUser: string;
  limit?: number;
}) {
  const [scope, setScope] = useState<'journals' | 'all'>('journals');

  const feed = useMemo(() => {
    const filtered = scope === 'journals'
      ? entries.filter(e => !!(e.journal && e.journal.trim().length > 0))
      : entries;
    return filtered
      .slice()
      .sort((a, b) => {
        // Date desc, then by SS desc as tiebreak
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.ss - a.ss;
      })
      .slice(0, limit);
  }, [entries, scope, limit]);

  const journalCount = useMemo(
    () => entries.filter(e => !!(e.journal && e.journal.trim().length > 0)).length,
    [entries],
  );

  return (
    <section className="card px-4 sm:px-5 py-4 lg:py-5">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <div>
          <div className="label">Feed echipă · jurnalele oamenilor</div>
          <div className="text-[10px] num text-[var(--color-fg-dim)] mt-0.5">
            {journalCount} loguri cu notițe în total
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ScopeChip active={scope === 'journals'} onClick={() => setScope('journals')} label="Cu jurnal" />
          <ScopeChip active={scope === 'all'} onClick={() => setScope('all')} label="Toate" />
        </div>
      </div>

      {/* Feed */}
      {feed.length === 0 ? (
        <div className="text-xs text-[var(--color-fg-muted)] italic py-6 text-center">
          {scope === 'journals'
            ? 'niciun jurnal încă. scrie o notiță când loghezi azi ca să pornești conversația.'
            : 'niciun log încă.'}
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
