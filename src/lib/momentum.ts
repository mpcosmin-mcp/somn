/* ─────────────────────────────────────────────────────────
   Momentum — how FAST are you progressing, right now?

   The leaderboard shows who has accumulated the most. It says nothing about
   who is moving fastest today: someone can sit on top for months on the
   strength of an old streak while a teammate quietly out-paces them. This is
   that missing number.

   Two things this deliberately gets right, because both are easy to get wrong:

   1. Momentum is built from RECURRING XP only — the XP a night pays every time
      it happens. Mastery belongs here (a badge tier is a permanent % on every
      night, so it IS your rate). Streak milestones do not: they are one-time
      records, and folding them into a "speed" would print a flattering number
      today that sags later through no fault of the user. They are shown apart.

   2. A flat XP rate does NOT mean a flat rate of levelling. Levels cost more as
      you climb (see xpToNextLevel), so 30 XP/day buys a level every 12 days at
      Lv 11 but every 44 days at Lv 50. We therefore publish both the multiplier
      AND the honest day-count to the next level and tier.
   ───────────────────────────────────────────────────────── */
import { type SleepEntry } from '@/lib/sleep';
import {
  type Tier,
  ACHIEVEMENTS, BASE_XP_PER_LOG, GOD_BOOST,
  ascensionsFor, boostedDates, computeAchievements, masteryFor, nextTierFor, nightParts,
  todayISO, xpBreakdown, xpForLevel, xpLevel, xpToNextLevel, MAX_LEVEL, XP_FOR_MAX_LEVEL,
} from '@/lib/gamify';

/** The window Momentum is measured over. 30 days: long enough that one bad
 *  night doesn't swing it, short enough to still feel like "right now". */
export const MOMENTUM_WINDOW = 30;

/** 1.00× — you logged the night and did nothing else. Every point above this
 *  is quality, an early bedtime, or God Mode. */
export const BASELINE_XP_PER_DAY = BASE_XP_PER_LOG;

export interface MomentumPart {
  key: 'base' | 'quality' | 'earlyBird' | 'god' | 'mastery' | 'ascension';
  label: string;
  xp: number;
  color: string;
}

export interface Momentum {
  /** Nights logged inside the window. */
  nights: number;
  /** Recurring XP earned in the window (no one-time lumps). */
  recurXP: number;
  /** Recurring XP per CALENDAR day — missed nights drag this down, by design. */
  perDay: number;
  /** perDay ÷ baseline. The headline. */
  multiplier: number;
  /** Same, for the window before this one. null when there's no history yet. */
  prevMultiplier: number | null;
  /** Where the recurring XP came from. Sums to recurXP. */
  parts: MomentumPart[];

  /** Your badge multiplier right now (0.35 = +35% on every night, forever). */
  mastery: number;
  /** Streak-milestone XP banked in the window — the only one-time lump left. */
  oneOffXP: number;
  /** Badge tiers still unclaimed — how much Mastery is still on the table. */
  tiersLeft: number;
  tiersTotal: number;

  /** Observed total rate, incl. one-offs — what the projections below use. */
  realizedPerDay: number;
  level: number;
  /** True at Lv 46 — the cap. Nothing left to climb. */
  maxed: boolean;
  /** XP still owed to the Lv 46 cap — the finish line. */
  xpToMax: number;
  daysToMax: number | null;
  xpToLevel: number;
  daysToLevel: number | null;
  nextTier: Tier | null;
  xpToTier: number | null;
  daysToTier: number | null;
  hasData: boolean;
}

const DAY_MS = 86400000;
const dayNum = (d: string) => Math.round(new Date(d + 'T12:00:00').getTime() / DAY_MS);

const PART_META: Record<MomentumPart['key'], { label: string; color: string }> = {
  base:      { label: 'loguri',          color: '#64748b' }, // slate-500
  quality:   { label: 'calitate somn',   color: '#4ade80' }, // green-400
  earlyBird: { label: 'culcare devreme', color: '#60a5fa' }, // blue-400
  god:       { label: 'God Mode',        color: '#fbbf24' }, // amber-400
  mastery:   { label: 'măiestrie (badge-uri)', color: '#a3e635' }, // lime-400
  ascension: { label: 'Ascensiune',      color: '#f472b6' }, // pink-400
};

/** Recurring XP for one person over a [from, to) window of day-numbers.
 *
 *  Ascension counts as rate, not as a lump: unlike a badge tier it is earned by
 *  a night and can be earned again. It is spiky by nature — one flawless night
 *  is an entire level — which is exactly why it gets its own segment instead of
 *  being blended invisibly into the headline. */
function recurringIn(
  mine: SleepEntry[], boosted: Set<string>, ascByDate: Map<string, number>, mastery: number,
  from: number, to: number,
): { xp: number; nights: number; base: number; quality: number; earlyBird: number; god: number; mastery: number; ascension: number } {
  let base = 0, quality = 0, earlyBird = 0, god = 0, ascension = 0, nights = 0;
  for (const e of mine) {
    const age = to - dayNum(e.date);       // 0 = most recent day of the window
    if (age < 0 || age >= to - from) continue;
    const p = nightParts(e);
    base += p.base;
    quality += p.quality;
    earlyBird += p.earlyBird;
    if (boosted.has(e.date)) god += p.total * GOD_BOOST;
    ascension += ascByDate.get(e.date) ?? 0;
    nights++;
  }
  god = Math.round(god);
  // Mastery is a % on the night XP — a real, permanent part of the rate.
  const masteryXP = Math.round((base + quality + earlyBird + god) * mastery);
  return {
    xp: base + quality + earlyBird + god + masteryXP + ascension,
    nights, base, quality, earlyBird, god, mastery: masteryXP, ascension,
  };
}

export function momentumFor(
  data: SleepEntry[], name: string, windowDays: number = MOMENTUM_WINDOW,
): Momentum {
  const mine = data.filter(d => d.name === name);
  const today = dayNum(todayISO());
  const boosted = boostedDates(data, name);
  const ascByDate = ascensionsFor(data, name);
  const mastery = masteryFor(data, name);

  const cur = recurringIn(mine, boosted, ascByDate, mastery, today - windowDays, today);
  const prev = recurringIn(mine, boosted, ascByDate, mastery, today - 2 * windowDays, today - windowDays);

  const perDay = cur.xp / windowDays;
  const multiplier = perDay / BASELINE_XP_PER_DAY;
  const prevMultiplier = prev.nights > 0 ? (prev.xp / windowDays) / BASELINE_XP_PER_DAY : null;

  const parts: MomentumPart[] = (['base', 'quality', 'earlyBird', 'god', 'mastery', 'ascension'] as const)
    .map(key => ({ key, xp: cur[key], ...PART_META[key] }))
    .filter(p => p.xp > 0);

  // The only lump left: streak milestones. Diff them against a history where
  // this window's nights were never logged.
  const bd = xpBreakdown(data, name);
  const withoutWindow = data.filter(e => e.name !== name || today - dayNum(e.date) >= windowDays);
  const bdBefore = xpBreakdown(withoutWindow, name);
  const oneOffXP = Math.max(0, bd.streakBonus - bdBefore.streakBonus);

  const progress = computeAchievements(data, name);
  const tiersTotal = ACHIEVEMENTS.length * 4;
  const tiersLeft = tiersTotal - progress.reduce((s, p) => s + p.tiersReached, 0);

  const realizedPerDay = (cur.xp + oneOffXP) / windowDays;
  const level = xpLevel(bd.total);
  const maxed = level >= MAX_LEVEL;
  const xpToMax = Math.max(0, XP_FOR_MAX_LEVEL - bd.total);
  const xpToLevel = maxed ? 0 : xpToNextLevel(level) - (bd.total - xpForLevel(level));
  const nextTier = nextTierFor(level);
  const xpToTier = nextTier ? Math.max(0, xpForLevel(nextTier.minLevel) - bd.total) : null;
  const days = (xp: number) => (realizedPerDay > 0 && xp > 0 ? Math.ceil(xp / realizedPerDay) : null);

  return {
    nights: cur.nights,
    recurXP: cur.xp,
    perDay,
    multiplier,
    prevMultiplier,
    parts,
    mastery,
    oneOffXP,
    tiersLeft,
    tiersTotal,
    realizedPerDay,
    level,
    maxed,
    xpToMax,
    daysToMax: days(xpToMax),
    xpToLevel,
    daysToLevel: days(xpToLevel),
    nextTier,
    xpToTier,
    daysToTier: xpToTier != null ? days(xpToTier) : null,
    hasData: cur.nights > 0,
  };
}

/** Colour for a momentum multiplier — dim under baseline, hot when flying. */
export function momentumColor(m: number): string {
  if (m >= 5) return '#fbbf24';   // amber — elite
  if (m >= 3) return '#a3e635';   // lime
  if (m >= 1.5) return '#4ade80'; // green
  if (m >= 1) return '#60a5fa';   // blue — holding the line
  return '#f97316';               // orange — slipping below "just log it"
}

/** One honest sentence about the current rate. */
export function momentumVerdict(m: Momentum): string {
  if (!m.hasData) return 'Niciun log în ultimele 30 de zile — momentum zero.';
  if (m.multiplier < 1) return 'Sub linia de bază: nopțile nelogate îți mănâncă ritmul.';
  if (m.multiplier < 1.5) return 'Loghezi constant, dar calitatea nu adaugă mult peste bază.';
  if (m.multiplier < 3) return 'Ritm sănătos — nopțile bune se văd în viteză.';
  if (m.multiplier < 5) return 'Ritm foarte bun. Puțini țin asta luni la rând.';
  return 'Zbori. God Mode și nopțile de top îți compun XP-ul.';
}

/** The ceiling of the *sustainable* engine: 95+ every night, early to bed, God
 *  Mode permanently on. Ascension sits deliberately outside this scale — a
 *  flawless night is a whole level, which no fixed multiplier can express. */
export const MOMENTUM_CEILING = ((BASE_XP_PER_LOG + 150 + 5) * (1 + GOD_BOOST)) / BASELINE_XP_PER_DAY;
