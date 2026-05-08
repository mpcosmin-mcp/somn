'use client';
import { type SleepEntry, ssColor, rhrColor, hrvColor, remColor, ssTier, FIRST_NAME, lastNDays } from '@/lib/sleep';
import { fmtDate, todayStr } from '@/lib/utils';
import { Sparkline } from '@/components/ui/sparkline';

export function Hero({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const mine = entries.filter(e => e.name === user).sort((a, b) => b.date.localeCompare(a.date));
  const last = mine[0] ?? null;
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  // 7-day SS series for the sparkline (one per day, null if missing)
  const last7 = lastNDays(entries.filter(e => e.name === user), 7);
  const dates = [...new Set(last7.map(e => e.date))].sort();
  const ssSeries = dates.map(d => last7.find(e => e.date === d)?.ss ?? null);

  if (!last) {
    return (
      <section className="relative dots rounded-3xl px-6 py-12 md:py-16 text-center">
        <div className="text-sm text-[var(--color-fg-muted)] uppercase tracking-[0.2em] mb-2">{fn}</div>
        <div className="text-2xl font-semibold">Niciun log încă.</div>
        <div className="text-[var(--color-fg-muted)] mt-2 text-sm">Apasă <span className="text-[var(--color-accent)] font-bold">log</span> sus dreapta ca să începi.</div>
      </section>
    );
  }

  const ssT = ssTier(last.ss);
  const isToday = last.date === todayStr();

  return (
    <section className="relative dots rounded-3xl px-5 md:px-8 py-8 md:py-10 overflow-hidden">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <div>
          <div className="label text-[var(--color-fg-muted)]">{isToday ? 'Aseară' : 'Ultima noapte'} · {fn}</div>
          <div className="text-xs text-[var(--color-fg-dim)] num mt-0.5">{fmtDate(last.date)}</div>
        </div>
        <div className="text-[10px] text-[var(--color-fg-muted)] num">
          sincronizat
        </div>
      </div>

      {/* SS is the headline */}
      <div className="flex items-end gap-6 mb-6 flex-wrap">
        <div>
          <div className="label mb-1">Sleep Score</div>
          <div className="flex items-baseline gap-2">
            <span
              className="num font-bold leading-none text-7xl md:text-8xl"
              style={{ color: ssColor(last.ss) }}
            >
              {last.ss}
            </span>
            <span className="text-lg text-[var(--color-fg-muted)] font-medium">/100</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: ssT.color }}>
            {ssT.label}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex justify-end pb-2">
          <Sparkline values={ssSeries} width={180} height={48} color={ssColor(last.ss)} showDots />
        </div>
      </div>

      {/* REM / RHR / HRV — secondary stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Stat label="REM" value={last.rem} unit="min" color={last.rem != null ? remColor(last.rem) : '#52525b'} />
        <Stat label="RHR" value={last.rhr} unit="bpm" color={rhrColor(last.rhr)} />
        <Stat label="HRV" value={last.hrv} unit="ms" color={hrvColor(last.hrv)} />
      </div>
    </section>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-3 py-3">
      <div className="label mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="num font-bold text-2xl leading-none" style={{ color: value == null ? '#52525b' : color }}>
          {value ?? '—'}
        </span>
        <span className="text-[10px] text-[var(--color-fg-muted)]">{unit}</span>
      </div>
    </div>
  );
}
