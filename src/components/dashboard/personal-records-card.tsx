'use client';
import { type SleepEntry, ssColor, remColor, rhrColor, hrvColor, FIRST_NAME } from '@/lib/sleep';
import { personalRecords } from '@/lib/insights';
import { fmtDateShort } from '@/lib/utils';

/**
 * Personal Records — best-ever stats per user, with the date each PR was set.
 * Six tiles: bestSS / bestREM / lowestRHR / bestHRV / longestStreak / totalLogs.
 */
export function PersonalRecordsCard({ entries, user }: { entries: SleepEntry[]; user: string }) {
  const pr = personalRecords(entries, user);
  if (!pr.totalLogs) return null;
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  return (
    <section className="card px-5 py-4 lg:py-5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="label">Personal Records · {fn}</span>
        <span className="text-[10px] num text-[var(--color-fg-dim)]">best ever</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <PR label="Sleep Score" value={pr.bestSS?.value ?? null} unit="/100"
            date={pr.bestSS?.date} color={pr.bestSS ? ssColor(pr.bestSS.value) : '#52525b'} />
        <PR label="REM" value={pr.bestREM?.value ?? null} unit="min"
            date={pr.bestREM?.date} color={pr.bestREM ? remColor(pr.bestREM.value) : '#52525b'} />
        <PR label="RHR (cel mai mic)" value={pr.lowestRHR?.value ?? null} unit="bpm"
            date={pr.lowestRHR?.date} color={pr.lowestRHR ? rhrColor(pr.lowestRHR.value) : '#52525b'} />
        <PR label="HRV" value={pr.bestHRV?.value ?? null} unit="ms"
            date={pr.bestHRV?.date} color={pr.bestHRV ? hrvColor(pr.bestHRV.value) : '#52525b'} />
        <PR label="Cel mai lung streak" value={pr.longestStreak || null} unit="zile"
            color={pr.longestStreak >= 7 ? '#f97316' : '#94a3b8'} />
        <PR label="Total loguri" value={pr.totalLogs} unit="nopți" color="#94a3b8" />
      </div>
    </section>
  );
}

function PR({
  label, value, unit, date, color,
}: {
  label: string;
  value: number | null;
  unit: string;
  date?: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2.5">
      <div className="label mb-0.5 truncate">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="num font-bold text-xl leading-none" style={{ color: value == null ? '#52525b' : color }}>
          {value ?? '—'}
        </span>
        <span className="text-[10px] text-[var(--color-fg-muted)]">{unit}</span>
      </div>
      {date && (
        <div className="text-[9px] num text-[var(--color-fg-dim)] mt-1 lowercase">{fmtDateShort(date)}</div>
      )}
    </div>
  );
}
