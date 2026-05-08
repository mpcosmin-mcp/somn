import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Local YYYY-MM-DD without timezone shenanigans */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "21 Apr 2026" style */
export function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

/** "luni · 21 apr" style — short, lowercase, IT vibe */
export function fmtDateShort(d: string): string {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  const days = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];
  const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  return `${days[date.getDay()]} · ${date.getDate()} ${months[date.getMonth()]}`;
}

/** ISO week number */
export function weekNumber(d: Date = new Date()): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Week key like "2026-W17" */
export function weekKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-W${String(weekNumber(d)).padStart(2, '0')}`;
}
