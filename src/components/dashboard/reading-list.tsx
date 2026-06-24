'use client';
import { useState } from 'react';
import { SLEEP_BOOKS, type SleepBook } from '@/lib/coach';

/**
 * Reading list — a vertical "shelf" of reputable sleep books, sized to live in
 * the right sidebar (or inline on narrow screens). Each row: cover + title +
 * author + one-line tagline, hover reveals the synopsis; click → Goodreads.
 * Covers are bundled locally (instant) with an on-brand placeholder fallback.
 */
function goodreads(title: string, author: string) {
  return `https://www.goodreads.com/search?q=${encodeURIComponent(`${title} ${author}`)}`;
}

function Cover({ book }: { book: SleepBook }) {
  const [failed, setFailed] = useState(false);
  const frame = 'w-10 h-[60px] shrink-0 rounded-md border border-[var(--color-border)] overflow-hidden';
  if (failed || !book.cover) {
    return (
      <div
        className={`${frame} grid place-items-center`}
        style={{ background: 'linear-gradient(150deg, color-mix(in srgb, var(--color-accent) 24%, var(--color-surface)), var(--color-surface))', color: 'var(--color-accent)' }}
        aria-hidden
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
    );
  }
  return (
    <img src={book.cover} alt={`Coperta „${book.title}”`} loading="lazy" onError={() => setFailed(true)}
      className={`${frame} object-cover bg-[var(--color-surface)]`} />
  );
}

export function ReadingList() {
  return (
    <section className="card px-4 py-4 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)', color: 'var(--color-accent)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>
        <div className="flex flex-col">
          <span className="label">Lecturi despre somn</span>
          <span className="text-[11px] text-[var(--color-fg-dim)] leading-tight">{SLEEP_BOOKS.length} cărți alese</span>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-[var(--color-border)]/60">
        {SLEEP_BOOKS.map(b => (
          <a
            key={b.title}
            href={goodreads(b.title, b.author)}
            target="_blank"
            rel="noopener noreferrer"
            title={b.hook}
            className="group flex gap-3 py-2.5 -mx-1 px-1 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <Cover book={b} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--color-fg)] leading-tight line-clamp-2 group-hover:text-[var(--color-accent)] transition-colors">{b.title}</div>
              <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">{b.author}</div>
              <div className="text-[10px] text-[var(--color-fg-dim)] leading-snug mt-1 line-clamp-2">{b.why}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
