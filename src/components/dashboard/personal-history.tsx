'use client';
import { type SleepEntry, ssColor, hrvColor, rhrColor, ssTier, personColor } from '@/lib/sleep';
import { Sparkline } from '@/components/ui/sparkline';

/**
 * Personal History — compact tabular view of the last few logs.
 *
 * Columns: DATA · TREND (sparkline) · RHR · SCOR · REM · HRV · STATUS pill.
 * The sparkline per row shows the 7 days of SS ending on that row's date,
 * so the rightmost dot IS that row's score — instant trend-in-context.
 * Footer: pattern note computed locally from the data — no AI call.
 */
export function PersonalHistory({ entries, user, limit = 6 }: {
  entries: SleepEntry[];
  user: string;
  limit?: number;
}) {
  const sortedDesc = entries
    .filter(e => e.name === user)
    .sort((a, b) => b.date.localeCompare(a.date));
  const mine = sortedDesc.slice(0, limit);

  const dayShort = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
  const monthShort = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return `${String(d.getDate()).padStart(2, '0')} ${monthShort[d.getMonth()]}, ${dayShort[d.getDay()]}`;
  };

  const sparkColor = personColor(user);

  // Lookup of date → SS for fast per-row sparkline assembly.
  const ssByDate = new Map<string, number>();
  for (const e of sortedDesc) ssByDate.set(e.date, e.ss);

  /** Build SS values + dates for the 7 calendar days ending on `endIso` (inclusive). */
  const sparkSeriesFor = (endIso: string) => {
    const end = new Date(endIso + 'T12:00:00');
    const values: (number | null)[] = [];
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push(iso);
      values.push(ssByDate.has(iso) ? ssByDate.get(iso)! : null);
    }
    return { values, dates };
  };

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
      <div className="grid grid-cols-[auto_auto_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 lg:gap-4 items-center pb-2 border-b border-[var(--color-border)]">
        <span className="label">Data</span>
        <span className="label hidden sm:inline">Trend</span>
        <span className="label text-right hidden sm:inline">RHR</span>
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
          const { values, dates } = sparkSeriesFor(e.date);
          return (
            <div key={e.date} className="grid grid-cols-[auto_auto_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-3 lg:gap-4 items-center py-2.5">
              <span className="text-xs text-[var(--color-fg)]">{fmt(e.date)}</span>
              <div className="hidden sm:flex items-center min-w-0">
                <Sparkline values={values} dates={dates} unit="" width={96} height={22} color={sparkColor} />
              </div>
              <span
                className="num text-xs text-right hidden sm:inline"
                style={{ color: rhrColor(e.rhr) }}
              >
                {e.rhr}
              </span>
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

    </section>
  );
}
