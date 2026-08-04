/* ─────────────────────────────────────────────────────────
   Gamification engine — THREE rules, nothing else.

   The old engine had eight overlapping sources of XP (bands, early bird,
   God Mode windows, Ascension, badge tiers, a Mastery multiplier...) and
   nobody could say where a number came from. It is now one sentence:

     1. Loghezi o noapte  → +10 XP
     2. Calitatea nopții  → 80+ : +10 · 90+ : +20 · 95+ : +30 · 100 : +1000 XP
     3. Serie fără pauză  → 7 / 30 / 100 / 365 zile : +50 / +200 / +600 / +2000 XP

   Badges do NOT pay XP. They are the trophy shelf for exactly the same three
   behaviours, so a badge can never be a hidden economy: whatever you see in
   the breakdown IS your XP.
   ───────────────────────────────────────────────────────── */
import { type SleepEntry } from '@/lib/sleep';

/* ─── Level curve ───
 *
 * Each level costs more than the last, so the ladder paces a multi-year climb:
 *
 *   cost(L → L+1) = LEVEL_BASE + LEVEL_STEP × (L − 1)
 *   totalFor(L)   = Σ cost(1..L−1)
 *
 * Left untouched by the simplification. The old economy multiplied a small
 * per-night sum by Mastery; the new one pays that value straight (a good night
 * is 25-50 XP instead of 15 × 1.6), so a consistent logger still lands near the
 * cap around the two-year mark — the pacing the curve was calibrated for.
 */
export const LEVEL_BASE = 100;

/** MAX_LEVEL = 46. The ceiling, and the end of the ladder — an inside joke. */
export const LEVEL_STEP = 16;
export const MAX_LEVEL = 46;

/** Cumulative XP required to BE at `level`. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  const n = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) - 1;
  return LEVEL_BASE * n + (LEVEL_STEP * n * (n - 1)) / 2;
}

/** XP cost of the single step `level` → `level + 1`. 0 at the cap. */
export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return LEVEL_BASE + LEVEL_STEP * (Math.max(1, level) - 1);
}

/** XP needed to reach the cap — the finish line. */
export const XP_FOR_MAX_LEVEL = xpForLevel(MAX_LEVEL);

export function xpLevel(xp: number): number {
  if (xp <= 0) return 1;
  if (xp >= XP_FOR_MAX_LEVEL) return MAX_LEVEL;
  // Invert totalFor(L) ≤ xp analytically, then correct for float drift.
  const a = LEVEL_STEP / 2;
  const b = LEVEL_BASE - LEVEL_STEP / 2;
  let n = Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a));
  while (xpForLevel(n + 2) <= xp) n++;
  while (n > 0 && xpForLevel(n + 1) > xp) n--;
  return Math.min(MAX_LEVEL, n + 1);
}

export interface LevelProgress {
  level: number;
  into: number;   // XP earned inside the current level
  need: number;   // XP the current level costs in total (0 at the cap)
  pct: number;    // 0–100
  maxed: boolean;
}

/** Everything the UI needs to draw an XP bar. */
export function levelProgress(xp: number): LevelProgress {
  const level = xpLevel(xp);
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, into: 0, need: 0, pct: 100, maxed: true };
  }
  const need = xpToNextLevel(level);
  const into = Math.max(0, xp - xpForLevel(level));
  return { level, into, need, pct: need ? Math.min(100, (into / need) * 100) : 0, maxed: false };
}

/* ─── RULE 1 — showing up ─── */
export const BASE_XP_PER_LOG = 10;

/* ─── RULE 2 — the quality of the night ───
 *
 * Four bands, exclusive: a night is paid once, by the highest band it reaches.
 * The steps stay small and round (10 / 20 / 30) so you can still add a month up
 * in your head — except the last one.
 *
 * A perfect 100 pays 1000 XP: an entire palier in one night. Across the team's
 * whole history the best score ever recorded is 95, so this is deliberately a
 * carrot nobody has picked yet, not a plank of the economy. */
export const GOOD_SS = 80;
export const GREAT_SS = 90;

export const SS_BANDS = [
  { min: 100, xp: 1000, label: 'Noapte perfectă'     },
  { min: 95,  xp: 30,   label: 'Noapte excepțională' },
  { min: 90,  xp: 20,   label: 'Noapte excelentă'    },
  { min: 80,  xp: 10,   label: 'Noapte bună'         },
] as const;

/** Per-night quality bonus (exclusive bands). */
export function qualityXP(ss: number): number {
  for (const b of SS_BANDS) if (ss >= b.min) return b.xp;
  return 0;
}

/* ─── RULE 3 — the unbroken run ───
 * Awarded once, on the best run ever. Same four thresholds as the Serie badge,
 * on purpose: the badge tier IS the payout, so there's nothing to look up. */
export const STREAK_MILESTONES = [
  { days: 7, bonus: 50 },
  { days: 30, bonus: 200 },
  { days: 100, bonus: 600 },
  { days: 365, bonus: 2000 },
] as const;

/* ─── Badges — three, and they pay nothing ───
 *
 * One badge per XP rule. They mark how far you've taken each behaviour; the XP
 * for that behaviour was already paid by the rule. Tiers stay Garmin-style:
 * personal, cumulative, repeatable — nobody's badge blocks anybody else's.
 */
export interface AchievementTier {
  threshold: number;
  label: string;   // "Bronz" / "Argint" / "Aur" / "Platină"
  color: string;
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;         // Romanian display name
  hint: string;         // one-line caption
  description: string;  // long-form explainer for the detail modal
  tiers: AchievementTier[];
  count: (data: SleepEntry[], name: string) => number;
}

const TIER_COLORS = {
  bronze:   '#b45309',  // amber-700
  silver:   '#94a3b8',  // slate-400
  gold:     '#eab308',  // yellow-500
  platinum: '#22d3ee',  // cyan-400
} as const;

/** Build the 4-rung ladder every badge uses. */
const ladder = (t1: number, t2: number, t3: number, t4: number): AchievementTier[] => ([
  { threshold: t1, label: 'Bronz',   color: TIER_COLORS.bronze },
  { threshold: t2, label: 'Argint',  color: TIER_COLORS.silver },
  { threshold: t3, label: 'Aur',     color: TIER_COLORS.gold },
  { threshold: t4, label: 'Platină', color: TIER_COLORS.platinum },
]);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'logger',
    icon: '📝',
    name: 'Logger',
    hint: 'nopți logate',
    description: 'Fiecare noapte pe care o loghezi, indiferent de scor. E oglinda regulii 1: +10 XP de fiecare dată când apari. Consistența bate perfecțiunea.',
    tiers: ladder(10, 50, 200, 500),
    count: (data) => data.length,
  },
  {
    id: 'good-nights',
    icon: '✨',
    name: 'Nopți bune',
    hint: `nopți cu SS ≥ ${GOOD_SS}`,
    description: `Nopțile de ${GOOD_SS}+ sunt pragul unei nopți bune — și regula 2 din economia de XP: +10 XP peste 80, +20 peste 90, +30 peste 95, iar un 100 perfect plătește 1000 XP, adică un palier întreg. Aici se câștigă războiul pe termen lung: multe nopți de 80 bat două de 95 urmate de o săptămână proastă.`,
    tiers: ladder(5, 30, 120, 350),
    count: (data) => data.filter(e => e.ss >= GOOD_SS).length,
  },
  {
    id: 'streak',
    icon: '🔥',
    name: 'Serie',
    hint: 'cea mai lungă serie fără pauză',
    description: 'Cea mai lungă serie de zile consecutive logate, din toată istoria ta. Pragurile ei SUNT bonusurile de serie: 7 zile = +50 XP, 30 = +200, 100 = +600, un an întreg = +2000. Se ia în calcul recordul, deci o pauză nu-ți șterge ce ai construit.',
    tiers: ladder(7, 30, 100, 365),
    count: (data, name) => maxStreakFor(data, name),
  },
];

export interface AchievementProgress {
  achievement: Achievement;
  count: number;
  tiersReached: number;       // 0–4
  currentTier: AchievementTier | null;
  nextTier: AchievementTier | null;
}

/** Compute progress for every achievement for a given user. */
export function computeAchievements(data: SleepEntry[], name: string): AchievementProgress[] {
  const mine = data.filter(d => d.name === name);
  return ACHIEVEMENTS.map(a => {
    const c = a.count(mine, name);
    let tiersReached = 0;
    for (const t of a.tiers) if (c >= t.threshold) tiersReached++;
    return {
      achievement: a,
      count: c,
      tiersReached,
      currentTier: tiersReached > 0 ? a.tiers[tiersReached - 1] : null,
      nextTier: tiersReached < a.tiers.length ? a.tiers[tiersReached] : null,
    };
  });
}

/* ─── The breakdown ───
 * Three rules in, three lines out. Every field here is a number you can add up
 * by hand from your own history — that is the whole point of the rewrite. */
export interface BandTally {
  min: number;
  xp: number;
  label: string;
  count: number;   // nights that landed in THIS band (exclusive)
  total: number;   // count × xp
}

export interface XPBreakdown {
  logs: number;
  base: number;          // rule 1
  bands: BandTally[];    // rule 2, highest band first
  qualityXP: number;     // rule 2 total
  nights80: number;      // cumulative ≥ 80 — what the "×80+" chips mean
  nights90: number;      // cumulative ≥ 90
  streakMax: number;
  streakBonus: number;   // rule 3
  total: number;
}

/** Streak-milestone XP for this person's best run ever. */
export function streakXP(data: SleepEntry[], name: string): number {
  const best = maxStreakFor(data, name);
  let xp = 0;
  for (const m of STREAK_MILESTONES) if (best >= m.days) xp += m.bonus;
  return xp;
}

export function xpBreakdown(data: SleepEntry[], name: string): XPBreakdown {
  const entries = data.filter(d => d.name === name);
  const logs = entries.length;
  const base = logs * BASE_XP_PER_LOG;

  // Exclusive tally: each night falls into the highest band it reaches, so the
  // per-band counts sum to the number of nights and the XP sums to the total.
  const counts = new Map<number, number>(SS_BANDS.map(b => [b.min, 0]));
  for (const e of entries) {
    const band = SS_BANDS.find(b => e.ss >= b.min);
    if (band) counts.set(band.min, (counts.get(band.min) ?? 0) + 1);
  }
  const bands: BandTally[] = SS_BANDS.map(b => {
    const count = counts.get(b.min) ?? 0;
    return { min: b.min, xp: b.xp, label: b.label, count, total: count * b.xp };
  });
  const qualityXP = bands.reduce((s, b) => s + b.total, 0);
  const nights90 = bands.filter(b => b.min >= GREAT_SS).reduce((s, b) => s + b.count, 0);
  const nights80 = bands.reduce((s, b) => s + b.count, 0);

  const streakMax = maxStreakFor(data, name);
  const streakBonus = streakXP(data, name);

  return {
    logs, base,
    bands, qualityXP, nights80, nights90,
    streakMax, streakBonus,
    total: base + qualityXP + streakBonus,
  };
}

export function calcXP(data: SleepEntry[], name: string): number {
  return xpBreakdown(data, name).total;
}

/* ─── Paliere — ten rungs, one every 1000 XP ───
 *
 * Keyed on RAW XP, not on level. Levels cost more as you climb, so a palier
 * pinned to a level number drifts further apart the higher you go; pinned to XP,
 * every rung is the same amount of work — "încă 1000 XP" is the whole rule.
 *
 * TIER_STEP is the promise. The names and colours are the flavour. */
export const TIER_STEP = 1000;

export interface Tier {
  name: string;
  color: string;
  icon: string;
  minXP: number;
  blurb: string;
}

const TIER_FLAVOUR: Omit<Tier, 'minXP'>[] = [
  { name: 'Somnoros',           color: '#a1a1aa', icon: '·', blurb: 'Ai deschis aplicația. E un început.' },
  { name: 'Visător',            color: '#94a3b8', icon: '˚', blurb: 'Loghezi constant. Datele încep să spună ceva.' },
  { name: 'Somnambul',          color: '#60a5fa', icon: '◆', blurb: 'Ai un obicei, nu un experiment.' },
  { name: 'Ursulețul de Pat',   color: '#a78bfa', icon: '◇', blurb: 'Nopțile bune nu mai sunt accident.' },
  { name: 'Guru de Pernă',      color: '#c084fc', icon: '★', blurb: 'Îți știi tiparele mai bine decât ceasul.' },
  { name: 'Maestru al Nopții',  color: '#a3e635', icon: '☾', blurb: 'Orar de fier. Scoruri pe măsură.' },
  { name: 'Sensei REM',         color: '#facc15', icon: '❈', blurb: 'Somnul tău e o disciplină, nu o întâmplare.' },
  { name: 'Legendă a Somnului', color: '#fb923c', icon: '✦', blurb: 'Ani de consistență. Se vede.' },
  { name: 'Semizeu Hipnos',     color: '#f472b6', icon: '❋', blurb: 'Aproape nimeni nu ajunge aici.' },
  { name: 'Zeu al Somnului',    color: '#22d3ee', icon: '✺', blurb: 'Capătul scării. Nu mai ai ce demonstra nimănui.' },
];

/** Palier `i` starts at `i × 1000` XP — the first one at 0. */
export const TIERS: Tier[] = TIER_FLAVOUR.map((t, i) => ({ ...t, minXP: i * TIER_STEP }));

/** The top rung's threshold — 9000 XP. */
export const TIER_MAX_XP = TIERS[TIERS.length - 1].minXP;

export function tierFor(xp: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXP) return TIERS[i];
  }
  return TIERS[0];
}

/** The next tier up from `xp`, or null once you're on the top rung. */
export function nextTierFor(xp: number): Tier | null {
  return TIERS.find(t => t.minXP > xp) ?? null;
}

const DAY_MS = 86400000;
const dayNum = (d: string) => Math.round(new Date(d + 'T12:00:00').getTime() / DAY_MS);

/** Today as YYYY-MM-DD in LOCAL time. `toISOString()` would report the UTC day,
 *  which is the previous calendar day between 00:00 and 03:00 in Romania — that
 *  made streaks look a day off overnight. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Longest consecutive-day streak ever logged for this user.
 *
 * Unlike `streakFor` (current), this scans the whole history for the
 * best run regardless of whether it's still active.
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

  // Most recent log must be within the last 2 days. Local-day arithmetic —
  // `toISOString()` here reported the UTC day and broke streaks overnight.
  const t = dayNum(todayISO());
  const yStr = dates[0];
  const sinceLast = t - dayNum(yStr);
  if (sinceLast > 2) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const cur = new Date(dates[i - 1] + 'T12:00:00');
    const prev = new Date(dates[i] + 'T12:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (gap === 1) streak++;
    else break;
  }
  // Discount one if the most recent log is older than yesterday but within 2 days.
  if (sinceLast > 1) return Math.max(0, streak - 1);
  return streak;
}
