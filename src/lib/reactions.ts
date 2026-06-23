/* ─────────────────────────────────────────────────────────
   Shared reaction vocabulary + pure helpers.

   Imported by BOTH the client social layer (lib/social.tsx) and the
   API routes (app/api/social/*). Keep it dependency-free (no React,
   no Node, no @vercel/kv) so both sides can use it.

   Back-compat: the original "likes" feature stored a bare `string[]`
   of users who hearted an entry. A reaction map generalizes that to
   `emoji → string[]`. `normalizeReactions` upgrades any legacy array
   to `{ '❤️': arr }` so old data surfaces as ❤️ reactions with no
   migration step.
   ───────────────────────────────────────────────────────── */

/** The fixed emoji palette. Order = display order in the picker.
 *  Sleep-banter themed: love · fire(streak) · lol(roast) · sleepy ·
 *  strong(recovery) · dead(brutal night). */
export const REACTIONS = ['❤️', '🔥', '😂', '😴', '💪', '💀'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

/** Default reaction — a bare "like" is a ❤️. */
export const DEFAULT_REACTION: ReactionEmoji = '❤️';

/** emoji → list of user names who reacted with it. */
export type ReactionMap = Record<string, string[]>;

export function isReactionEmoji(x: unknown): x is ReactionEmoji {
  return typeof x === 'string' && (REACTIONS as readonly string[]).includes(x);
}

/**
 * Normalize a stored/raw value into a clean ReactionMap.
 *   - legacy `string[]` (old likes)  → { '❤️': arr }
 *   - object                          → keep only known emoji keys w/ array values
 *   - anything else                   → {}
 * Empty buckets are dropped so `Object.keys` is always meaningful.
 */
export function normalizeReactions(raw: unknown): ReactionMap {
  if (Array.isArray(raw)) {
    const users = raw.filter((u): u is string => typeof u === 'string');
    return users.length ? { [DEFAULT_REACTION]: users } : {};
  }
  if (raw && typeof raw === 'object') {
    const out: ReactionMap = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isReactionEmoji(k) && Array.isArray(v)) {
        const users = v.filter((u): u is string => typeof u === 'string');
        if (users.length) out[k] = users;
      }
    }
    return out;
  }
  return {};
}

/**
 * Toggle a user's `emoji` reaction in a map (immutable, returns a new map).
 * A user can hold several different emoji on the same target (Slack-style),
 * but toggling the same emoji twice removes it. Empty buckets are pruned.
 */
export function toggleReaction(map: ReactionMap, emoji: string, user: string): ReactionMap {
  const next: ReactionMap = {};
  for (const [k, v] of Object.entries(map)) next[k] = [...v];
  const cur = next[emoji] ?? [];
  next[emoji] = cur.includes(user) ? cur.filter(u => u !== user) : [...cur, user];
  if (next[emoji].length === 0) delete next[emoji];
  return next;
}

/** Total reactions across all emoji on a target. */
export function reactionTotal(map: ReactionMap): number {
  return Object.values(map).reduce((s, v) => s + v.length, 0);
}

/** Users who reacted with a specific emoji. */
export function reactorsOf(map: ReactionMap, emoji: string): string[] {
  return map[emoji] ?? [];
}
