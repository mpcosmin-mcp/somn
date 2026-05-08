/* ─────────────────────────────────────────────────────────
   sleep tracker v2 — core types + color helpers
   REM is now first-class, alongside SS/RHR/HRV.
   ───────────────────────────────────────────────────────── */

export interface SleepEntry {
  date: string;          // YYYY-MM-DD (sleep date = night before wake)
  name: string;
  ss: number;            // sleep score 0-100
  rhr: number;           // resting heart rate, bpm
  hrv: number | null;    // heart rate variability, ms
  rem: number | null;    // REM minutes (NEW in v2)
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

/* ── Color scales ── */

/** Sleep Score: blue (best) → green → amber → orange → red */
export function ssColor(ss: number): string {
  if (ss >= 90) return '#60a5fa';  // blue-400
  if (ss >= 80) return '#4ade80';  // green-400
  if (ss >= 65) return '#fbbf24';  // amber-400
  if (ss >= 50) return '#fb923c';  // orange-400
  return '#f87171';                // red-400
}

/** RHR (lower is better) */
export function rhrColor(rhr: number): string {
  if (rhr < 52) return '#60a5fa';
  if (rhr < 58) return '#4ade80';
  if (rhr < 65) return '#fbbf24';
  if (rhr < 72) return '#fb923c';
  return '#f87171';
}

/** HRV (higher is better, but very personal) */
export function hrvColor(hrv: number | null): string {
  if (hrv == null) return '#52525b';
  if (hrv > 65) return '#a78bfa';  // violet-400
  if (hrv > 50) return '#60a5fa';
  if (hrv > 35) return '#fbbf24';
  if (hrv > 20) return '#fb923c';
  return '#f87171';
}

/** REM minutes — typical adult target is 90-120 min/night */
export function remColor(rem: number | null): string {
  if (rem == null) return '#52525b';
  if (rem >= 110) return '#a78bfa';  // excellent (violet)
  if (rem >= 90) return '#60a5fa';   // good (blue)
  if (rem >= 70) return '#4ade80';   // ok (green)
  if (rem >= 50) return '#fbbf24';   // low (amber)
  return '#f87171';                  // very low (red)
}

/** REM tier label */
export function remTier(rem: number | null): { label: string; color: string } {
  if (rem == null) return { label: '—', color: '#52525b' };
  if (rem >= 110) return { label: 'Excelent', color: '#a78bfa' };
  if (rem >= 90) return { label: 'Bun', color: '#60a5fa' };
  if (rem >= 70) return { label: 'OK', color: '#4ade80' };
  if (rem >= 50) return { label: 'Slab', color: '#fbbf24' };
  return { label: 'Foarte slab', color: '#f87171' };
}

/** SS tier label */
export function ssTier(ss: number): { label: string; color: string } {
  if (ss >= 90) return { label: 'Excelent', color: '#60a5fa' };
  if (ss >= 80) return { label: 'Foarte bine', color: '#4ade80' };
  if (ss >= 65) return { label: 'Bine', color: '#fbbf24' };
  if (ss >= 50) return { label: 'Mediu', color: '#fb923c' };
  return { label: 'Slab', color: '#f87171' };
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
