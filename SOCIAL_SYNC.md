# Cross-device social sync — Vercel KV setup

The Team Feed (likes + comments) syncs through Vercel KV. This is a
**one-time setup** you do in the Vercel dashboard. No code changes needed
afterwards — the app picks up the env vars automatically.

## What you'll get

- Likes + comments persist server-side in Redis.
- Cross-device: Clara's comment on her phone shows up on Petrica's laptop.
- Refetch every 30s + on window focus → near-real-time without polling overhead.
- Optimistic UI: clicks feel instant; rolls back if the network fails.
- Offline fallback: localStorage cache means the UI still works without KV
  (just doesn't sync).

## Cost

Free tier on Vercel: 30k commands/month, 256 MB storage. For 3 users with
say 50 likes + 20 comments/day each, that's ~10k commands/month. **Way
below the cap.**

## One-time setup (5 minutes)

1. Open <https://vercel.com/dashboard> → select the **somn** project.
2. Click the **Storage** tab in the top nav.
3. Click **Create Database** → choose **KV (Powered by Upstash)**.
4. Pick a name (e.g. `somn-social`) and a region close to your users
   (Frankfurt / `fra1` is good for Romania).
5. Click **Create & Connect**. Vercel auto-injects these env vars into
   your deployment:
   ```
   KV_URL
   KV_REST_API_URL
   KV_REST_API_TOKEN
   KV_REST_API_READ_ONLY_TOKEN
   ```
6. Redeploy from the **Deployments** tab (or just push any commit —
   the next auto-deploy picks up the new env vars).

Done. The Team Feed reactions now sync.

## Local dev (optional)

If you want to test sync locally before deploying:

```bash
# Pull the production env vars into .env.local
vercel env pull .env.local

# Then restart the dev server
npm run dev
```

Or skip local testing — the feature degrades gracefully: without KV
env vars, you get the localStorage-only experience (per-device, not
synced). Deploy to Vercel and it just works.

## Verifying it's working

After the redeploy, open the deployed site on two different devices
(or one device + one incognito window). Both should be signed in as
different teammates.

1. On device A: like or comment on an entry.
2. On device B: refresh (or wait up to 30s for the polling cycle).
3. The reaction should appear on device B.

If it doesn't sync, check the Network tab on the device that wrote:
`POST /api/social/likes` or `/api/social/comments` should return
`{ likes: [...] }` or `{ comments: [...] }`, not a 503.

If you see a 503 with `kv-unavailable`, the env vars aren't set — go
back to step 5.

## Data model

For the curious: it's just two Redis hashes.

```
HSET social:likes    "${date}_${name}"  JSON.stringify(["user1", "user2"])
HSET social:comments "${date}_${name}"  JSON.stringify([{from, ts, text}, ...])

HGETALL social:likes      # one round-trip to fetch the whole likes map
HGETALL social:comments   # same for comments
```

Read-modify-write per toggle. For 3 users the race window is microseconds
and effectively never hits. If we scale beyond a small team we'd switch
to per-entry Redis sets (`SADD social:likes:${entryKey} ${user}`) for
true atomicity.

## What about migration from localStorage v1?

The previous version (`somn_likes_v1` / `somn_comments_v1` localStorage
keys) lives only on each device. There's no automatic migration — those
were per-device anyway. People who already used the v1 feature can
re-tap the reactions they care about; from then on everything syncs.

The cache keys bumped to `v2` so the new client doesn't read stale
v1 data shape.
