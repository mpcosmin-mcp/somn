/* ─────────────────────────────────────────────────────────
   Data-access layer over Neon. Everything the app needs to read
   or write users + sleep logs goes through here, so the rest of
   the codebase never touches Drizzle directly and the old
   /api/sheets shape (SleepEntry) is preserved at the boundary.
   ───────────────────────────────────────────────────────── */
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users, sleepLogs, type NewDbUser } from '@/lib/db/schema';
import { type SleepEntry } from '@/lib/sleep';

/* ── Users ──────────────────────────────────────────────── */

/**
 * Insert or update a user profile (called on sign-in / Clerk webhook).
 * Keyed by Clerk id; updates email/name/avatar on conflict.
 */
export async function upsertUser(u: NewDbUser): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values(u)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: u.email,
        displayName: u.displayName,
        firstName: u.firstName,
        avatarUrl: u.avatarUrl,
        updatedAt: new Date(),
      },
    });
}

export async function getAllUsers() {
  const db = getDb();
  return db.select().from(users);
}

export async function getUser(id: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ── Sleep logs ─────────────────────────────────────────── */

/** Map a DB row + its owner's display name into the app's SleepEntry shape. */
function toEntry(row: typeof sleepLogs.$inferSelect, name: string): SleepEntry {
  return {
    date: row.date,
    name,
    ss: row.ss,
    rhr: row.rhr,
    hrv: row.hrv,
    rem: row.rem,
    journal: row.journal,
  };
}

/**
 * All entries across the team, newest first — the replacement for
 * GET /api/sheets. Joins logs to users so each entry carries the
 * owner's display name (the app keys on `name`).
 */
export async function getAllEntries(): Promise<SleepEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      log: sleepLogs,
      name: users.displayName,
    })
    .from(sleepLogs)
    .innerJoin(users, eq(sleepLogs.userId, users.id))
    .orderBy(desc(sleepLogs.date));
  return rows.map(r => toEntry(r.log, r.name));
}

/**
 * Upsert a single night for a user. One log per (user, date) — the
 * unique index makes this an idempotent write.
 */
export async function upsertSleepLog(userId: string, e: Omit<SleepEntry, 'name'>): Promise<void> {
  const db = getDb();
  await db
    .insert(sleepLogs)
    .values({
      userId,
      date: e.date,
      ss: Math.round(e.ss),
      rhr: Math.round(e.rhr),
      hrv: e.hrv == null ? null : Math.round(e.hrv),
      rem: e.rem == null ? null : Math.round(e.rem),
      journal: e.journal ?? null,
    })
    .onConflictDoUpdate({
      target: [sleepLogs.userId, sleepLogs.date],
      set: {
        ss: Math.round(e.ss),
        rhr: Math.round(e.rhr),
        hrv: e.hrv == null ? null : Math.round(e.hrv),
        rem: e.rem == null ? null : Math.round(e.rem),
        journal: e.journal ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteSleepLog(userId: string, date: string): Promise<void> {
  const db = getDb();
  await db
    .delete(sleepLogs)
    .where(and(eq(sleepLogs.userId, userId), eq(sleepLogs.date, date)));
}
