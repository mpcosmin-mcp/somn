/* ─────────────────────────────────────────────────────────
   Simple gamification — keep it minimal.
   XP = logs × 10 + SS quality bonus
   3 tiers (no flowery 30-name level system)
   ───────────────────────────────────────────────────────── */
import { type SleepEntry } from '@/lib/sleep';

export const XP_PER_LEVEL = 100;

export function xpLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpProgress(xp: number): number {
  return xp % XP_PER_LEVEL;
}

export interface XPBreakdown {
  logs: number;
  base: number;
  count90: number;
  bonus90: number;
  count80: number;
  bonus80: number;
  total: number;
}

export function xpBreakdown(data: SleepEntry[], name: string): XPBreakdown {
  const entries = data.filter(d => d.name === name);
  const logs = entries.length;
  const base = logs * 10;
  let count90 = 0;
  let count80 = 0;
  for (const e of entries) {
    if (e.ss >= 90) count90++;
    else if (e.ss >= 80) count80++;
  }
  return {
    logs,
    base,
    count90,
    bonus90: count90 * 10,
    count80,
    bonus80: count80 * 5,
    total: base + count90 * 10 + count80 * 5,
  };
}

export function calcXP(data: SleepEntry[], name: string): number {
  return xpBreakdown(data, name).total;
}

/* 3-tier system — no nonsense */
export interface Tier {
  name: string;
  color: string;
  icon: string;
  minLevel: number;
}

export const TIERS: Tier[] = [
  { name: 'Începător', color: '#a1a1aa', icon: '·', minLevel: 1 },
  { name: 'Pro',       color: '#60a5fa', icon: '◆', minLevel: 5 },
  { name: 'Maestru',   color: '#a3e635', icon: '◇', minLevel: 15 },
];

export function tierFor(level: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (level >= TIERS[i].minLevel) return TIERS[i];
  }
  return TIERS[0];
}

/**
 * Longest consecutive-day streak ever logged for this user.
 *
 * Unlike `streakFor` (current), this scans the whole history for the
 * best run regardless of whether it's still active. Used as a personal
 * record in the profile popover.
 */
export function maxStreakFor(data: SleepEntry[], name: string): number {
  const dates = [...new Set(data.filter(d => d.name === name).map(e => e.date))].sort();
  if (!dates.length) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1] + 'T12:00:00');
    const b = new Date(dates[i] + 'T12:00:00');
    const gap = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (gap === 1) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 1;
    }
  }
  return max;
}

/* Streak — number of consecutive logged days, ending at most yesterday */
export function streakFor(data: SleepEntry[], name: string): number {
  const dates = [...new Set(data.filter(d => d.name === name).map(e => e.date))].sort().reverse();
  if (!dates.length) return 0;

  // Most recent log must be within the last 2 days
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const yStr = yesterday.toISOString().split('T')[0];
  const tStr = twoDaysAgo.toISOString().split('T')[0];
  if (dates[0] < tStr) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const cur = new Date(dates[i - 1] + 'T12:00:00');
    const prev = new Date(dates[i] + 'T12:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (gap === 1) streak++;
    else break;
  }
  // Discount one if most recent is older than yesterday but still within 2 days
  if (dates[0] < yStr) return Math.max(0, streak - 1);
  return streak;
}
