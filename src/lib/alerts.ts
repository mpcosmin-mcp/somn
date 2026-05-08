import { type SleepEntry, lastNDays } from '@/lib/sleep';
import { streakFor } from '@/lib/gamify';

/* ─────────────────────────────────────────────────────────
   Pattern alerts — deterministic, fast, no AI.
   Run on every dashboard mount; cheap to compute.
   Each alert has a stable id so dismiss state persists per user.
   ───────────────────────────────────────────────────────── */

export type AlertKind = 'warn' | 'good' | 'info';

export interface Alert {
  id: string;          // stable per (kind, week) — survives refresh, resets weekly
  kind: AlertKind;
  emoji: string;
  text: string;
}

/** Compute a weekly id token so dismissed alerts revive next week */
function weekToken(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // floor to monday for stable weekly id
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

interface SortedEntry extends SleepEntry {
  _ts: number;
}

function sortByDate(entries: SleepEntry[]): SortedEntry[] {
  return entries
    .map(e => ({ ...e, _ts: new Date(e.date + 'T12:00:00').getTime() }))
    .sort((a, b) => a._ts - b._ts);
}

/** Run all alert checks for a user. Returns sorted by priority: warn > good > info. */
export function computeAlerts(allEntries: SleepEntry[], user: string): Alert[] {
  const wk = weekToken();
  const mine = sortByDate(allEntries.filter(e => e.name === user));
  if (mine.length < 3) return [];

  const last30 = lastNDays(mine, 30);
  const last7 = lastNDays(mine, 7);
  const lastEntry = mine[mine.length - 1];
  const recent3 = mine.slice(-3);
  const recent5 = mine.slice(-5);

  const out: Alert[] = [];

  // ── Warnings ──────────────────────────────────────────

  // HRV declining 3+ days in a row
  if (recent3.length === 3 && recent3.every(e => e.hrv != null)) {
    const [a, b, c] = recent3;
    if ((b.hrv as number) < (a.hrv as number) && (c.hrv as number) < (b.hrv as number)) {
      out.push({
        id: `${wk}_hrv_decline`,
        kind: 'warn',
        emoji: '🔻',
        text: `HRV scade 3 zile la rând (${a.hrv}→${b.hrv}→${c.hrv}). Stres cumulat?`,
      });
    }
  }

  // RHR rising 3+ days
  if (recent3.length === 3) {
    const [a, b, c] = recent3;
    if (b.rhr > a.rhr && c.rhr > b.rhr) {
      out.push({
        id: `${wk}_rhr_rise`,
        kind: 'warn',
        emoji: '💔',
        text: `RHR urcă 3 zile la rând (${a.rhr}→${b.rhr}→${c.rhr}). Recuperare incompletă.`,
      });
    }
  }

  // REM below personal 30d avg for 3 consecutive nights
  const remVals = last30.map(e => e.rem).filter((v): v is number => v != null);
  if (remVals.length >= 5) {
    const remAvg = remVals.reduce((s, v) => s + v, 0) / remVals.length;
    const recent3Rem = recent3.filter(e => e.rem != null).map(e => e.rem as number);
    if (recent3Rem.length === 3 && recent3Rem.every(v => v < remAvg * 0.85)) {
      out.push({
        id: `${wk}_rem_dip`,
        kind: 'warn',
        emoji: '🌙',
        text: `REM sub media ta (~${Math.round(remAvg)}min) 3 nopți la rând. Verifică alcool/cofeină/sport.`,
      });
    }
  }

  // 2 bad nights in a row (SS < 65)
  const recent2 = mine.slice(-2);
  if (recent2.length === 2 && recent2.every(e => e.ss < 65)) {
    out.push({
      id: `${wk}_ss_slump`,
      kind: 'warn',
      emoji: '😴',
      text: `2 nopți slabe consecutiv (SS ${recent2[0].ss}, ${recent2[1].ss}). Time to reset.`,
    });
  }

  // ── Positive alerts ────────────────────────────────────

  // Personal REM record (today's REM is highest in last 30 days)
  if (lastEntry.rem != null && remVals.length >= 5) {
    const rest = remVals.slice(0, -1);
    if (rest.length && lastEntry.rem >= Math.max(...rest)) {
      out.push({
        id: `${wk}_rem_pr_${lastEntry.date}`,
        kind: 'good',
        emoji: '🏆',
        text: `REM personal record! ${lastEntry.rem}min — peste tot ce ai logat în 30 zile.`,
      });
    }
  }

  // Best-week alert: average of last 7 is the highest 7-day avg in 30 days
  if (last7.length >= 4 && last30.length >= 14) {
    const avg7 = last7.reduce((s, e) => s + e.ss, 0) / last7.length;
    // Compare to the average of the 7 days before that
    const prior = last30.filter(e => !last7.find(x => x.date === e.date)).slice(-7);
    if (prior.length >= 4) {
      const avgPrior = prior.reduce((s, e) => s + e.ss, 0) / prior.length;
      if (avg7 - avgPrior >= 8) {
        out.push({
          id: `${wk}_best_week`,
          kind: 'good',
          emoji: '🌟',
          text: `Săptămâna asta e cu ${Math.round(avg7 - avgPrior)} puncte SS peste cea trecută. Continuă!`,
        });
      }
    }
  }

  // Streak milestone celebration (7, 14, 30, 60, 100, etc.)
  const streak = streakFor(allEntries, user);
  const milestones = [7, 14, 30, 60, 100, 365];
  for (const m of milestones) {
    if (streak === m) {
      out.push({
        id: `${wk}_streak_${m}`,
        kind: 'good',
        emoji: '🔥',
        text: `${m} zile consecutive logate! Disciplină de prog.`,
      });
      break;
    }
  }

  // Excellent night highlight (SS ≥ 90 last night)
  if (lastEntry.ss >= 90) {
    out.push({
      id: `${wk}_excellent_${lastEntry.date}`,
      kind: 'good',
      emoji: '💎',
      text: `Aseară SS ${lastEntry.ss} — rar ce frumos. Ce-ai făcut diferit?`,
    });
  }

  // ── Info alerts ────────────────────────────────────────

  // Streak about-to-break warning (most recent log is yesterday, not today)
  if (streak >= 3) {
    const today = new Date(); today.setHours(0,0,0,0);
    const lastLog = new Date(mine[mine.length-1].date + 'T12:00:00');
    const daysAgo = Math.round((today.getTime() - lastLog.getTime()) / 86400000);
    if (daysAgo >= 1) {
      out.push({
        id: `${wk}_streak_warning_${streak}`,
        kind: 'info',
        emoji: '⏰',
        text: `Streak ${streak} zile — logează azi ca să nu-l pierzi.`,
      });
    }
  }

  // RHR consistently low (recovered)
  if (recent5.length >= 5) {
    const recentRhrAvg = recent5.reduce((s, e) => s + e.rhr, 0) / recent5.length;
    const allRhrAvg = mine.reduce((s, e) => s + e.rhr, 0) / mine.length;
    if (recentRhrAvg < allRhrAvg - 4) {
      out.push({
        id: `${wk}_rhr_low`,
        kind: 'good',
        emoji: '🫀',
        text: `RHR mediu ultima săptămână ${Math.round(recentRhrAvg)} — sub media ta de ${Math.round(allRhrAvg)}. Recuperare bună!`,
      });
    }
  }

  // Order: warnings first (they're actionable), then good (motivating), then info
  const order: Record<AlertKind, number> = { warn: 0, good: 1, info: 2 };
  out.sort((a, b) => order[a.kind] - order[b.kind]);

  return out;
}

/* ── Dismissal management ── */

const DISMISS_KEY = (user: string) => `somn_alerts_dismissed_${user}`;

export function loadDismissed(user: string): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY(user));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveDismissed(user: string, ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY(user), JSON.stringify([...ids]));
  } catch { /* ignore */ }
}
