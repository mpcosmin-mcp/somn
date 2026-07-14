import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Public unauthenticated health check. Returns 200 `{ ok: true }` when the
 * Sheets endpoint is reachable, 503 otherwise — enough for an uptime monitor.
 *
 * Deliberately opaque: it does NOT enumerate which env vars are set, name
 * services, or expose the git SHA. A public probe should reveal liveness, not
 * a map of the infrastructure.
 */
export async function GET() {
  let ok = true;

  if (process.env.SHEETS_API_URL) {
    try {
      const res = await fetch(process.env.SHEETS_API_URL, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      ok = res.status < 500;
    } catch {
      ok = false;
    }
  }

  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
