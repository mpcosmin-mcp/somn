'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, ChevronRight } from 'lucide-react';
import type { Idea } from '@/app/api/ideas/route';

const STATUS_ICON: Record<string, string> = { new: '📝', wip: '🔨', done: '✅', rejected: '❌' };

/**
 * Ideas access in the TopBar — a button (with a new-count badge) that opens a
 * popover of the top ideas. Ideas live here now, not in the left rail (which is
 * operations-only).
 */
export function IdeasMenu() {
  const [open, setOpen] = useState(false);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/ideas', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { ideas: [] }))
      .then((j: { ideas?: Idea[] }) => { if (alive) setIdeas(j.ideas ?? []); })
      .catch(() => { if (alive) setIdeas([]); });
    load();
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const list = ideas ?? [];
  const newCount = list.filter(i => i.status === 'new').length;
  const top = list.slice().sort((a, b) => (b.up.length - b.down.length) - (a.up.length - a.down.length)).slice(0, 5);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Idei"
        aria-expanded={open}
        className={`relative flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
          open ? 'text-[var(--color-accent)] bg-[var(--color-surface)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]'
        }`}
        title="Idei de îmbunătățire"
      >
        <Lightbulb size={17} />
        <span className="text-[11px] font-bold hidden sm:inline">Idei</span>
        {newCount > 0 && (
          <span
            className="num text-[8px] font-bold rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center leading-none absolute -top-0.5 -right-0.5"
            style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
          >
            {newCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl shadow-black/40 overflow-hidden z-50 fade-in-up"
          role="dialog"
          aria-label="Idei"
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--color-border)]">
            <span className="label">💡 Idei</span>
            <Link href="/ideas" onClick={() => setOpen(false)} className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
              toate <ChevronRight size={11} />
            </Link>
          </div>

          <div className="p-2">
            {ideas === null ? (
              <div className="text-[11px] text-[var(--color-fg-dim)] px-2 py-4 text-center">se încarcă...</div>
            ) : top.length === 0 ? (
              <Link href="/ideas" onClick={() => setOpen(false)} className="block text-[11px] text-[var(--color-fg-dim)] px-2 py-4 text-center hover:text-[var(--color-fg)] transition-colors">
                Nicio idee încă. Scrie prima →
              </Link>
            ) : (
              <div className="space-y-1">
                {top.map(idea => {
                  const score = idea.up.length - idea.down.length;
                  return (
                    <Link
                      key={idea.id}
                      href="/ideas"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <span className="num text-xs font-bold w-6 text-center shrink-0" style={{ color: score > 0 ? 'var(--color-good)' : 'var(--color-fg-dim)' }}>
                        {score > 0 ? `+${score}` : score}
                      </span>
                      <span className="text-[11px] text-[var(--color-fg)] truncate flex-1 min-w-0">{idea.title}</span>
                      <span className="text-[11px] shrink-0" title={idea.status}>{STATUS_ICON[idea.status] ?? ''}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-3 pb-3">
            <Link
              href="/ideas"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] font-bold text-[var(--color-accent)] rounded-lg border border-[var(--color-accent)]/30 py-2 hover:bg-[var(--color-accent)]/10 transition-colors"
            >
              + adaugă o idee
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
