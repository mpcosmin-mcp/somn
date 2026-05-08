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

export function calcXP(data: SleepEntry[], name: string): number {
  const entries = data.filter(d => d.name === name);
  const base = entries.length * 10;
  let bonus = 0;
  for (const e of entries) {
    if (e.ss >= 90) bonus += 10;
    else if (e.ss >= 80) bonus += 5;
  }
  return base + bonus;
}

/* 3-tier system — no nonsense */
export interface Tier {
  name: string;
  color: string;
  icon: string;
  minLevel: number;
}

const TIERS: Tier[] = [
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
