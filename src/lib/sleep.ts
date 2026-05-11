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
  'Cornel-Gabriel Meleru': 'Cornel',
};

export const PERSON_COLOR: Record<string, string> = {
  'Clara-Ileana Cirpatorea': '#f472b6',  // pink-400
  'Petrica Cosmin Moga': '#60a5fa',      // blue-400
  'Cornel-Gabriel Meleru': '#34d399',    // emerald-400
};

export function personColor(name: string): string {
  return PERSON_COLOR[name] ?? '#a1a1aa';
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

/** RHR (LOWER is better). Target <60. */
export function rhrColor(rhr: number): string {
  if (rhr < 55) return C.elite;
  if (rhr < 60) return C.good;
  if (rhr < 70) return C.under;
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

export function rhrTier(rhr: number): { label: string; color: string } {
  if (rhr < 55) return { label: 'Excelent', color: C.elite };
  if (rhr < 60) return { label: 'Bun', color: C.good };
  if (rhr < 70) return { label: 'Peste target', color: C.under };
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

export function rhrStatus(rhr: number): MetricStatus {
  const c = rhrColor(rhr);
  const delta = 60 - rhr;     // higher = better since RHR lower is better
  if (delta > 3) return { arrow: '↓', label: `${rhr - 60} sub target`, color: c };
  if (delta < -3) return { arrow: '↑', label: `+${rhr - 60} peste target`, color: c };
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
