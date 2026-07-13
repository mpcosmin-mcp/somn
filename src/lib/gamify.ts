/* ─────────────────────────────────────────────────────────
   Gamification engine — XP economy, achievements, tiers, streaks.

   XP = logs × 10 + SS band bonus + early bird + streak milestones
        + achievement-tier unlocks, all × God Mode boost.

   Achievements are Garmin-style: personal, cumulative, repeatable.
   Everyone earns their own — no zero-sum "best-at" gating. Thresholds
   that depend on physiology (RHR) are calibrated per person's sex, so
   the same relative fitness earns the same badge.
   ───────────────────────────────────────────────────────── */
import {
  type SleepEntry, bedtimeFrom18, sleepDurationMin, personSex, rhrCutoffs,
} from '@/lib/sleep';

/* ─── Level curve ───
 *
 * Levelling used to cost a flat 100 XP forever, which made the ladder
 * meaningless: one perfect night jumped you 5 levels and a steady logger
 * blew past the top tier inside a year. Now each level costs more than the
 * last, so the ladder paces a multi-year climb.
 *
 *   cost(L → L+1) = LEVEL_BASE + LEVEL_STEP × (L − 1)
 *   totalFor(L)   = Σ cost(1..L−1)
 */
export const LEVEL_BASE = 100;
export const LEVEL_STEP = 25;

/** Cumulative XP required to BE at `level`. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return LEVEL_BASE * n + (LEVEL_STEP * n * (n - 1)) / 2;
}

/** XP cost of the single step `level` → `level + 1`. */
export function xpToNextLevel(level: number): number {
  return LEVEL_BASE + LEVEL_STEP * (Math.max(1, level) - 1);
}

export function xpLevel(xp: number): number {
  if (xp <= 0) return 1;
  // Invert totalFor(L) ≤ xp analytically, then correct for float drift.
  const a = LEVEL_STEP / 2;
  const b = LEVEL_BASE - LEVEL_STEP / 2;
  let n = Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a));
  while (xpForLevel(n + 2) <= xp) n++;
  while (n > 0 && xpForLevel(n + 1) > xp) n--;
  return n + 1;
}

export interface LevelProgress {
  level: number;
  into: number;   // XP earned inside the current level
  need: number;   // XP the current level costs in total
  pct: number;    // 0–100
}

/** Everything the UI needs to draw an XP bar. */
export function levelProgress(xp: number): LevelProgress {
  const level = xpLevel(xp);
  const need = xpToNextLevel(level);
  const into = Math.max(0, xp - xpForLevel(level));
  return { level, into, need, pct: need ? Math.min(100, (into / need) * 100) : 0 };
}

/* ─── Streaks ───
 * Extended past 30 days: for a daily tracker, the long unbroken run is the
 * single behaviour most worth paying for. Awarded once, on the best run ever.
 */
export const STREAK_MILESTONES = [
  { days: 7, bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 200 },
  { days: 60, bonus: 350 },
  { days: 100, bonus: 600 },
  { days: 365, bonus: 2000 },
] as const;

export const EARLY_BIRD_CUTOFF = 300; // 23:00 = 300 min past 18:00
export const EARLY_BIRD_XP = 5;
export const BASE_XP_PER_LOG = 10;

/* ─── Achievement system ───
 *
 * Each achievement is a repeatable metric with tiered thresholds.
 * Awarded XP is FLAT per tier crossed — no per-event double-count with
 * the base/quality bonuses. Reaching a tier gives its `xp` bonus once;
 * the total for a badge is the sum of all reached tiers.
 *
 * `count` receives the person's name so physiological thresholds can be
 * calibrated per sex — a woman's resting heart rate sits ~5 bpm above a
 * man's at identical fitness, so a unisex "RHR < 55" badge silently
 * priced Clara out of it. `description` is the long-form text the badge
 * detail modal shows; `hint` stays the one-line grid caption.
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
  name: string;         // Romanian display name
  hint: string;         // one-line caption — may depend on the person (RHR)
  description: string;  // long-form explainer for the detail modal
  tiers: AchievementTier[];
  count: (data: SleepEntry[], name: string) => number;
  /** Per-person caption when the threshold is calibrated (e.g. RHR by sex). */
  hintFor?: (name: string) => string;
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

/** The "elite" RHR cutoff for this person — 55 bpm for men, 60 for women. */
export function eliteRhrFor(name: string): number {
  return rhrCutoffs(personSex(name))[0];
}

/** Median bedtime (minutes past 18:00) across the person's logged nights. */
function medianBedtime(data: SleepEntry[]): number | null {
  const bts = data.map(e => bedtimeFrom18(e.start)).filter((v): v is number => v != null).sort((a, b) => a - b);
  if (bts.length < 5) return null;   // not enough history to have a "usual" hour
  const mid = Math.floor(bts.length / 2);
  return bts.length % 2 ? bts[mid] : Math.round((bts[mid - 1] + bts[mid]) / 2);
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'logger',
    icon: '📝',
    name: 'Logger',
    hint: 'nopți logate',
    description: 'Se numără fiecare noapte pe care o loghezi, indiferent de scor. Cel mai simplu badge din joc — apari, notezi, crește. Consistența bate perfecțiunea.',
    tiers: ladder(10, 30, 100, 250),
    count: (data) => data.length,
  },
  {
    id: 'god-mode',
    icon: '💯',
    name: 'God Mode',
    hint: 'nopți cu SS ≥ 95',
    description: 'O noapte cu Sleep Score ≥ 95 e o noapte impecabilă: pornește God Mode (+20% XP pentru 7 zile) și îți dă cel mai mare bonus per noapte din joc. Rar și scump — exact ce trebuie să fie.',
    tiers: ladder(1, 3, 7, 15),
    count: (data) => data.filter(e => e.ss >= 95).length,
  },
  {
    id: 'near-perfect',
    icon: '👑',
    name: 'Aproape Perfect',
    hint: 'nopți cu SS ≥ 90',
    description: 'Nopțile de 90+ sunt vârful realist: rare, dar accesibile dacă îți respecți orarul. Aduc un bonus solid și te apropie de pragul God Mode.',
    tiers: ladder(1, 5, 15, 40),
    count: (data) => data.filter(e => e.ss >= 90).length,
  },
  {
    id: 'elite',
    icon: '🌟',
    name: 'Noapte Elită',
    hint: 'nopți cu SS ≥ 85',
    description: 'Peste 85 înseamnă că ai dormit clar peste target. Un obiectiv săptămânal sănătos — nu o loterie.',
    tiers: ladder(3, 12, 35, 90),
    count: (data) => data.filter(e => e.ss >= 85).length,
  },
  {
    id: 'great',
    icon: '✨',
    name: 'Noapte Bună',
    hint: 'nopți cu SS ≥ 80',
    description: 'Pragul de bază al unei nopți bune. Aici se câștigă războiul pe termen lung: multe nopți de 80 bat două nopți de 95 urmate de o săptămână proastă.',
    tiers: ladder(5, 20, 60, 150),
    count: (data) => data.filter(e => e.ss >= 80).length,
  },
  {
    id: 'early-bird',
    icon: '🌙',
    name: 'Ciocârlie',
    hint: 'nopți culcare < 23:00',
    description: 'Culcarea înainte de 23:00 prinde primele cicluri de somn profund, cele mai reparatoare ale nopții. Fiecare astfel de noapte îți dă și +5 XP direct.',
    tiers: ladder(5, 15, 40, 100),
    count: (data) => data.filter(e => {
      const bt = bedtimeFrom18(e.start);
      return bt != null && bt < EARLY_BIRD_CUTOFF;
    }).length,
  },
  {
    id: 'metronome',
    icon: '⏱️',
    name: 'Metronom',
    hint: 'nopți la ora ta obișnuită (±30m)',
    description: 'Se numără nopțile în care te-ai culcat la maximum 30 de minute de ora ta mediană. Regularitatea orarului e cel mai bun predictor al calității somnului — mai bun decât durata. Se activează după 5 nopți cu ore notate.',
    tiers: ladder(5, 20, 60, 150),
    count: (data) => {
      const med = medianBedtime(data);
      if (med == null) return 0;
      return data.filter(e => {
        const bt = bedtimeFrom18(e.start);
        return bt != null && Math.abs(bt - med) <= 30;
      }).length;
    },
  },
  {
    id: 'long-sleep',
    icon: '💤',
    name: 'Somn Lung',
    hint: 'nopți ≥ 8h somn',
    description: 'Opt ore reale de somn, nu opt ore în pat. Se calculează din ora de culcare și ora de trezire pe care le notezi.',
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
    description: 'REM-ul e faza în care creierul consolidează memoria și procesează emoțional ziua. 90 de minute e targetul; alcoolul și culcarea târzie îl taie primul.',
    tiers: ladder(3, 10, 25, 60),
    count: (data) => data.filter(e => e.rem != null && e.rem >= 90).length,
  },
  {
    id: 'low-rhr',
    icon: '🫀',
    name: 'Puls Odihnit',
    hint: 'nopți cu puls de repaus elită',
    description: 'Pulsul de repaus scăzut arată recuperare bună și stres cardiovascular mic. Pragul e calibrat pe sex — femeile au un RHR bazal mai mare cu ~5 bpm la aceeași condiție fizică, deci pragul lor e < 60, al bărbaților < 55. Aceeași formă fizică, același badge.',
    hintFor: (name) => `nopți cu RHR < ${eliteRhrFor(name)}`,
    tiers: ladder(3, 10, 25, 60),
    count: (data, name) => {
      const elite = eliteRhrFor(name);
      return data.filter(e => e.rhr > 0 && e.rhr < elite).length;
    },
  },
  {
    id: 'high-hrv',
    icon: '⚡',
    name: 'HRV Elită',
    hint: 'nopți cu HRV ≥ 60',
    description: 'Variabilitatea ritmului cardiac măsoară cât de bine îți comută sistemul nervos pe „odihnă". HRV mare = recuperare bună. Scade la stres, alcool și antrenamente grele.',
    tiers: ladder(3, 10, 25, 60),
    count: (data) => data.filter(e => e.hrv != null && e.hrv >= 60).length,
  },
  {
    id: 'journaler',
    icon: '📓',
    name: 'Jurnalist',
    hint: 'nopți cu jurnal scris',
    description: 'Notează ce ai făcut înainte de culcare. Peste câteva săptămâni, jurnalul e singurul lucru care îți explică DE CE a fost o noapte bună sau proastă — cifrele singure nu spun asta.',
    tiers: ladder(3, 10, 30, 80),
    count: (data) => data.filter(e => e.journal && e.journal.trim().length > 0).length,
  },
];

/** The caption to show for a badge, resolved for a specific person. */
export function achievementHint(a: Achievement, name: string): string {
  return a.hintFor ? a.hintFor(name) : a.hint;
}

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
    const c = a.count(mine, name);
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
 *  Non-double-counting: tier XP is a flat first-unlock bonus, orthogonal to
 *  the per-night band bonuses paid in `xpBreakdown`. */
export function achievementsXP(data: SleepEntry[], name: string): number {
  return computeAchievements(data, name).reduce((s, p) => s + p.xpEarned, 0);
}

/* ─── God Mode ───
 *
 * Trigger recalibrated 2026-07-13. It used to require SS = 100, which the
 * team's devices never produce — across 97 logged nights nobody had ever
 * scored 95+, so the whole mechanic (and its +500 jackpot) was dead content.
 * The trigger is now SS ≥ 95: rare, but reachable.
 *
 * A God night turns on GOD MODE for the next 7 days: every night logged in
 * that window earns +20% XP. Logging another God night refreshes the window.
 * The trigger night itself is not boosted — it already banks the big flat
 * bonus. Overlapping windows do NOT stack (the boost is applied once).
 */
export const GOD_TRIGGER_SS = 95;    // the score that opens a God window
export const GOD_WINDOW_DAYS = 7;
export const GOD_BOOST = 0.20;       // +20% XP inside the window

/* Per-night flat SS bonus (exclusive bands).
 *
 * Rebalanced against the real score distribution: 90+ is a ~5% event for this
 * team and used to pay a laughable +10, while the never-occurring 100 paid
 * +500 and single-handedly dominated the economy. The curve is now steep but
 * bounded, so one lucky night can't erase a month of consistency. */
export const SS_BANDS = [
  { min: 100, xp: 300, icon: '💯', label: 'Perfect'          },
  { min: 95,  xp: 150, icon: '⚡', label: 'God Mode'         },
  { min: 90,  xp: 60,  icon: '👑', label: 'Aproape perfect'  },
  { min: 85,  xp: 25,  icon: '🌟', label: 'Noapte elită'     },
  { min: 80,  xp: 10,  icon: '✨', label: 'Noapte bună'      },
] as const;

/** Per-night flat SS bonus (exclusive bands). */
export function ssBandBonus(ss: number): number {
  for (const b of SS_BANDS) if (ss >= b.min) return b.xp;
  return 0;
}

const DAY_MS = 86400000;
const dayNum = (d: string) => Math.round(new Date(d + 'T12:00:00').getTime() / DAY_MS);

/** The RECURRING XP a single night pays, split by source.
 *
 *  This is the engine's one definition of "what a night is worth" — the XP
 *  breakdown and the Momentum meter both read it, so the headline rate can
 *  never drift from the XP actually banked.
 *
 *  Deliberately excludes badge tiers and streak milestones: those are one-time
 *  unlocks, not a rate. Folding them in would inflate a "speed" number that
 *  then silently decays as the tiers run out. */
export function nightParts(e: SleepEntry): { base: number; quality: number; earlyBird: number; total: number } {
  const bt = bedtimeFrom18(e.start);
  const base = BASE_XP_PER_LOG;
  const quality = ssBandBonus(e.ss);
  const earlyBird = bt != null && bt < EARLY_BIRD_CUTOFF ? EARLY_BIRD_XP : 0;
  return { base, quality, earlyBird, total: base + quality + earlyBird };
}

/** The dates on which this person's nights are God-boosted (+20%) — i.e. that
 *  fall 1..7 days after one of their own God nights. */
export function boostedDates(data: SleepEntry[], name: string): Set<string> {
  const mine = data.filter(d => d.name === name);
  const godDays = new Set(mine.filter(e => e.ss >= GOD_TRIGGER_SS).map(e => dayNum(e.date)));
  const out = new Set<string>();
  if (!godDays.size) return out;
  for (const e of mine) {
    const t = dayNum(e.date);
    for (let back = 1; back <= GOD_WINDOW_DAYS; back++) {
      if (godDays.has(t - back)) { out.add(e.date); break; }
    }
  }
  return out;
}

/** Today as YYYY-MM-DD in LOCAL time. `toISOString()` would report the UTC day,
 *  which is the previous calendar day between 00:00 and 03:00 in Romania — that
 *  made streaks and God windows look a day off overnight. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Is God Mode active for this user RIGHT NOW, and how many days remain?
 *  Active while today is within GOD_WINDOW_DAYS of a logged God night. */
export function godMode(data: SleepEntry[], name: string): { active: boolean; daysLeft: number } {
  const today = dayNum(todayISO());
  let daysLeft = 0;
  for (const e of data) {
    if (e.name !== name || e.ss < GOD_TRIGGER_SS) continue;
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
  count85: number;
  bonus85: number;
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
  const base = logs * BASE_XP_PER_LOG;

  // Set-based: a linear scan per night turned quadratic when most nights were
  // God nights (15k entries went from 1.2s to 0.2s).
  const boosted = boostedDates(data, name);

  let count100 = 0, count95 = 0, count90 = 0, count85 = 0, count80 = 0, earlyBirdCount = 0;
  let godBoost = 0;
  for (const e of entries) {
    if (e.ss >= 100) count100++;
    else if (e.ss >= 95) count95++;
    else if (e.ss >= 90) count90++;
    else if (e.ss >= 85) count85++;
    else if (e.ss >= 80) count80++;

    const parts = nightParts(e);
    if (parts.earlyBird) earlyBirdCount++;
    if (boosted.has(e.date)) godBoost += parts.total * GOD_BOOST;
  }
  godBoost = Math.round(godBoost);
  const earlyBirdBonus = earlyBirdCount * EARLY_BIRD_XP;
  const bonus100 = count100 * 300;
  const bonus95 = count95 * 150;
  const bonus90 = count90 * 60;
  const bonus85 = count85 * 25;
  const bonus80 = count80 * 10;

  const { active: godActive, daysLeft: godDaysLeft } = godMode(data, name);

  const streakMax = maxStreakFor(data, name);
  let streakBonus = 0;
  for (const m of STREAK_MILESTONES) {
    if (streakMax >= m.days) streakBonus += m.bonus;
  }

  const achievements = computeAchievements(data, name);
  const achievementsCount = achievements.reduce((s, p) => s + p.tiersReached, 0);
  const achievementsBonus = achievements.reduce((s, p) => s + p.xpEarned, 0);

  const total = base + bonus100 + bonus95 + bonus90 + bonus85 + bonus80
    + earlyBirdBonus + godBoost + streakBonus + achievementsBonus;

  return {
    logs, base,
    count100, bonus100,
    count95, bonus95,
    count90, bonus90,
    count85, bonus85,
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

/* Tier system — 10 paliere, cu descrieri pentru modalul de detaliu.
 *
 * minLevel-urile au fost re-scalate odată cu curba de nivel (2026-07-13):
 * pe curba veche, plată, oricine loga constant trecea de „Zeu" într-un an.
 * Acum Zeu (Lv 50) cere ~34.000 XP — un obiectiv de câțiva ani. */
export interface Tier {
  name: string;
  color: string;
  icon: string;
  minLevel: number;
  blurb: string;
}

export const TIERS: Tier[] = [
  { name: 'Somnoros',           color: '#a1a1aa', icon: '·', minLevel: 1,  blurb: 'Ai deschis aplicația. E un început.' },
  { name: 'Visător',            color: '#94a3b8', icon: '˚', minLevel: 5,  blurb: 'Loghezi constant. Datele încep să spună ceva.' },
  { name: 'Somnambul',          color: '#60a5fa', icon: '◆', minLevel: 10, blurb: 'Ai un obicei, nu un experiment.' },
  { name: 'Ursulețul de Pat',   color: '#a78bfa', icon: '◇', minLevel: 15, blurb: 'Nopțile bune nu mai sunt accident.' },
  { name: 'Guru de Pernă',      color: '#c084fc', icon: '★', minLevel: 20, blurb: 'Îți știi tiparele mai bine decât ceasul.' },
  { name: 'Maestru al Nopții',  color: '#a3e635', icon: '☾', minLevel: 26, blurb: 'Orar de fier. Scoruri pe măsură.' },
  { name: 'Sensei REM',         color: '#facc15', icon: '❈', minLevel: 32, blurb: 'Somnul tău e o disciplină, nu o întâmplare.' },
  { name: 'Legendă a Somnului', color: '#fb923c', icon: '✦', minLevel: 38, blurb: 'Ani de consistență. Se vede.' },
  { name: 'Semizeu Hipnos',     color: '#f472b6', icon: '❋', minLevel: 44, blurb: 'Aproape nimeni nu ajunge aici.' },
  { name: 'Zeu al Somnului',    color: '#22d3ee', icon: '✺', minLevel: 50, blurb: 'Vârful. Nu mai ai ce demonstra nimănui.' },
];

export function tierFor(level: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (level >= TIERS[i].minLevel) return TIERS[i];
  }
  return TIERS[0];
}

/** The next tier up from `level`, or null at the top. */
export function nextTierFor(level: number): Tier | null {
  return TIERS.find(t => t.minLevel > level) ?? null;
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
