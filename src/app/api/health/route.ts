import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { hasPostgres } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Public unauthenticated health check. Returns 200 `{ ok: true }` when the
 * Neon (Postgres) store is reachable, 503 otherwise — enough for an uptime
 * monitor.
 *
 * Deliberately opaque: it does NOT enumerate which env vars are set, name
 * services, or expose the git SHA. A public probe should reveal liveness, not
 * a map of the infrastructure.
 */
export async function GET() {
  let ok = true;

  if (hasPostgres()) {
    try {
      await sql`SELECT 1`;
    } catch {
      ok = false;
    }
  }

  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
