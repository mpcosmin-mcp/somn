'use client';
import { useState } from 'react';
import { SLEEP_BOOKS, type SleepBook } from '@/lib/coach';

/**
 * Reading list — a Netflix-style poster shelf of reputable sleep books.
 * Horizontal snap-scroll of covers; title + author sit under each poster, and
 * on hover the cover flips to a synopsis card with a Goodreads CTA. Covers are
 * bundled locally (instant); a missing one degrades to an on-brand placeholder.
 */
function goodreads(title: string, author: string) {
  return `https://www.goodreads.com/search?q=${encodeURIComponent(`${title} ${author}`)}`;
}

function Cover({ book }: { book: SleepBook }) {
  const [failed, setFailed] = useState(false);
  if (failed || !book.cover) {
    return (
      <div
        className="absolute inset-0 grid place-items-center"
        style={{
          background: 'linear-gradient(150deg, color-mix(in srgb, var(--color-accent) 26%, var(--color-surface)), var(--color-surface))',
          color: 'var(--color-accent)',
        }}
        aria-hidden
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={book.cover}
      alt={`Coperta „${book.title}”`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export function ReadingList() {
  return (
    <section className="card px-5 py-4 lg:py-5 flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)', color: 'var(--color-accent)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </span>
        <div className="flex flex-col">
          <span className="label">Lecturi despre somn</span>
          <span className="text-[11px] text-[var(--color-fg-dim)] leading-tight">{SLEEP_BOOKS.length} cărți alese · trage pentru mai multe →</span>
        </div>
      </div>

      {/* Poster shelf — horizontal snap-scroll */}
      <div className="flex gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
        {SLEEP_BOOKS.map(b => (
          <a
            key={b.title}
            href={goodreads(b.title, b.author)}
            target="_blank"
            rel="noopener noreferrer"
            className="group shrink-0 w-[150px] sm:w-[158px] snap-start rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg shadow-black/30 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/50">
              <Cover book={b} />

              {/* Hover synopsis — the "Netflix flip" */}
              <div className="absolute inset-0 p-3 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[var(--color-bg)]/92 backdrop-blur-sm">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>{b.why}</div>
                <div className="text-xs font-bold text-[var(--color-fg)] leading-tight mt-1">{b.title}</div>
                <div className="text-[10px] text-[var(--color-fg-muted)] leading-snug mt-1.5 flex-1 overflow-hidden">{b.hook}</div>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap" style={{ color: 'var(--color-accent)' }}>
                  Caută pe Goodreads
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M7 7h10v10" /><path d="M7 17 17 7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Title + author under the poster (always visible — mobile-friendly) */}
            <div className="mt-2 px-0.5">
              <div className="text-xs font-semibold text-[var(--color-fg)] leading-tight line-clamp-2 group-hover:text-[var(--color-accent)] transition-colors">{b.title}</div>
              <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">{b.author}</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
