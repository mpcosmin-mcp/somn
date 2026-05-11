'use client';
import { type SleepEntry, ssColor, hrvColor, ssTier, personalTrendNote } from '@/lib/sleep';

/**
 * Personal History — compact tabular view of the last few logs.
 *
 * Columns: DATA · SCOR · REM · HRV · STATUS pill (Optim/Average/Poor).
 * Footer: 🦞 Hipnos pattern note — computed locally from the data
 *         (no AI call), so the user always sees what's trending.
 */
export function PersonalHistory({ entries, user, limit = 6 }: {
  entries: SleepEntry[];
  user: string;
  limit?: number;
}) {
  const mine = entries
    .filter(e => e.name === user)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  const dayShort = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
  const monthShort = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${monthShort[d.getMonth()]}, ${dayShort[d.getDay()]}`;
  };

  const trend = personalTrendNote(entries, user);

  if (!mine.length) {
    return (
      <section className="card px-5 py-4 lg:py-5 flex flex-col">
        <div className="label mb-3">Istoric Personal</div>
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-fg-muted)] italic py-6">
          niciun log încă
        </div>
      </section>
    );
  }

  return (
    <section className="card px-5 py-4 lg:py-5 flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">Istoric Personal</span>
        <span className="text-[10px] num text-[var(--color-fg-dim)]">ultimele {mine.length} loguri</span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 lg:gap-4 items-center pb-2 border-b border-[var(--color-border)]">
        <span className="label">Data</span>
        <span className="label text-right">Scor</span>
        <span className="label text-right hidden sm:inline">REM</span>
        <span className="label text-right hidden sm:inline">HRV</span>
        <span className="label text-right">Status</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[var(--color-border)]/60">
        {mine.map(e => {
          const t = ssTier(e.ss);
          const pill = e.ss >= 75 ? 'optim' : e.ss >= 60 ? 'average' : 'poor';
          const pillLabel = e.ss >= 75 ? 'Optim' : e.ss >= 60 ? 'Average' : 'Poor';
          return (
            <div key={e.date} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 lg:gap-4 items-center py-2.5">
              <span className="text-xs text-[var(--color-fg)]">{fmt(e.date)}</span>
              <span className="num font-bold text-base text-right" style={{ color: ssColor(e.ss) }}>
                {e.ss}
              </span>
              <span className="num text-xs text-[var(--color-fg-muted)] text-right hidden sm:inline">
                {e.rem != null ? `${e.rem}m` : '—'}
              </span>
              <span className="num text-xs text-right hidden sm:inline" style={{ color: e.hrv != null ? hrvColor(e.hrv) : 'var(--color-fg-dim)' }}>
                {e.hrv != null ? `${e.hrv}` : '—'}
              </span>
              <span className={`pill ${pill}`} title={t.label}>{pillLabel}</span>
            </div>
          );
        })}
      </div>

      {/* 🦞 Hipnos pattern note — present at the bottom, always */}
      {trend && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]/70 flex items-start gap-2.5">
          <span className="text-base shrink-0 leading-tight" aria-hidden>🦞</span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-[var(--color-accent)] mb-0.5">
              Hipnos · pattern
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{
                color:
                  trend.tone === 'good' ? 'var(--color-good)'
                  : trend.tone === 'warn' ? 'var(--color-warn)'
                  : 'var(--color-fg-muted)',
              }}
            >
              {trend.text}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
