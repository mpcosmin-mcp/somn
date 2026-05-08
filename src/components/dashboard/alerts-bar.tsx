'use client';
import { useEffect, useMemo, useState } from 'react';
import { type SleepEntry } from '@/lib/sleep';
import { computeAlerts, loadDismissed, saveDismissed, type AlertKind } from '@/lib/alerts';

const KIND_STYLES: Record<AlertKind, { bg: string; border: string; fg: string }> = {
  warn: { bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.3)', fg: '#fca5a5' },
  good: { bg: 'rgba(163, 230, 53, 0.10)', border: 'rgba(163, 230, 53, 0.3)', fg: '#a3e635' },
  info: { bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.3)', fg: '#93c5fd' },
};

export function AlertsBar({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(loadDismissed(user));
  }, [user]);

  const alerts = useMemo(() => computeAlerts(entries, user), [entries, user]);
  const visible = alerts.filter(a => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(user, next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map(a => {
        const s = KIND_STYLES[a.kind];
        return (
          <div
            key={a.id}
            className="flex items-center gap-2.5 pl-3 pr-1 py-1.5 rounded-xl text-xs border"
            style={{ background: s.bg, borderColor: s.border, color: 'var(--color-fg)' }}
          >
            <span className="text-base shrink-0 leading-none">{a.emoji}</span>
            <span className="flex-1 leading-snug py-1">{a.text}</span>
            <button
              onClick={() => dismiss(a.id)}
              className="tap rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 transition-all text-[var(--color-fg-muted)] shrink-0"
              title="Dismiss"
              aria-label="Dismiss alert"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
