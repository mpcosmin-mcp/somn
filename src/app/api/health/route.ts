import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Public unauthenticated health check.
 * Returns 200 with `ok: true` when required env + external services reachable.
 * Returns 503 otherwise — uptime monitors will alert.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let allOk = true;

  // 1. Required env vars
  const required = ["SHEETS_API_URL"];
  for (const name of required) {
    const present = Boolean(process.env[name]);
    checks[`env.${name}`] = { ok: present };
    if (!present) allOk = false;
  }

  // Optional env (AI features degrade gracefully without these)
  const optional = ["ANTHROPIC_API_KEY", "KV_REST_API_URL", "KV_REST_API_TOKEN"];
  for (const name of optional) {
    checks[`env.${name}`] = {
      ok: Boolean(process.env[name]),
      detail: process.env[name] ? undefined : "optional — feature degrades without it",
    };
  }

  // 2. Google Sheets API reachable (HEAD request, no body parse)
  if (process.env.SHEETS_API_URL) {
    try {
      const t0 = Date.now();
      const res = await fetch(process.env.SHEETS_API_URL, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - t0;
      checks["sheets.reachable"] = {
        ok: res.status < 500,
        detail: `HTTP ${res.status} (${latencyMs}ms)`,
      };
      if (res.status >= 500) allOk = false;
    } catch (err) {
      checks["sheets.reachable"] = {
        ok: false,
        detail: err instanceof Error ? err.message : "unknown error",
      };
      allOk = false;
    }
  }

  return NextResponse.json(
    {
      ok: allOk,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      checks,
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
