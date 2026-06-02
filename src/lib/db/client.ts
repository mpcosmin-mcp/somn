/* ─────────────────────────────────────────────────────────
   Lazy Neon connection (Drizzle + @neondatabase/serverless).

   Lazy on purpose: the module can be imported anywhere without a
   DATABASE_URL present (build time, components that never query),
   and only opens a connection on first actual use. `dbAvailable()`
   lets API routes degrade gracefully while we're still wiring Neon
   in (mirrors the KV-unavailable fallback in the social layer).
   ───────────────────────────────────────────────────────── */
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/lib/db/schema';

let _db: NeonHttpDatabase<typeof schema> | null = null;

/** True when a DATABASE_URL is configured — gate DB code paths on this. */
export function dbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Get the singleton Drizzle client. Throws if DATABASE_URL is missing. */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — cannot open Neon connection');
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}

export { schema };
