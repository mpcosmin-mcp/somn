/* Aria activity schedule — the fixed weekly class timetable at Aria, plus the
 * date helpers the calendar needs. The schedule is a config constant (it only
 * changes when Aria changes their timetable); who attends is data, stored in KV
 * and keyed by (activityId, date). */

import { TIER_PCT } from '@/lib/gamify';

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  day: number; // 0=Mon … 4=Fri
  startTime: string;
  endTime: string;
  capacity: number;
  color: string;
}

export const ARIA_SCHEDULE: Activity[] = [
  { id: 'trx-mon',     name: 'TRX',            emoji: '🏋️', day: 0, startTime: '17:00', endTime: '18:00', capacity: 22, color: '#f59e0b' },
  { id: 'trx-thu',     name: 'TRX',            emoji: '🏋️', day: 3, startTime: '17:00', endTime: '18:00', capacity: 22, color: '#f59e0b' },
  { id: 'cycling-mon', name: 'Indoor Cycling', emoji: '🚴', day: 0, startTime: '17:00', endTime: '18:00', capacity: 22, color: '#3b82f6' },
  { id: 'cycling-wed', name: 'Indoor Cycling', emoji: '🚴', day: 2, startTime: '17:00', endTime: '18:00', capacity: 22, color: '#3b82f6' },
  { id: 'aqua-wed',    name: 'Aqua Gym',       emoji: '🏊', day: 2, startTime: '07:00', endTime: '08:00', capacity: 22, color: '#06b6d4' },
  { id: 'cross-tue',   name: 'Cross Training', emoji: '⚡', day: 1, startTime: '17:00', endTime: '18:00', capacity: 25, color: '#22c55e' },
  { id: 'cross-fri',   name: 'Cross Training', emoji: '⚡', day: 4, startTime: '16:00', endTime: '17:00', capacity: 25, color: '#22c55e' },
];

/**
 * 🏃 Activ badge ladder — earned by total workouts attended. Thresholds are
 * this badge's own (10/25/50/100); the permanent % each tier grants is shared
 * with every other badge (TIER_PCT), so "ca la celelalte badge-uri" holds by
 * construction — change TIER_PCT once and this moves with it.
 */
export const ACTIVITY_TIERS = [
  { label: 'Bronz',   threshold: 10,  pct: TIER_PCT.bronze,   color: '#b45309' },
  { label: 'Argint',  threshold: 25,  pct: TIER_PCT.silver,   color: '#94a3b8' },
  { label: 'Aur',     threshold: 50,  pct: TIER_PCT.gold,     color: '#eab308' },
  { label: 'Platină', threshold: 100, pct: TIER_PCT.platinum, color: '#22d3ee' },
] as const;

export const RO_DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri'] as const;
export const RO_DAYS_SHORT = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin'] as const;
const RO_MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
] as const;

/** KV field for one class on one date. */
export function bookingKey(activityId: string, date: string): string {
  return `${activityId}:${date}`;
}

export function getActivitiesForDay(dayIndex: number): Activity[] {
  return ARIA_SCHEDULE.filter(a => a.day === dayIndex);
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmt(d);
}

export function getWeekDates(mondayStr: string): string[] {
  const mon = parse(mondayStr);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return fmt(d);
  });
}

export function addWeeks(mondayStr: string, n: number): string {
  const d = parse(mondayStr);
  d.setDate(d.getDate() + n * 7);
  return fmt(d);
}

export function formatWeekRange(mondayStr: string): string {
  const mon = parse(mondayStr);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const mMonth = RO_MONTHS[mon.getMonth()];
  const fMonth = RO_MONTHS[fri.getMonth()];
  const year = fri.getFullYear();
  if (mon.getMonth() === fri.getMonth()) {
    return `${mon.getDate()}-${fri.getDate()} ${mMonth} ${year}`;
  }
  return `${mon.getDate()} ${mMonth.slice(0, 3)} - ${fri.getDate()} ${fMonth.slice(0, 3)} ${year}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === fmt(new Date());
}

export function isPast(dateStr: string): boolean {
  return dateStr < fmt(new Date());
}

/**
 * How many past classes `user` actually attended — the count that drives the
 * 🏃 Activ badge. Only past bookings count (a future booking is an intention,
 * not an attendance). `bookings` is the KV map: bookingKey → names[].
 */
export function attendanceCount(bookings: Record<string, string[]>, user: string): number {
  let n = 0;
  for (const [key, names] of Object.entries(bookings)) {
    const date = key.slice(key.indexOf(':') + 1);
    if (isPast(date) && names.includes(user)) n++;
  }
  return n;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
