/* ─────────────────────────────────────────────────────────
   insights.ts — deterministic computed insights for the
   dashboard + login. Zero AI, zero network. All input is
   the SleepEntry[] from the Sheet.
   ───────────────────────────────────────────────────────── */
import { type SleepEntry, NAMES, FIRST_NAME, aggregate, lastNDays } from '@/lib/sleep';
import { streakFor, maxStreakFor } from '@/lib/gamify';
import { todayStr } from '@/lib/utils';

/* ── Greeting (login) ───────────────────────────────────── */

export interface Greeting {
  headline: string;
  sub: string;
  tone: 'good' | 'neutral' | 'warn' | 'fire';
}

/** Hot, context-aware welcome line based on the user's current state. */
export function loginGreeting(entries: SleepEntry[], user: string): Greeting {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const mine = entries.filter(e => e.name === user).sort((a, b) => a.date.localeCompare(b.date));
  if (!mine.length) {
    return { headline: `bun venit, ${fn}`, sub: 'primul log te așteaptă', tone: 'neutral' };
  }
  const last = mine[mine.length - 1];
  const streak = streakFor(entries, user);
  const today = todayStr();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return todayStr(d); })();

  // Active streak milestones
  if (streak >= 30) return { headline: `${fn}, ești de neoprit`, sub: `${streak}d streak — legend tier`, tone: 'fire' };
  if (streak >= 14) return { headline: `salut, ${fn}`, sub: `${streak}d streak 🔥 keep going`, tone: 'fire' };
  if (streak >= 7) return { headline: `mișto, ${fn}`, sub: `${streak}d la rând — săptămâna ta`, tone: 'fire' };
  if (streak >= 3) return { headline: `bun, ${fn}`, sub: `${streak}d streak — nu rupe acum`, tone: 'good' };

  // Just broke streak
  if (last.date < yesterday) {
    const daysAgo = Math.floor((Date.parse(today) - Date.parse(last.date)) / 86400000);
    if (daysAgo === 2) return { headline: `hey, ${fn}`, sub: 'ai sărit ieri — recuperăm azi', tone: 'warn' };
    if (daysAgo >= 3) return { headline: `unde ai fost, ${fn}?`, sub: `${daysAgo} zile fără log — vino înapoi`, tone: 'warn' };
  }

  // Most recent score quality
  if (last.ss >= 90) return { headline: `${fn}, REGE`, sub: `ultima noapte ${last.ss} SS — savurează`, tone: 'fire' };
  if (last.ss >= 80) return { headline: `bun venit, ${fn}`, sub: `ultima noapte ${last.ss} SS — solid`, tone: 'good' };
  if (last.ss < 55) return { headline: `salut, ${fn}`, sub: `ultima ${last.ss} SS — azi recuperăm`, tone: 'warn' };

  return { headline: `bun venit, ${fn}`, sub: `ultima ta noapte: ${last.ss} SS`, tone: 'neutral' };
}

/* ── Fact of the day / week / month ─────────────────────── */

export type FactPeriod = 'day' | 'week' | 'month';
export interface Fact { period: FactPeriod; text: string; }

/** Hash any string to a stable small integer (so facts feel random but don't flicker). */
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A rotating, deterministic fact about the team for the current period. */
export function factOfThePeriod(entries: SleepEntry[]): Fact | null {
  if (entries.length < 3) return null;

  const candidates: { period: FactPeriod; text: string }[] = [];

  // ── Day facts ──
  const last7 = lastNDays(entries, 7);
  if (last7.length) {
    const lastDay = [...new Set(last7.map(e => e.date))].sort().pop()!;
    const ofDay = last7.filter(e => e.date === lastDay);
    if (ofDay.length >= 2) {
      const top = [...ofDay].sort((a, b) => b.ss - a.ss)[0];
      candidates.push({ period: 'day', text: `${FIRST_NAME[top.name] ?? top.name} a dormit cel mai bine ieri · ${top.ss} SS` });
    }
    const remBest = [...ofDay].filter(e => e.rem != null).sort((a, b) => (b.rem ?? 0) - (a.rem ?? 0))[0];
    if (remBest?.rem != null) {
      candidates.push({ period: 'day', text: `${FIRST_NAME[remBest.name] ?? remBest.name} a făcut ${remBest.rem}min REM aseară · top` });
    }
  }

  // ── Week facts ──
  const agg7 = aggregate(last7);
  if (agg7.length >= 2) {
    const top = agg7[0];
    const second = agg7[1];
    const fnTop = FIRST_NAME[top.name] ?? top.name;
    const fnSec = FIRST_NAME[second.name] ?? second.name;
    candidates.push({ period: 'week', text: `${fnTop} conduce săptămâna · ⌀${top.ss} SS vs ${fnSec} cu ⌀${second.ss}` });

    const hrvBest = [...agg7].filter(a => a.hrv != null).sort((a, b) => (b.hrv ?? 0) - (a.hrv ?? 0))[0];
    if (hrvBest?.hrv != null) {
      candidates.push({ period: 'week', text: `${FIRST_NAME[hrvBest.name] ?? hrvBest.name} are cel mai bun HRV mediu · ⌀${hrvBest.hrv}ms` });
    }
    const rhrBest = [...agg7].filter(a => a.rhr > 0).sort((a, b) => a.rhr - b.rhr)[0];
    if (rhrBest?.rhr) {
      candidates.push({ period: 'week', text: `${FIRST_NAME[rhrBest.name] ?? rhrBest.name} are cel mai mic RHR mediu · ⌀${rhrBest.rhr}bpm` });
    }
  }

  // ── Month facts ──
  const last30 = lastNDays(entries, 30);
  if (last30.length >= 5) {
    const byUser: Record<string, number> = {};
    for (const e of last30) byUser[e.name] = (byUser[e.name] ?? 0) + 1;
    const mostLogs = Object.entries(byUser).sort(([, a], [, b]) => b - a)[0];
    if (mostLogs) {
      candidates.push({ period: 'month', text: `${FIRST_NAME[mostLogs[0]] ?? mostLogs[0]} a logat ${mostLogs[1]} nopți luna asta · most consistent` });
    }
    const bestNight = [...last30].sort((a, b) => b.ss - a.ss)[0];
    if (bestNight) {
      candidates.push({ period: 'month', text: `cea mai bună noapte a lunii · ${FIRST_NAME[bestNight.name] ?? bestNight.name} cu ${bestNight.ss} SS` });
    }
  }

  if (!candidates.length) return null;
  // Stable but rotating by date — same fact for the whole day, different tomorrow.
  const idx = strHash(todayStr()) % candidates.length;
  return candidates[idx];
}

/* ── Personal Records ───────────────────────────────────── */

export interface PersonalRecords {
  bestSS: { value: number; date: string } | null;
  bestREM: { value: number; date: string } | null;
  lowestRHR: { value: number; date: string } | null;
  bestHRV: { value: number; date: string } | null;
  longestStreak: number;
  totalLogs: number;
}

export function personalRecords(entries: SleepEntry[], user: string): PersonalRecords {
  const mine = entries.filter(e => e.name === user);
  if (!mine.length) {
    return { bestSS: null, bestREM: null, lowestRHR: null, bestHRV: null, longestStreak: 0, totalLogs: 0 };
  }
  const bestSS = [...mine].sort((a, b) => b.ss - a.ss)[0];
  const remEntries = mine.filter(e => e.rem != null);
  const bestREM = remEntries.length ? [...remEntries].sort((a, b) => (b.rem ?? 0) - (a.rem ?? 0))[0] : null;
  const rhrEntries = mine.filter(e => e.rhr > 0);
  const lowestRHR = rhrEntries.length ? [...rhrEntries].sort((a, b) => a.rhr - b.rhr)[0] : null;
  const hrvEntries = mine.filter(e => e.hrv != null);
  const bestHRV = hrvEntries.length ? [...hrvEntries].sort((a, b) => (b.hrv ?? 0) - (a.hrv ?? 0))[0] : null;

  return {
    bestSS: { value: bestSS.ss, date: bestSS.date },
    bestREM: bestREM ? { value: bestREM.rem!, date: bestREM.date } : null,
    lowestRHR: lowestRHR ? { value: lowestRHR.rhr, date: lowestRHR.date } : null,
    bestHRV: bestHRV ? { value: bestHRV.hrv!, date: bestHRV.date } : null,
    longestStreak: maxStreakFor(entries, user),
    totalLogs: mine.length,
  };
}

/* ── Anomalies — current state vs 30d baseline ──────────── */

export interface Anomaly {
  kind: 'rhr-high' | 'hrv-low' | 'ss-low' | 'ss-spike' | 'streak-milestone' | 'pr-broken';
  text: string;
  tone: 'good' | 'warn';
}

/** Returns at most 2 most important callouts for the user right now. */
export function anomaliesFor(entries: SleepEntry[], user: string): Anomaly[] {
  const mine = entries.filter(e => e.name === user).sort((a, b) => b.date.localeCompare(a.date));
  if (mine.length < 5) return [];
  const last = mine[0];
  const baseline = mine.slice(1, 31);
  if (baseline.length < 4) return [];

  const out: Anomaly[] = [];

  // SS recent vs baseline
  const avgSS = baseline.reduce((s, e) => s + e.ss, 0) / baseline.length;
  if (last.ss - avgSS >= 10) {
    out.push({ kind: 'ss-spike', tone: 'good', text: `azi ${last.ss} SS · +${Math.round(last.ss - avgSS)} peste media ta de 30d` });
  } else if (avgSS - last.ss >= 10) {
    out.push({ kind: 'ss-low', tone: 'warn', text: `azi ${last.ss} SS · ${Math.round(last.ss - avgSS)} sub baseline · recovery day?` });
  }

  // RHR — higher is worse
  if (last.rhr > 0) {
    const rhrBase = baseline.filter(e => e.rhr > 0);
    if (rhrBase.length >= 4) {
      const avgRHR = rhrBase.reduce((s, e) => s + e.rhr, 0) / rhrBase.length;
      if (last.rhr - avgRHR >= 5) {
        out.push({ kind: 'rhr-high', tone: 'warn', text: `RHR ${last.rhr}bpm · +${Math.round(last.rhr - avgRHR)} față de baseline · răcit / stresat?` });
      }
    }
  }

  // HRV — lower is worse
  if (last.hrv != null) {
    const hrvBase = baseline.filter(e => e.hrv != null);
    if (hrvBase.length >= 4) {
      const avgHRV = hrvBase.reduce((s, e) => s + (e.hrv ?? 0), 0) / hrvBase.length;
      if (avgHRV - last.hrv >= 8) {
        out.push({ kind: 'hrv-low', tone: 'warn', text: `HRV ${last.hrv}ms · ${Math.round(last.hrv - avgHRV)} sub baseline · stres ridicat?` });
      }
    }
  }

  // PR broken on last night
  const bestSSBefore = baseline.reduce((m, e) => Math.max(m, e.ss), 0);
  if (last.ss > bestSSBefore && bestSSBefore > 0) {
    out.push({ kind: 'pr-broken', tone: 'good', text: `🏆 PR nou de Sleep Score · ${last.ss} (vechi: ${bestSSBefore})` });
  }

  // Streak milestone
  const s = streakFor(entries, user);
  if (s === 7 || s === 14 || s === 30 || s === 50 || s === 100) {
    out.push({ kind: 'streak-milestone', tone: 'good', text: `🔥 ${s}d streak — milestone` });
  }

  // Prioritize: good news first then top-2
  return out.sort((a) => a.tone === 'good' ? -1 : 1).slice(0, 2);
}

/* ── Weekly MVP — best avg SS over last 7d ──────────────── */

export interface MVP { name: string; avgSS: number; entries: number; }

export function weeklyMVP(entries: SleepEntry[]): MVP | null {
  const last7 = lastNDays(entries, 7);
  if (last7.length < 3) return null;
  const agg = aggregate(last7).filter(a => a.entries >= 3);
  if (!agg.length) return null;
  const top = agg[0];
  return { name: top.name, avgSS: top.ss, entries: top.entries };
}

/* ── Head-to-Head — current user vs each teammate, last 7d ── */

export interface H2H {
  vs: string;
  meAvg: number;
  themAvg: number;
  meEntries: number;
  themEntries: number;
  diff: number;
}

export function headToHeadWeek(entries: SleepEntry[], user: string): H2H[] {
  const last7 = lastNDays(entries, 7);
  const agg = aggregate(last7);
  const me = agg.find(a => a.name === user);
  if (!me || me.entries < 2) return [];
  const result: H2H[] = [];
  for (const name of NAMES) {
    if (name === user) continue;
    const them = agg.find(a => a.name === name);
    if (!them || them.entries < 2) continue;
    result.push({
      vs: name,
      meAvg: me.ss,
      themAvg: them.ss,
      meEntries: me.entries,
      themEntries: them.entries,
      diff: me.ss - them.ss,
    });
  }
  return result;
}

/* ── Badges — earned achievements ───────────────────────── */

export interface Badge {
  id: string;
  label: string;
  icon: string;
  color: string;
  earned: boolean;
  /** Short hint that explains how it's earned — shown on hover/tap. */
  hint: string;
}

export function badgesFor(entries: SleepEntry[], user: string): Badge[] {
  const mine = entries.filter(e => e.name === user);
  const maxStreak = maxStreakFor(entries, user);
  const hasSS = (min: number) => mine.some(e => e.ss >= min);
  const hasREM = (min: number) => mine.some(e => e.rem != null && e.rem >= min);
  const hasRHRBelow = (max: number) => mine.some(e => e.rhr > 0 && e.rhr <= max);
  const hasHRV = (min: number) => mine.some(e => e.hrv != null && e.hrv >= min);

  return [
    { id: 'first',       label: 'First Log',     icon: '✦',  color: '#94a3b8', earned: mine.length >= 1,    hint: 'primul tău log' },
    { id: 'pillar',      label: 'Pillar',        icon: '🗿',  color: '#a3e635', earned: mine.length >= 50,   hint: '50+ loguri' },
    { id: 'week',        label: 'Week Warrior',  icon: '🔥',  color: '#f97316', earned: maxStreak >= 7,      hint: '7d streak' },
    { id: 'month',       label: 'Month Master',  icon: '👑',  color: '#fbbf24', earned: maxStreak >= 30,     hint: '30d streak' },
    { id: 'ss90',        label: 'PR Hunter',     icon: '🏆',  color: '#10b981', earned: hasSS(90),           hint: '90+ SS' },
    { id: 'ss95',        label: 'Sleep God',     icon: '💎',  color: '#22d3ee', earned: hasSS(95),           hint: '95+ SS' },
    { id: 'rem120',      label: 'REM King',      icon: '🌙',  color: '#a78bfa', earned: hasREM(120),         hint: '120+ min REM' },
    { id: 'rhr50',       label: 'Recovery King', icon: '🫀',  color: '#34d399', earned: hasRHRBelow(50),     hint: 'RHR ≤50 bpm' },
    { id: 'hrv70',       label: 'HRV Beast',     icon: '⚡',  color: '#facc15', earned: hasHRV(70),          hint: 'HRV 70+ ms' },
  ];
}
