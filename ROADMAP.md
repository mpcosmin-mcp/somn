# somn — Roadmap: from 3-person squad to 10k+ "sleepers"

> **Status:** vision + phased plan. Living document — update as phases land.
> **North star:** *social media for professional sleepers* — the 5 minutes a
> day where people log their sleep, get a hit of insight, compete a little,
> and stick around for the science / podcasts / community.

---

## The product thesis

People already track sleep on their watches. What's missing is a **daily
reason to come back** and a **place to talk about it**. somn is that place:

1. **Log first (the daily lesson).** No automatic device sync. The user comes
   in and logs their night manually — *that act* is the habit, the same way a
   Duolingo lesson is. 5 minutes, done.
2. **Reward consistency, not genetics.** We gamify *showing up* and *hitting
   your own targets*, never raw Sleep Score. A bad sleeper improving must be
   able to out-rank a good sleeper coasting. This is a hard design rule.
3. **Give them something to read.** Science snippets, podcasts, book
   summaries, chronotype tests — so the 5 minutes can become 10 by choice.
4. **Make it social.** Friends, leagues, reactions, comments. Sleep is lonely;
   the leaderboard makes it a shared ritual.

### Explicit non-goal
**No automatic data ingestion** (Terra / Garmin / Apple Health). Decided
deliberately: auto-sync removes the daily logging ritual that *is* the habit.
Users authenticate and log by hand.

---

## Stack — Vercel-native

Everything provisioned from the Vercel dashboard, one bill, env vars
auto-injected. The DB/Redis engines are partner-run (Neon/Upstash) but the
developer experience stays inside Vercel.

| Concern | Choice | Notes |
|---|---|---|
| **Auth** | **Clerk** | Google sign-in + email/password + email verification link + persistent sessions, all turnkey. Prebuilt `<SignIn/>` / `<UserButton/>`, Next.js middleware. Free ~10k MAU. |
| **Relational DB** | **Neon Postgres** (Vercel Marketplace) | Users, sleep logs, leagues, friendships, content. Serverless, scale-to-zero. Successor to "Vercel Postgres". |
| **Cache / leaderboards** | **Upstash Redis** (already in use) | League standings via sorted sets (`ZADD`/`ZRANK`) — the right tool. Also rate limiting + the existing social cache. |
| **Cron** | **Vercel Cron** | Weekly league rollover, streak-break checks, push scheduling. Replaces the GitHub Actions cron. |
| **Blob storage** | **Vercel Blob** | Avatars, content thumbnails. |
| **Push** | **Web Push (PWA)** | We already ship `manifest.json` + `sw.js`. |
| **AI** | **Anthropic SDK** — Opus 4.8 + Haiku 4.5 | Premium coaching on Opus, cheap classification/nudges on Haiku. **Prompt caching mandatory** for cost. |

> **Identity vs data:** Clerk owns identity (the user record, login). All sleep
> data lives in **Neon**, keyed by the Clerk user ID. We are not locked into
> Clerk for the valuable data.

---

## The retention loop (Duolingo, mapped to sleep)

Three mechanics do the heavy lifting:

### 1. Streak + streak economy
- Daily logging streak (we already compute `streakFor` / `maxStreakFor`).
- Make it *expensive to lose*: **streak freeze** (buy with in-app currency),
  **weekend amulet**, **streak repair** within 24h.
- Big visible streak flame + "streak in danger" push at night.

### 2. Weekly Leagues  ← the competition the user asked for
- ~30 users per league. Top 10 promote, bottom 5 relegate.
- Tiers: Bronze → Silver → Gold → Diamond → (Obsidian).
- **Scoring = consistency, NOT raw SS.** XP comes from: logging daily,
  hitting *your own* target, streak length, journaling. So everyone competes
  fairly regardless of how well they sleep.
- Redis sorted set per league per week; Vercel Cron does Sunday-night rollover.

### 3. Smart push notifications
- "Gabi is 5 XP behind you in Gold — log tonight?"
- "12-day streak at risk — 3 hours left."
- Personalized send-time (the hour they usually log).

Supporting: **XP + levels** (have `calcXP`/`xpLevel`), **badges** (built in
PR #14 — `badgesFor`), **gems/currency**, **friend quests**.

---

## Content layer — "social media for professional sleepers"

Turns logging from "log and leave" into "stay and scroll":

- **Daily science snippet / myth-buster** — one swipeable card.
- **Podcast embeds** — Huberman, Matt Walker, etc. (Spotify/YouTube embed).
- **Book summaries** — *Why We Sleep* and friends.
- **Tests / quizzes** — "What's your chronotype?", "Sleep IQ" — shareable,
  inherently viral, great for acquisition.
- **Community feed + discussions** — follow/friends, reactions beyond the
  current single like (🔥 💀 😴 💪), @-mentions, comment threads.

---

## Where Opus 4.8 lives — the differentiator

We removed AI once for cost. At scale, **with prompt caching**, it comes back
as the thing competitors don't have:

- **Personal sleep coach** — daily narrative from the user's patterns
  ("your HRV dips every Thursday — late meetings?").
- **Grounded Q&A** — ask anything about sleep, answered from the content
  library (RAG over our articles/summaries).
- **Auto-generated league trash-talk / nudges** (Haiku, cheap).
- **Content personalization** — which podcast/article to surface next.

**Cost discipline (non-negotiable):** Haiku 4.5 for high-volume cheap calls
(nudges, tagging, routing); Opus 4.8 only for the premium coaching moment;
prompt caching on all shared context (content library, system prompts).

---

## Phased plan

### Phase 0 — Foundation (no new features, just a real base)
*Without this, everything else is a castle on sand.*
- [ ] Clerk auth: Google + email/password + verification + sessions.
- [ ] Neon Postgres + schema: `users`, `sleep_logs`, (later) `leagues`,
      `friendships`, `content`.
- [ ] Migrate off hardcoded `NAMES` (3 people) → dynamic users keyed by Clerk
      ID. **This is the big one** — `sleep.ts`, `gamify.ts`, `insights.ts`,
      every dashboard component reads `NAMES` today.
- [ ] Migrate sleep data: Google Sheet → Neon. Keep manual logging UX.
- [ ] Protect routes with Clerk middleware; replace the "pick a card" login.

### Phase 1 — Habit core
- [ ] Streak economy (freeze / repair / amulet) + currency.
- [ ] Web Push: streak-danger + daily reminder at personalized time.
- [ ] Onboarding flow for brand-new users (first log = guided).

### Phase 2 — Competition
- [ ] Weekly Leagues (Redis sorted sets + Vercel Cron rollover).
- [ ] Consistency-based XP scoring (fair across sleep quality).
- [ ] Friends: follow, friend leaderboard, friend quests.
- [ ] Carry forward PR #14 insights (records, head-to-head, MVP, badges) onto
      the dynamic-user model.

### Phase 3 — Content + AI
- [ ] Content CMS in Neon (science snippets, podcasts, books, quizzes).
- [ ] Daily snippet card + content feed.
- [ ] Chronotype / Sleep-IQ tests (shareable).
- [ ] AI sleep coach (Opus 4.8) + grounded Q&A (RAG) + Haiku nudges, all with
      prompt caching.

### Phase 4 — Scale & polish (ready for 1000+ onboarding)
- [ ] Reactions beyond like, @-mentions, comment threads.
- [ ] Moderation + abuse controls.
- [ ] Analytics / funnel (activation, D1/D7/D30 retention).
- [ ] Load test the league rollover + push fan-out.

---

## Cost sketch

At ~1000 users: Neon launch tier + Upstash free + **Vercel Pro $20/mo** +
Clerk free (under 10k MAU) + AI a few $/mo (Haiku-heavy, cached). Roughly
**$20–50/mo**. Grows with scale but stays sane into the low tens of thousands.

---

## Open decisions (revisit before the relevant phase)
- In-app currency: earned-only, or purchasable? (monetization later)
- League size & cadence (30/week is the Duolingo default — tune after data).
- Content sourcing: original vs licensed vs embed-only (rights matter).
- Monetization: premium coach tier? cosmetic? — out of scope until Phase 3+.

---

## Decisions locked
- **No automatic data ingestion** — manual logging is the habit. (Terra/Garmin dropped.)
- **Auth = Clerk.**
- **Stack = Vercel-native** (Neon + Upstash + Vercel Cron/Blob + Clerk).
- **Gamify consistency, never raw Sleep Score.**
