'use client';
import { SLEEP_BOOKS } from '@/lib/coach';

/**
 * Reading list — a small curated shelf of reputable sleep books.
 * Static content, zero runtime cost. Each row links to a Goodreads
 * search for the title+author, so the link can never 404.
 */
function goodreads(title: string, author: string) {
  return `https://www.goodreads.com/search?q=${encodeURIComponent(`${title} ${author}`)}`;
}

export function ReadingList() {
  return (
    <section className="card px-5 py-4 lg:py-5 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3.5">
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
          <span className="text-[11px] text-[var(--color-fg-dim)] leading-tight">{SLEEP_BOOKS.length} cărți alese · mergi mai deep</span>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]/60">
        {SLEEP_BOOKS.map(b => (
          <a
            key={b.title}
            href={goodreads(b.title, b.author)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--color-fg)] leading-snug">{b.title}</span>
                <span className="text-[11px] text-[var(--color-fg-muted)]">{b.author}</span>
              </div>
              <div className="text-xs text-[var(--color-fg-muted)] leading-snug mt-0.5">{b.why}</div>
            </div>
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden
              className="shrink-0 mt-1 text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all"
            >
              <path d="M7 7h10v10" /><path d="M7 17 17 7" />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}
