/* ─────────────────────────────────────────────────────────
   sleep tracker v2 — core types + color helpers
   REM is now first-class, alongside SS/RHR/HRV.
   ───────────────────────────────────────────────────────── */

export interface SleepEntry {
  date: string;            // YYYY-MM-DD (sleep date = night before wake)
  name: string;
  ss: number;              // sleep score 0-100
  rhr: number;             // resting heart rate, bpm
  hrv: number | null;      // heart rate variability, ms
  rem: number | null;      // REM minutes (NEW in v2)
  journal: string | null;  // free-form daily note (NEW in v2)
  start?: string | null;   // bedtime "HH:MM" (NEW v3 — optional; absent on older logs)
  end?: string | null;     // wake time "HH:MM" (NEW v3)
}

export interface AggEntry {
  name: string;
  ss: number;
  rhr: number;
  hrv: number | null;
  rem: number | null;
  entries: number;
}

/* Team — 3 known people, fixed for now */
export const NAMES = ['Clara-Ileana Cirpatorea', 'Petrica Cosmin Moga', 'Cornel-Gabriel Meleru'] as const;
export type Name = typeof NAMES[number];

export const FIRST_NAME: Record<string, string> = {
  'Clara-Ileana Cirpatorea': 'Clara',
  'Petrica Cosmin Moga': 'Petrica',
  'Cornel-Gabriel Meleru': 'Gabi',
};

export const PERSON_COLOR: Record<string, string> = {
  'Clara-Ileana Cirpatorea': '#f472b6',  // pink-400
  'Petrica Cosmin Moga': '#60a5fa',      // blue-400
  'Cornel-Gabriel Meleru': '#34d399',    // emerald-400
};

export function personColor(name: string): string {
  return PERSON_COLOR[name] ?? '#a1a1aa';
}

/* Biological sex — calibrates HR thresholds. Women run a higher RHR baseline
 * than men by ~3-7 bpm, so their "good" bands sit ~5 bpm higher. Age/fitness
 * matter more long-term; a personal-baseline model would supersede this. */
export type Sex = 'F' | 'M';
export const PERSON_SEX: Record<string, Sex> = {
  'Clara-Ileana Cirpatorea': 'F',
  'Petrica Cosmin Moga': 'M',
  'Cornel-Gabriel Meleru': 'M',
};
export function personSex(name: string): Sex {
  return PERSON_SEX[name] ?? 'M';
}

/** RHR band cutoffs [elite, good, under] by sex — women shifted +5 bpm. */
export function rhrCutoffs(sex: Sex = 'M'): [number, number, number] {
  return sex === 'F' ? [60, 65, 75] : [55, 60, 70];
}

/* ── Color scales ──
 *
 * BINARY semantic: above target → GREEN, below target → RED.
 *
 * Four tiers per metric (no in-between amber):
 *   ELITE  → emerald-500    #10b981   (well above target)
 *   GOOD   → green-400      #4ade80   (above/at target)
 *   UNDER  → orange-500     #f97316   (below target — orange-red)
 *   BAD    → red-500        #ef4444   (way below target — pure red)
 *
 * "Sub target = roșu" — instant gut check.
 */

const C = {
  elite: '#10b981',
  good:  '#4ade80',
  under: '#f97316',
  bad:   '#ef4444',
  dim:   '#52525b',
} as const;

/** Sleep Score (higher is better). Target ≥75. */
export function ssColor(ss: number): string {
  if (ss >= 85) return C.elite;
  if (ss >= 75) return C.good;
  if (ss >= 60) return C.under;
  return C.bad;
}

/** RHR (LOWER is better). Sex-aware — women's bands sit ~5 bpm higher. */
export function rhrColor(rhr: number, sex: Sex = 'M'): string {
  const [elite, good, under] = rhrCutoffs(sex);
  if (rhr < elite) return C.elite;
  if (rhr < good) return C.good;
  if (rhr < under) return C.under;
  return C.bad;
}

/** HRV (higher is better). Target ≥45. */
export function hrvColor(hrv: number | null): string {
  if (hrv == null) return C.dim;
  if (hrv >= 60) return C.elite;
  if (hrv >= 45) return C.good;
  if (hrv >= 30) return C.under;
  return C.bad;
}

/** REM minutes (higher is better). Target ≥90. */
export function remColor(rem: number | null): string {
  if (rem == null) return C.dim;
  if (rem >= 110) return C.elite;
  if (rem >= 90) return C.good;
  if (rem >= 70) return C.under;
  return C.bad;
}

/* ── Tier labels (for the bottom-of-metric chip) ── */

export function ssTier(ss: number): { label: string; color: string } {
  if (ss >= 85) return { label: 'Excelent', color: C.elite };
  if (ss >= 75) return { label: 'Bun', color: C.good };
  if (ss >= 60) return { label: 'Sub target', color: C.under };
  return { label: 'Slab', color: C.bad };
}

export function rhrTier(rhr: number, sex: Sex = 'M'): { label: string; color: string } {
  const [elite, good, under] = rhrCutoffs(sex);
  if (rhr < elite) return { label: 'Excelent', color: C.elite };
  if (rhr < good) return { label: 'Bun', color: C.good };
  if (rhr < under) return { label: 'Peste target', color: C.under };
  return { label: 'Slab', color: C.bad };
}

export function hrvTier(hrv: number | null): { label: string; color: string } {
  if (hrv == null) return { label: '—', color: C.dim };
  if (hrv >= 60) return { label: 'Excelent', color: C.elite };
  if (hrv >= 45) return { label: 'Bun', color: C.good };
  if (hrv >= 30) return { label: 'Sub target', color: C.under };
  return { label: 'Slab', color: C.bad };
}

export function remTier(rem: number | null): { label: string; color: string } {
  if (rem == null) return { label: '—', color: C.dim };
  if (rem >= 110) return { label: 'Excelent', color: C.elite };
  if (rem >= 90) return { label: 'Bun', color: C.good };
  if (rem >= 70) return { label: 'Sub target', color: C.under };
  return { label: 'Slab', color: C.bad };
}

/* ── Target indicators for at-a-glance status ── */

export interface MetricStatus {
  /** ↑ above target, ↓ below target, → on target */
  arrow: '↑' | '↓' | '→';
  /** "+N peste" / "-N sub" / "în target" */
  label: string;
  /** Color matches metric tier */
  color: string;
}

export function ssStatus(ss: number): MetricStatus {
  const c = ssColor(ss);
  const delta = ss - 75;
  if (delta > 5) return { arrow: '↑', label: `+${delta} peste target`, color: c };
  if (delta < -5) return { arrow: '↓', label: `${delta} sub target`, color: c };
  return { arrow: '→', label: 'aproape de target', color: c };
}

export function rhrStatus(rhr: number, sex: Sex = 'M'): MetricStatus {
  const c = rhrColor(rhr, sex);
  const target = rhrCutoffs(sex)[1];   // 60 (M) / 65 (F)
  const delta = target - rhr;          // higher = better since RHR lower is better
  if (delta > 3) return { arrow: '↓', label: `${rhr - target} sub target`, color: c };
  if (delta < -3) return { arrow: '↑', label: `+${rhr - target} peste target`, color: c };
  return { arrow: '→', label: 'aproape de target', color: c };
}

export function hrvStatus(hrv: number | null): MetricStatus {
  if (hrv == null) return { arrow: '→', label: '—', color: C.dim };
  const c = hrvColor(hrv);
  const delta = hrv - 45;
  if (delta > 5) return { arrow: '↑', label: `+${delta} peste target`, color: c };
  if (delta < -5) return { arrow: '↓', label: `${delta} sub target`, color: c };
  return { arrow: '→', label: 'aproape de target', color: c };
}

export function remStatus(rem: number | null): MetricStatus {
  if (rem == null) return { arrow: '→', label: '—', color: C.dim };
  const c = remColor(rem);
  const delta = rem - 90;
  if (delta > 5) return { arrow: '↑', label: `+${delta}min peste target`, color: c };
  if (delta < -5) return { arrow: '↓', label: `${delta}min sub target`, color: c };
  return { arrow: '→', label: 'aproape de target', color: c };
}

/* ── Aggregation ── */

/** Aggregate entries by person — returns one row per name, sorted by avg SS desc */
export function aggregate(entries: SleepEntry[]): AggEntry[] {
  const byName = new Map<string, { ssSum: number; rhrSum: number; hrvSum: number; hrvN: number; remSum: number; remN: number; n: number }>();
  for (const e of entries) {
    const cur = byName.get(e.name) ?? { ssSum: 0, rhrSum: 0, hrvSum: 0, hrvN: 0, remSum: 0, remN: 0, n: 0 };
    cur.ssSum += e.ss;
    cur.rhrSum += e.rhr;
    if (e.hrv != null) { cur.hrvSum += e.hrv; cur.hrvN++; }
    if (e.rem != null) { cur.remSum += e.rem; cur.remN++; }
    cur.n++;
    byName.set(e.name, cur);
  }
  const rows: AggEntry[] = [];
  for (const [name, v] of byName) {
    rows.push({
      name,
      ss: Math.round(v.ssSum / v.n),
      rhr: Math.round(v.rhrSum / v.n),
      hrv: v.hrvN ? Math.round(v.hrvSum / v.hrvN) : null,
      rem: v.remN ? Math.round(v.remSum / v.remN) : null,
      entries: v.n,
    });
  }
  rows.sort((a, b) => b.ss - a.ss);
  return rows;
}

/** Filter to last N days from today */
export function lastNDays(entries: SleepEntry[], n: number, from: Date = new Date()): SleepEntry[] {
  const cutoff = new Date(from); cutoff.setDate(cutoff.getDate() - n);
  const cutStr = cutoff.toISOString().split('T')[0];
  return entries.filter(e => e.date >= cutStr);
}

/* ── Sleep timing (bedtime / wake / duration) — NEW v3 ──
 * Times are "HH:MM" 24h strings. Everything tolerates null/undefined so older
 * logs (which have no times) and partial input degrade cleanly.
 */

/** Parse "HH:MM" → minutes since 00:00, or null if missing/invalid. */
export function hhmmToMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/** Minutes slept from bedtime→wake. Adds a day when the clock wraps past
 *  midnight (e.g. 22:36 → 07:25 = 529 min). null if either time is missing. */
export function sleepDurationMin(start?: string | null, end?: string | null): number | null {
  const s = hhmmToMin(start), e = hhmmToMin(end);
  if (s == null || e == null) return null;
  let d = e - s;
  if (d <= 0) d += 24 * 60;
  return d;
}

/** "8h 49m" / "7h" / "40m" / "—". Rounds, so fractional inputs (chart ticks) stay clean. */
export function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  const total = Math.round(min);
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Color for a sleep duration (minutes). Ideal band 7-9h. */
export function durationColor(min: number | null): string {
  if (min == null) return C.dim;
  if (min < 360) return C.bad;     // < 6h
  if (min < 420) return C.under;   // 6–7h
  if (min <= 540) return C.good;   // 7–9h sweet spot
  return C.under;                  // > 9h (oversleep)
}

/** Sleep-duration target — first-class with the other metrics. 8h. */
export const DUR_TARGET = 480;

/** Tier label + color for sleep duration (mirror of ssTier/remTier/etc). */
export function durTier(min: number | null): { label: string; color: string } {
  if (min == null) return { label: '—', color: C.dim };
  if (min < 360) return { label: 'Slab', color: C.bad };
  if (min < 420) return { label: 'Sub target', color: C.under };
  if (min <= 540) return { label: 'Bun', color: C.good };
  return { label: 'Oversleep', color: C.under };
}

/** Above-/below-target status (mirror of ssStatus/etc). */
export function durStatus(min: number | null): MetricStatus {
  if (min == null) return { arrow: '→', label: '—', color: C.dim };
  const c = durationColor(min);
  const delta = min - DUR_TARGET;
  if (Math.abs(delta) < 15) return { arrow: '→', label: 'aproape de target', color: c };
  if (delta > 0) return { arrow: '↑', label: `+${Math.round(delta)}min peste target`, color: c };
  return { arrow: '↓', label: `${Math.round(delta)}min sub target`, color: c };
}

/** Bedtime as minutes since 18:00 so evening→early-morning is monotonic
 *  (22:00→240, 00:30→390, 02:00→480). Lets us compare/range bedtimes without
 *  the midnight wrap breaking naive HH:MM math. null if missing. */
export function bedtimeFrom18(start?: string | null): number | null {
  const s = hhmmToMin(start);
  if (s == null) return null;
  return (s - 18 * 60 + 24 * 60) % (24 * 60);
}

/* Personal trend / pattern note + the coach insight engine now live in
   ./coach.ts — a single deterministic rule engine (no double work).
   `personalTrendNote` is re-exported from there for the metric modal. */
