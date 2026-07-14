/* Server-side config — never imported from client components */

/**
 * Google Apps Script endpoint backing the team's Sheet.
 *
 * SECURITY: this URL is a bearer capability — anyone who has it can read every
 * row (health data + journals) and write/delete. It therefore lives ONLY in the
 * environment (`.env.local` locally, Vercel env in prod), never hardcoded here,
 * so it can't leak through the public GitHub repo. Rotate the Apps Script
 * deployment (new URL) if it's ever exposed.
 */
export const SHEETS_API = process.env.SHEETS_API_URL ?? '';

/** Throw a clear error at the point of use rather than fetching an empty URL. */
export function requireSheetsApi(): string {
  if (!SHEETS_API) {
    throw new Error(
      'SHEETS_API_URL is not set — add it to .env.local (local) or Vercel env (prod).',
    );
  }
  return SHEETS_API;
}

/** Marker for special rows (legacy duel feature, filtered out) */
export const DUEL_ROW_MARKER = '__DUEL__';
