/* ─────────────────────────────────────────────────────────
   Simple gamification — keep it minimal.
   XP = logs × 10 + SS quality bonus + achievement-tier unlocks
   3 tiers (no flowery 30-name level system)

   Achievements are Garmin-style: personal, cumulative, repeatable.
   Everyone earns their own — no zero-sum "best-at" gating.
   ───────────────────────────────────────────────────────── */
import { type SleepEntry, bedtimeFrom18, sleepDurationMin } from '@/lib/sleep';

export const XP_PER_LEVEL = 100;

export function xpLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpProgress(xp: number): number {
  return xp % XP_PER_LEVEL;
}

const STREAK_MILESTONES = [
  { days: 7, bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 200 },
] as const;

const EARLY_BIRD_CUTOFF = 300; // 23:00 = 300 min past 18:00

/* ─── Achievement system ───
 *
 * Each achievement is a repeatable metric with tiered thresholds.
 * Awarded XP is FLAT per tier crossed — no per-event double-count with
 * the base/quality bonuses above. Reaching a tier gives its `xp` bonus
 * once; the total for a badge is the sum of all reached tiers.
 *
 * Everyone earns their own achievements — no leader-takes-all.
 * Clara can never lose them to Gabi. That was the whole point.
 */

export interface AchievementTier {
  threshold: number;
  label: string;   // "Bronz" / "Argint" / "Aur" / "Platină"
  color: string;
  xp: number;
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;      // Romanian display name
  hint: string;      // one-line description of the event that counts
  tiers: AchievementTier[];
  count: (data: SleepEntry[]) => number;
}

const TIER_COLORS = {
  bronze:   '#b45309',  // amber-700
  silver:   '#94a3b8',  // slate-400
  gold:     '#eab308',  // yellow-500
  platinum: '#22d3ee',  // cyan-400
} as const;

/** Build a 4-tier ladder with escalating XP rewards. */
const ladder = (t1: number, t2: number, t3: number, t4: number): AchievementTier[] => ([
  { threshold: t1, label: 'Bronz',    color: TIER_COLORS.bronze,   xp: 25 },
  { threshold: t2, label: 'Argint',   color: TIER_COLORS.silver,   xp: 50 },
  { threshold: t3, label: 'Aur',      color: TIER_COLORS.gold,     xp: 100 },
  { threshold: t4, label: 'Platină',  color: TIER_COLORS.platinum, xp: 200 },
]);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'logger',
    icon: '📝',
    name: 'Logger',
    hint: 'nopți logate',
    tiers: ladder(10, 30, 100, 250),
    count: (data) => data.length,
  },
  {
    id: 'god-mode',
    icon: '💯',
    name: 'God Mode',
    hint: 'nopți cu SS = 100 (perfect)',
    tiers: ladder(1, 3, 7, 15),
    count: (data) => data.filter(e => e.ss >= 100).length,
  },
  {
    id: 'near-perfect',
    icon: '👑',
    name: 'Aproape Perfect',
    hint: 'nopți cu SS ≥ 95',
    tiers: ladder(1, 5, 15, 40),
    count: (data) => data.filter(e => e.ss >= 95).length,
  },
  {
    id: 'elite',
    icon: '🌟',
    name: 'Noapte Elită',
    hint: 'nopți cu SS ≥ 90',
    tiers: ladder(1, 5, 15, 40),
    count: (data) => data.filter(e => e.ss >= 90).length,
  },
  {
    id: 'great',
    icon: '✨',
    name: 'Noapte Bună',
    hint: 'nopți cu SS ≥ 80',
    tiers: ladder(5, 20, 60, 150),
    count: (data) => data.filter(e => e.ss >= 80).length,
  },
  {
    id: 'early-bird',
    icon: '🌙',
    name: 'Ciocârlie',
    hint: 'nopți culcare < 23:00',
    tiers: ladder(5, 15, 40, 100),
    count: (data) => data.filter(e => {
      const bt = bedtimeFrom18(e.start);
      return bt != null && bt < EARLY_BIRD_CUTOFF;
    }).length,
  },
  {
    id: 'long-sleep',
    icon: '💤',
    name: 'Somn Lung',
    hint: 'nopți ≥ 8h somn',
    tiers: ladder(3, 12, 35, 90),
    count: (data) => data.filter(e => {
      const d = sleepDurationMin(e.start, e.end);
      return d != null && d >= 480;
    }).length,
  },
  {
    id: 'rem-master',
    icon: '🧠',
    name: 'Maestru REM',
    hint: 'nopți cu REM ≥ 90m',
    tiers: ladder(3, 10, 25, 60),
    count: (data) => data.filter(e => e.rem != null && e.rem >= 90).length,
  },
  {
    id: 'low-rhr',
    icon: '🫀',
    name: 'Puls Odihnit',
    hint: 'nopți cu RHR < 55',
    tiers: ladder(3, 10, 25, 60),
    count: (data) => data.filter(e => e.rhr > 0 && e.rhr < 55).length,
  },
  {
    id: 'high-hrv',
    icon: '⚡',
    name: 'HRV Elită',
    hint: 'nopți cu HRV ≥ 60',
    tiers: ladder(3, 10, 25, 60),
    count: (data) => data.filter(e => e.hrv != null && e.hrv >= 60).length,
  },
  {
    id: 'journaler',
    icon: '📓',
    name: 'Jurnalist',
    hint: 'nopți cu jurnal scris',
    tiers: ladder(3, 10, 30, 80),
    count: (data) => data.filter(e => e.journal && e.journal.trim().length > 0).length,
  },
];

export interface AchievementProgress {
  achievement: Achievement;
  count: number;
  tiersReached: number;       // 0–4
  currentTier: AchievementTier | null;
  nextTier: AchievementTier | null;
  xpEarned: number;           // sum of all reached tier bonuses
}

/** Compute progress for every achievement for a given user. */
export function computeAchievements(data: SleepEntry[], name: string): AchievementProgress[] {
  const mine = data.filter(d => d.name === name);
  return ACHIEVEMENTS.map(a => {
    const c = a.count(mine);
    let tiersReached = 0;
    let xpEarned = 0;
    for (const t of a.tiers) {
      if (c >= t.threshold) {
        tiersReached++;
        xpEarned += t.xp;
      }
    }
    return {
      achievement: a,
      count: c,
      tiersReached,
      currentTier: tiersReached > 0 ? a.tiers[tiersReached - 1] : null,
      nextTier: tiersReached < a.tiers.length ? a.tiers[tiersReached] : null,
      xpEarned,
    };
  });
}

/** Total XP earned from all achievement tiers, for use in xpBreakdown.
 *  This is the coupling point Gabi asked for: mai multe badgeuri → mai mult XP.
 *  Non-double-counting: tier XP is a flat first-unlock bonus, orthogonal to
 *  the per-event bonus90/bonus80/earlyBirdBonus paid in `xpBreakdown`. */
export function achievementsXP(data: SleepEntry[], name: string): number {
  return computeAchievements(data, name).reduce((s, p) => s + p.xpEarned, 0);
}

/* ─── God Mode ───
 * A flawless night (SS = 100) turns on GOD MODE for the next 7 days:
 * every night logged in that window earns +20% XP. Logging another 100
 * refreshes the window. The 100-night itself is NOT boosted — it already
 * banks a big flat +50 (see the SS bands below). */
export const GOD_BONUS_XP = 500;     // per SS=100 night — the jackpot
export const NEAR_BONUS_XP = 200;    // per SS 95–99 night
export const GOD_WINDOW_DAYS = 7;
export const GOD_BOOST = 0.20;       // +20% XP inside the window

const DAY_MS = 86400000;
const dayNum = (d: string) => Math.round(new Date(d + 'T12:00:00').getTime() / DAY_MS);

/** Per-night flat SS bonus (exclusive bands). */
function ssBandBonus(ss: number): number {
  if (ss >= 100) return GOD_BONUS_XP;
  if (ss >= 95) return NEAR_BONUS_XP;
  if (ss >= 90) return 10;
  if (ss >= 80) return 5;
  return 0;
}

/** Is God Mode active for this user RIGHT NOW, and how many days remain?
 *  Active while today is within GOD_WINDOW_DAYS of a logged SS=100 night. */
export function godMode(data: SleepEntry[], name: string): { active: boolean; daysLeft: number } {
  const today = dayNum(new Date().toISOString().slice(0, 10));
  let daysLeft = 0;
  for (const e of data) {
    if (e.name !== name || e.ss < 100) continue;
    const since = today - dayNum(e.date);
    if (since >= 0 && since <= GOD_WINDOW_DAYS) daysLeft = Math.max(daysLeft, GOD_WINDOW_DAYS - since);
  }
  return { active: daysLeft > 0, daysLeft };
}

export interface XPBreakdown {
  logs: number;
  base: number;
  count100: number;
  bonus100: number;
  count95: number;
  bonus95: number;
  count90: number;
  bonus90: number;
  count80: number;
  bonus80: number;
  earlyBirdCount: number;
  earlyBirdBonus: number;
  godBoost: number;             // extra XP from the +20% God Mode window
  godActive: boolean;           // God Mode live right now
  godDaysLeft: number;
  streakMax: number;
  streakBonus: number;
  achievementsCount: number;    // total tiers reached across all badges
  achievementsBonus: number;    // XP from those tiers
  total: number;
}

export function xpBreakdown(data: SleepEntry[], name: string): XPBreakdown {
  const entries = data.filter(d => d.name === name).sort((a, b) => a.date.localeCompare(b.date));
  const logs = entries.length;
  const base = logs * 10;

  // Days that opened a God Mode window (SS = 100)
  const godDays = entries.filter(e => e.ss >= 100).map(e => dayNum(e.date));
  const inGodWindow = (d: string) => {
    const t = dayNum(d);
    return godDays.some(g => { const diff = t - g; return diff >= 1 && diff <= GOD_WINDOW_DAYS; });
  };

  let count100 = 0, count95 = 0, count90 = 0, count80 = 0, earlyBirdCount = 0;
  let godBoost = 0;
  for (const e of entries) {
    if (e.ss >= 100) count100++;
    else if (e.ss >= 95) count95++;
    else if (e.ss >= 90) count90++;
    else if (e.ss >= 80) count80++;

    let eb = 0;
    const bt = bedtimeFrom18(e.start);
    if (bt != null && bt < EARLY_BIRD_CUTOFF) { earlyBirdCount++; eb = 5; }

    if (inGodWindow(e.date)) {
      const nightXP = 10 + ssBandBonus(e.ss) + eb;
      godBoost += nightXP * GOD_BOOST;
    }
  }
  godBoost = Math.round(godBoost);
  const earlyBirdBonus = earlyBirdCount * 5;
  const bonus100 = count100 * GOD_BONUS_XP;
  const bonus95 = count95 * NEAR_BONUS_XP;
  const bonus90 = count90 * 10;
  const bonus80 = count80 * 5;

  const { active: godActive, daysLeft: godDaysLeft } = godMode(data, name);

  const streakMax = maxStreakFor(data, name);
  let streakBonus = 0;
  for (const m of STREAK_MILESTONES) {
    if (streakMax >= m.days) streakBonus += m.bonus;
  }

  const achievements = computeAchievements(data, name);
  const achievementsCount = achievements.reduce((s, p) => s + p.tiersReached, 0);
  const achievementsBonus = achievements.reduce((s, p) => s + p.xpEarned, 0);

  const total = base + bonus100 + bonus95 + bonus90 + bonus80 + earlyBirdBonus + godBoost + streakBonus + achievementsBonus;

  return {
    logs, base,
    count100, bonus100,
    count95, bonus95,
    count90, bonus90,
    count80, bonus80,
    earlyBirdCount, earlyBirdBonus,
    godBoost, godActive, godDaysLeft,
    streakMax, streakBonus,
    achievementsCount, achievementsBonus,
    total,
  };
}

export function calcXP(data: SleepEntry[], name: string): number {
  return xpBreakdown(data, name).total;
}

/* Tier system — 10 paliere, o denumire nouă la fiecare 5 nivele.
 *
 * Nume românești inspirate din somn/lene simpatică; escaladează
 * spre mitologic/absurd la nivele mari. Culoarea semnalează faza.
 * Icon-ul e un simbol scurt (un caracter, fără emoji în bara top —
 * emoji-urile îngrașă tipografia și strică kerning-ul). */
export interface Tier {
  name: string;
  color: string;
  icon: string;
  minLevel: number;
}

export const TIERS: Tier[] = [
  { name: 'Somnoros',        color: '#a1a1aa', icon: '·', minLevel: 1 },
  { name: 'Visător',         color: '#94a3b8', icon: '˚', minLevel: 5 },
  { name: 'Somnambul',       color: '#60a5fa', icon: '◆', minLevel: 10 },
  { name: 'Ursulețul de Pat',color: '#a78bfa', icon: '◇', minLevel: 15 },
  { name: 'Guru de Pernă',   color: '#c084fc', icon: '★', minLevel: 20 },
  { name: 'Maestru al Nopții',color: '#a3e635', icon: '☾', minLevel: 25 },
  { name: 'Sensei REM',      color: '#facc15', icon: '❈', minLevel: 30 },
  { name: 'Legendă a Somnului',color: '#fb923c', icon: '✦', minLevel: 40 },
  { name: 'Semizeu Hipnos',  color: '#f472b6', icon: '❋', minLevel: 50 },
  { name: 'Zeu al Somnului', color: '#22d3ee', icon: '✺', minLevel: 75 },
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
