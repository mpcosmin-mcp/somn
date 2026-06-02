/* ─────────────────────────────────────────────────────────
   Neon Postgres schema (Drizzle ORM).

   Phase 0 of ROADMAP.md: move off the hardcoded 3-person NAMES
   list + Google Sheet onto a real DB keyed by Clerk user IDs.

   Tables here are the v1 core. Leagues / friendships / content
   land in later phases.
   ───────────────────────────────────────────────────────── */
import { pgTable, text, integer, date, timestamp, uniqueIndex, index, serial } from 'drizzle-orm/pg-core';

/**
 * users — one row per authenticated person.
 *
 * `id` is the Clerk user ID (we don't mint our own). Profile fields
 * (display name, accent color, avatar) live here so the rest of the app
 * stops reading the hardcoded NAMES / FIRST_NAME / PERSON_COLOR maps.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),                       // Clerk user id, e.g. "user_2abc..."
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  firstName: text('first_name').notNull(),
  color: text('color').notNull().default('#a1a1aa'), // hex accent
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * sleep_logs — one row per (user, date). Mirrors SleepEntry.
 *
 * UNIQUE(user_id, date) enforces one log per night per user — writes
 * upsert on that key (same semantics as the old Apps Script behaviour,
 * but enforced by the DB instead of dedup-on-read).
 */
export const sleepLogs = pgTable('sleep_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),                      // YYYY-MM-DD, the sleep date
  ss: integer('ss').notNull(),                       // sleep score 0-100
  rhr: integer('rhr').notNull(),                     // resting HR, bpm
  hrv: integer('hrv'),                               // nullable
  rem: integer('rem'),                               // REM minutes, nullable
  journal: text('journal'),                          // free-form note, nullable
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('sleep_logs_user_date_uniq').on(t.userId, t.date),
  index('sleep_logs_date_idx').on(t.date),
]);

export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbSleepLog = typeof sleepLogs.$inferSelect;
export type NewDbSleepLog = typeof sleepLogs.$inferInsert;
