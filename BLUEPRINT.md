# somn — Build Blueprint

> ⚠️ **STALE + ~8K tokens. Do NOT whole-file read.** Written when somn had an AI coach (Sforăilă chat) — that was REMOVED (see CHANGELOG/EOD). Sections about `@anthropic-ai/sdk`, `/api/chat`, tool-use loop no longer apply. Kept for historical reference only. For current state: read `EOD.md` (architecture snapshot) or grep a specific section.

> A complete record of what was built, how, why, and what to reuse for future builds.
>
> **Production:** https://somn-xi.vercel.app
> **Repo:** https://github.com/mpcosmin-mcp/somn
> **Built:** April–May 2026

---

## 1. Vision & Constraints

**Vision:** A sleep tracker for IT people who care about REM, RHR & HRV — and being roasted by Claude every morning. Three-person team in Sibiu, ruthlessly minimal, dark-first, mobile-friendly, AI-fueled.

**Constraints (locked at start):**
| | |
|---|---|
| **Backend** | Google Sheets (existing v1 backend, preserve all data) |
| **Hosting** | Vercel (auto-deploy from GitHub) |
| **AI** | Claude Haiku 4.5 — cheap, fast, "small AI" only |
| **Team size** | 3 users, hardcoded names |
| **Auth** | None — name picker stored in localStorage |
| **Privacy** | `robots: noindex` — internal team app |
| **Cost target** | < $1/month for AI |

**Bold design decisions:**
- **REM as a 4th metric** added to the existing SS / RHR / HRV trio. Sleep Score remains the headline; REM is the new "story" — concrete number people can influence.
- **Single-page** dashboard + one detail page. No tabs. No nav-routing complexity.
- **Dark by default**, light optional. Match Linear/Vercel/Geist aesthetic.
- **AI is live, not chat** — daily roast + weekly story + pattern finder run automatically. Chat exists as a side panel, but the magic is in proactive AI surfaces.

---

## 2. Stack

```
Next.js 16.2.6        App Router, RSC, Turbopack
React 19.2.4
Tailwind CSS 4         (zero config, @theme inline tokens)
TypeScript 5
Geist + Geist Mono    via next/font
Anthropic SDK         @anthropic-ai/sdk → claude-haiku-4-5
clsx + tailwind-merge  cn() utility
lucide-react          (installed but mostly unused — most icons are inline SVG)
framer-motion         (installed but unused — CSS keyframes do the job)
```

**Why these choices:**
- **Next.js App Router** unlocks API routes for AI proxy (no separate Cloudflare Worker like v1)
- **Tailwind v4** — single CSS file, no PostCSS config, instant token theming via `@theme inline`
- **Geist fonts** — Vercel's open-source duo, perfect for "IT-dev" aesthetic
- **Anthropic SDK** — first-party client, type-safe, supports streaming if needed later
- **No state library** — useState + localStorage is enough for 3 users; no Redux / Zustand / TanStack Query overhead
- **No charting lib** — pure SVG sparklines + custom `<BgChart>` are < 2KB each vs Chart.js at 60KB

---

## 3. Architecture

### File tree

```
sleep-tracker-v2/
├── public/
│   └── manifest.json              PWA manifest (installable, standalone display)
├── src/
│   ├── app/
│   │   ├── layout.tsx              Root layout: fonts, theme bootstrap, metadata, ChatPanel mount
│   │   ├── page.tsx                Dashboard (Hero, Leaderboard, AI cards, AlertsBar, etc)
│   │   ├── detail/page.tsx         Per-user drill-down (sparkline cards, history, REM tips)
│   │   ├── chat/page.tsx           Legacy /chat URL → redirects to /  + opens panel
│   │   ├── not-found.tsx           Custom 404 with personality
│   │   ├── error.tsx               App-Router error boundary
│   │   ├── globals.css             Design tokens (CSS vars), light-mode overrides, mobile utilities, animations
│   │   ├── icon.svg                Favicon (moon SVG, lime on zinc-950)
│   │   ├── opengraph-image.tsx     Dynamic OG image (next/og, edge runtime)
│   │   └── api/
│   │       ├── sheets/
│   │       │   ├── route.ts         GET (read all entries, dedup, normalize dates, header-tolerant)
│   │       │   │                    POST (write one entry, supports REM + journal)
│   │       │   └── cleanup/route.ts POST → calls Apps Script ?action=cleanup
│   │       ├── roast/route.ts      Daily AI 1-liner, adaptive tone (celebrate/observe/roast)
│   │       ├── story/route.ts      Weekly AI narrative, full team daily detail
│   │       ├── patterns/route.ts   Pattern finder, JSON personal+team output
│   │       └── chat/route.ts       Conversational chat with full team context
│   ├── components/
│   │   ├── ui/                     Primitives — reusable across any page
│   │   │   ├── button.tsx          4 variants × 3 sizes
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── avi.tsx             Initial-letter circular avatar tinted by per-person color
│   │   │   ├── metric.tsx          Big number + tiny label + optional trend chip
│   │   │   ├── sparkline.tsx       Inline mini SVG line (used for headers, leaderboard rows)
│   │   │   ├── bg-chart.tsx        Full-card area chart with gradient fill (used in detail metrics)
│   │   │   ├── skeleton.tsx        Loading placeholders (DashboardSkeleton, DetailSkeleton)
│   │   │   └── theme-toggle.tsx    Sun/moon icon button
│   │   └── dashboard/              Domain components
│   │       ├── user-picker.tsx     3-name login screen with adjectives + tier badges + medals
│   │       ├── log-entry.tsx       4-metric input form + journal textarea + post-save AI feedback
│   │       ├── hero.tsx            Last-night SS giant + sparkline + REM/RHR/HRV stat tiles
│   │       ├── leaderboard.tsx     Tabbed (Azi / 7 zile / 30 zile / Total) + champion banner + fun badges
│   │       ├── ai-blocks.tsx       DailyRoast, WeeklyStory, PatternCard
│   │       ├── ai-nudge.tsx        Rotating "ask the AI" prompt card
│   │       ├── alerts-bar.tsx      Auto-detected pattern alerts (warn/good/info)
│   │       ├── chat-widget.tsx     Reusable messaging UI
│   │       ├── chat-panel.tsx      Slide-out panel (dock on desktop, popup on mobile)
│   │       ├── detail-view.tsx     /detail page composition + history rows
│   │       └── rem-tips.tsx        7-fact REM 101 expandable card
│   └── lib/
│       ├── sleep.ts                Types (SleepEntry, AggEntry), color scales, NAMES, aggregate(), lastNDays()
│       ├── gamify.ts               XP = logs×10 + SS bonus, 3-tier system, streakFor()
│       ├── alerts.ts               Deterministic pattern alert rules (no AI)
│       ├── client-api.ts           Browser → /api/* fetchers
│       ├── config.ts               Server-side env reads (Anthropic key, Sheets URL)
│       ├── utils.ts                cn(), todayStr(), fmtDate(), weekKey()
│       ├── user.ts                 useUser() hook (localStorage + hydration guard)
│       ├── theme.ts                useTheme() hook + NO_FLASH_SCRIPT
│       └── chat-toggle.ts          Global event for opening chat from anywhere
└── SETUP.md                        One-time setup checklist (API key, Sheet schema, Apps Script)
```

### Data flow

```
                  ┌─────────────────────┐
                  │ Browser (React UI)   │
                  └──────────┬──────────┘
                             │ fetch
                  ┌──────────▼──────────┐
                  │ /api/* (Next.js)     │ ← server-only, env vars accessible
                  └──┬────────────────┬──┘
       ┌─────────────┘                └──────────┐
       ▼                                          ▼
┌──────────────────┐                  ┌─────────────────────┐
│ Google Sheets     │                 │ Anthropic API        │
│ (Apps Script    ) │                 │ (claude-haiku-4-5    │
│ JSON over GET     │                 │  via SDK)            │
└──────────────────┘                  └─────────────────────┘
```

- **Browser never talks to Anthropic directly** — API key stays in Vercel env vars
- **Browser never talks to Google Sheets directly** — proxied through `/api/sheets` so we can dedup, normalize dates, handle header weirdness server-side
- **State lives in 3 places**: React useState (current view), localStorage (user pick, theme, chat history, dismissed alerts, AI cache), Google Sheets (durable team data)

### Key abstractions

| Abstraction | Purpose | Where |
|---|---|---|
| `SleepEntry` | Canonical sleep data shape | `lib/sleep.ts` |
| `useUser()` | Hydration-safe localStorage user picker | `lib/user.ts` |
| `useTheme()` | Hydration-safe theme toggle | `lib/theme.ts` |
| `chatSend(prompt)` | Open chat panel + auto-send a message from anywhere | `lib/chat-toggle.ts` |
| `aggregate(entries)` | Per-person averages with safe HRV/REM nullable handling | `lib/sleep.ts` |
| `lastNDays(entries, n)` | Cutoff filter | `lib/sleep.ts` |
| `tierFor(level)` | 3-tier system (Începător / Pro / Maestru) | `lib/gamify.ts` |
| `computeAlerts(data, user)` | Deterministic pattern detection (HRV decline, REM PR, etc) | `lib/alerts.ts` |
| `<BgChart values={...}>` | Full-card SVG area chart | `components/ui/bg-chart.tsx` |

---

## 4. Build Journey (chronological)

The repo started from a fresh `create-next-app@latest` and grew over ~5 sessions of pair-coding with Claude.

### Phase 1 — scaffold & port
- New Next.js 16 / Tailwind v4 / TypeScript / App Router project
- Design tokens in `globals.css` via `@theme inline`
- Ported core types (`SleepEntry`, color helpers, `aggregate`) from v1
- Simplified gamify (XP = logs×10 + SS bonus, no streak repairs/challenges/habits)
- Connected to existing Google Sheets via API route → preserved all v1 data

### Phase 2 — main views
- `<UserPicker>` → `<Dashboard>` flow (3-name localStorage login)
- Hero with SS giant + sparkline
- Leaderboard with tabs (Azi/7zile/Lună/Total) + medals + champion banner + fun per-person badges
- `<LogEntry>` form with REM as 4th metric + retroactive date support

### Phase 3 — AI integration (the spark)
- `/api/roast` — 1–2 line daily comment, adaptive tone
- `/api/story` — weekly team narrative
- `/api/patterns` — per-user + team pattern finder (JSON output)
- `/api/chat` — full conversational chat with team data context
- All endpoints use Haiku 4.5, all are stateless, all gracefully fall back to "AI offline" if key missing

### Phase 4 — engagement loops
- **Daily journal** field on log entry, fed back to AI as context for sharp roasts
- **Pattern alerts** — deterministic (no AI cost): HRV decline 3 days, REM PRs, best-week jumps, streak milestones, low-RHR recovery, etc.
- **AINudge card** — rotating funny prompts that open chat with prompt pre-sent
- **Adaptive AI tone** — celebrate (SS≥85 or REM≥100), observe (SS 70-84), roast (SS<70). Title icon and accent color match the mode.

### Phase 5 — chat panel
- Reusable `<ChatWidget>` (header + messages + composer)
- `<ChatPanel>` mounted globally in root layout — persists across page navigations
- Custom event API (`chat-toggle.ts`) lets any button anywhere open the panel
- Mobile: floating popup card pinned bottom-right with shadow + scale-in
- Desktop: docks to right edge, body content shifts left via CSS data-attribute

### Phase 6 — mobile + polish
- Safe-area utilities (`pb-safe`, `pt-safe`) for iOS notch/home indicator
- `.tap` class for 36/40px tap targets (mouse vs coarse pointer)
- Stagger fade-up animations on dashboard cards
- Loading skeletons replacing plain "se încarcă..." text
- 404 page + error boundary with personality
- PWA manifest (installable as standalone)
- Dynamic Open Graph image (next/og edge function)
- Custom moon SVG favicon

### Phase 7 — deep audit + bug fixes
- **Date timezone bug**: Sheet stores dates as Date objects → JSON serializes to UTC → `slice(0,10)` was losing a calendar day for Romania timezone. Fixed by adding 12h before slicing (absorbs any timezone offset within ±12h).
- **Header tolerance**: Live Sheet had headers like "score: rem" merged into one cell. API parser now falls back through alternate column names.
- **Dedup at read time**: When the old appendRow Apps Script created duplicates, the read API now collapses them in memory keeping the most-complete row.
- **Cleanup action**: New Apps Script action that physically removes duplicate rows from the Sheet.
- **AI cross-team data**: All AI routes now ship detailed daily data for ALL teammates, not just the current user (was a real "I don't have data" complaint from Claude).
- **Score column dropped**: Schema simplified from 8 cols to 7 (date | name | sleep_score | rhr | hrv | rem | journal).

---

## 5. AI Integration Patterns

### Endpoint anatomy

Every AI endpoint follows this shape:

```ts
export const runtime = 'nodejs';   // or 'edge' for OG image
export const dynamic = 'force-dynamic';
export const maxDuration = 30;     // chat & patterns need longer

export async function POST(req) {
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ text: '', reason: 'no_api_key' });
  // build system prompt with REAL DATA
  // call Anthropic
  // parse and return
  // graceful fallback on error → return empty text, not 500
}
```

**Key rule:** Never let the UI break because AI is down. Empty text = "AI offline" message in UI. Real text = the magic happens.

### Prompt design playbook

What worked:
- **Persona at top** — "Ești narator amuzant pentru o echipă IT din Sibiu — Clara, Petrica, Cornel..."
- **Concrete data, concrete columns** — `2026-05-08 (vin): SS 79, RHR 61, HRV 41, REM 94 — "am dormit fără telefon"`
- **Mode dispatching** — for adaptive roast, code picks the mode (`celebrate` / `observe` / `roast`) and injects mode-specific instructions: "Verdict: ${name} a dormit EXCELENT. Felicită-l..."
- **Strict output format** — "Răspunde DOAR cu textul, nimic altceva" / "Returnează un OBIECT JSON cu cheile X, Y"
- **Length cap** — "1–2 propoziții" / "max 4 propoziții" / "maxim 600 tokens"
- **Token budget** — Haiku is cheap but caps at ~200K context. We use ~2.5k input tokens per call (30 days × 3 users daily detail + journals + system prompt).

What failed:
- Asking for emoji → Haiku overdoes them. Always say "fără emoji".
- Asking for bullet points → only when structurally needed; default to narrative for personality.
- Generic system prompt without persona → boring, robotic.
- Sending only aggregate data ("Clara: SS avg 75") → AI complains it can't roast specifics. Must send daily.

### Caching strategy (client-side)

Cost control without backend storage. All caches in `localStorage`:

| Cache | Key | Lifetime |
|---|---|---|
| Daily roast | `somn_roast_{user}_{lastDate}_j{journalLen}` | Until next log or journal edit |
| Weekly story | `somn_story_{ISOWeek}` | Per ISO week |
| Patterns | `somn_patterns_{user}_{ISOWeek}` | Per ISO week per user |
| Chat history | `somn_chat_{user}` | Persistent until user clears |

**Why journal length in roast cache key:** if the user adds a journal note after first save, we want a fresh roast (not the cached generic one). Bumping the key invalidates.

### Cost reality

Haiku 4.5 pricing: $0.80/MTok input, $4/MTok output.

Per-call cost (measured):
- Daily roast: 600 input + 150 output ≈ **$0.0011**
- Weekly story: 2000 input + 300 output ≈ **$0.0028**
- Pattern finder: 3000 input + 400 output ≈ **$0.0040**
- Chat turn: 2500 input + 200 output ≈ **$0.0028**

For 3 users with reasonable usage:
- 3 daily roasts/day × 30 = 90 calls → $0.10
- 3 patterns/week × 4 = 12 calls → $0.05
- 1 weekly story × 4 = 4 calls → $0.01
- ~50 chat turns/month → $0.14
- **Total: ~$0.30/month**

---

## 6. Sheets Backend Patterns

### The schema (final)

```
| date       | name                   | sleep_score | rhr | hrv | rem | journal     |
|------------|------------------------|-------------|-----|-----|-----|-------------|
| 2026-05-08 | Petrica Cosmin Moga    | 79          | 61  | 41  | 94  | "no phone"  |
```

Headers in Sheet row 1, exactly: `date | name | sleep_score | rhr | hrv | rem | journal`

### Apps Script contract (3 actions)

| Query string | Behavior |
|---|---|
| (none) | Returns `{data: [{date, name, sleep_score, ...}]}` — all rows as objects keyed by header |
| `?action=write&date=...&name=...&sleep_score=...&...` | Upsert by (date, name): find existing → overwrite; else append |
| `?action=cleanup` | Find all (date, name) duplicates → keep most-complete → delete the rest. Returns `{removed: N}` |

JSONP support kept for v1 backward compatibility (`?callback=fn`).

### Gotchas the hard way

- **Date timezone** — Sheets coerces YYYY-MM-DD to a Date object → JSON.stringify outputs UTC ISO → naive slicing loses a day for non-UTC users. Fix in `/api/sheets`: parse → +12h → slice. **Always pre-shift before truncating dates from Apps Script.**
- **Don't trust headers** — users rename columns. Make the parser tolerant: `r.rem || r['score: rem']`.
- **`appendRow` always inserts** — for upsert, find by indexOf(date)+indexOf(name), then `getRange().setValues()`.
- **`Logger.log` won't help** in production — use `console.error` in Apps Script for errors.
- **Quotas matter** for high-frequency apps — but 3 users × 1 write/day = nothing. Don't worry until 100+ users.

---

## 7. Frontend Patterns (reusable)

### Pattern: Hydration-safe localStorage hook

```ts
// lib/user.ts
export function useUser() {
  const [user, setUserRaw] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setUserRaw(v);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const setUser = (n: string | null) => { /* update + persist */ };
  return { user, setUser, hydrated };
}
```

**Why:** SSR doesn't have localStorage. Direct `localStorage.getItem` during render = hydration mismatch. The `hydrated` flag tells consumers when client state is ready, so they can show loading skeletons instead of flashing wrong content.

Used by: `useUser`, `useTheme`. Same pattern any time you read `localStorage` for initial state.

### Pattern: No-flash theme bootstrap

```tsx
// layout.tsx
<head>
  <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
</head>

// theme.ts
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('somn_theme')||'dark';if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`;
```

Runs synchronously before React hydrates → no flash of wrong theme.

### Pattern: Global event for chat panel toggle

```ts
// chat-toggle.ts
export const CHAT_EVENT = 'somn-chat-toggle';
export function chatSend(prompt: string) {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { force: 'open', prompt } }));
}

// chat-panel.tsx
useEffect(() => {
  const handler = (ev) => { /* open + setPendingPrompt */ };
  window.addEventListener(CHAT_EVENT, handler);
  return () => window.removeEventListener(CHAT_EVENT, handler);
}, []);
```

**Why:** Chat panel is mounted in root layout. Buttons across pages need to open it without prop-drilling or context. Custom DOM event = clean decoupling.

Use for: any global UI element (toast, command palette, settings panel) that needs triggering from arbitrary depths.

### Pattern: Responsive popup vs dock (chat panel)

```tsx
<aside className={`
  fixed z-50

  /* Mobile: floating popup */
  inset-x-3 bottom-3 max-h-[calc(100dvh-1rem)]
  rounded-2xl shadow-2xl

  /* Desktop: dock right edge full-height */
  lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[360px] lg:max-h-none
  lg:rounded-none lg:shadow-none lg:border-y-0 lg:border-r-0

  /* Animations */
  origin-bottom-right lg:origin-right
  transform-gpu transition-all duration-200

  /* States — different per breakpoint */
  ${open
    ? 'opacity-100 scale-100 translate-y-0 lg:translate-x-0'
    : 'opacity-0 scale-95 translate-y-4 lg:opacity-100 lg:scale-100 lg:translate-x-full pointer-events-none'}
`}>
```

Two layouts in one element. Tailwind breakpoint modifiers do the work.

### Pattern: Background area chart

`<BgChart>` fills its parent absolutely with a soft gradient + line, designed to live BEHIND text content. `preserveAspectRatio="none"` makes it stretch without whitespace. Use `vector-effect="non-scaling-stroke"` so the line stays 1.5px regardless of card size.

### Pattern: Deterministic pattern alerts

`lib/alerts.ts` — runs on every dashboard mount, no AI cost. Each alert has:
- Stable ID with weekly token (so dismissed alerts revive next week)
- Severity (warn / good / info)
- Concrete numbers in the message ("HRV 52→48→43")

Rules baked in: HRV declining 3d, RHR rising 3d, REM dip vs personal avg, 2-night SS slump, REM personal record, best-week jumps, streak milestones (7/14/30/60/100/365), excellent night highlight, low-RHR recovery, streak-about-to-break.

Reuse for any tracker app that wants "smart notifications without paying for AI on every load".

### Pattern: Adaptive AI tone via mode dispatching

```ts
function pickMode(ss, rem) {
  if (ss >= 85 || (rem != null && rem >= 100)) return 'celebrate';
  if (ss >= 70) return 'observe';
  return 'roast';
}

const MODE_INSTRUCTIONS = {
  celebrate: 'a dormit EXCELENT. Felicită cu energie pozitivă...',
  observe:   'a dormit DECENT...',
  roast:     'a dormit PROST. Roastuiește cu drag...',
};

const prompt = `Verdict: ${name} ${MODE_INSTRUCTIONS[mode]}`;
```

Cleaner than asking the AI to "decide tone" — code handles the decision tree from data, AI handles the writing.

### Pattern: AI nudges (rotating prompt cards)

`<AINudge>` shows ONE rotating playful prompt with `↻` reroll button. Click prompt → opens chat with prompt auto-sent. The 12 prompts are baked in — no AI generation needed for the prompts themselves. Cheap surface area for "what can the AI do?" discoverability.

---

## 8. Mobile Patterns

### Safe area utilities

```css
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 0); }
.pt-safe { padding-top: env(safe-area-inset-top, 0); }
```

Apply to: sticky headers (notch), chat composer (home indicator), page footer.

### Tap targets

```css
.tap { min-width: 36px; min-height: 36px; }
@media (pointer: coarse) {
  .tap { min-width: 40px; min-height: 40px; }
}
.tap:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

`pointer: coarse` matches touch devices specifically. Mouse stays compact, touch gets Apple-guideline 40px+.

### Other mobile fixes

- `touch-action: manipulation` on all buttons → kills iOS double-tap zoom
- `overscroll-behavior-y: none` → kills rubber-band that breaks gesture intent
- Hover-scale animations disabled via `@media (pointer: coarse)` → otherwise they "stick" after tap
- `100dvh` instead of `100vh` for keyboard-aware viewports
- `viewportFit: cover` in metadata → respect notch

---

## 9. Design System

### CSS tokens (HSL hex, dark default)

```css
@theme inline {
  --color-bg: #09090b;
  --color-card: #18181b;
  --color-border: #27272a;
  --color-fg: #fafafa;
  --color-fg-muted: #a1a1aa;
  --color-fg-dim: #52525b;
  --color-accent: #65a30d;          /* lime-600 — works on both themes */
  --color-accent-soft: #84cc16;
  --color-accent-glow: rgba(132, 204, 22, 0.18);
}

html.light {
  --color-bg: #fafafa;
  --color-card: #ffffff;
  /* ...all overrides */
}
```

Light mode is just override CSS variables. No theme provider, no JS overhead.

### Per-metric color scales

| Metric | Direction | Stops |
|---|---|---|
| SS (0-100) | higher better | blue-400 (≥90) → green (≥80) → amber (≥65) → orange (≥50) → red |
| RHR (bpm) | LOWER better | blue (<52) → green (<58) → amber (<65) → orange (<72) → red |
| HRV (ms) | higher better | violet (>65) → blue (>50) → amber (>35) → orange (>20) → red |
| REM (min) | higher better | violet (≥110) → blue (≥90) → green (≥70) → amber (≥50) → red |

### Typography hierarchy

| Use | Class | Specs |
|---|---|---|
| Hero number | `num text-7xl md:text-8xl font-bold` | 4.5–6rem, monospace |
| Section title | `text-base font-bold` | |
| Body | `text-sm` | 14px |
| Compact body | `text-xs` | 12px |
| Tiny label | `label` (custom class) | 10px uppercase, 0.08em tracking |
| Numbers everywhere | `num` (custom class) | Geist Mono, tabular-nums, -0.02em letter-spacing |

The `.num` class is gold — apply to any digit and it gets stable column widths and that "developer dashboard" feel.

### Animation philosophy

- 150–200ms transitions — fast enough to feel responsive
- Stagger entrance: 0/60/120/180/240/300ms delays for cascade fade-up
- `prefers-reduced-motion` respected (animation/transition durations forced to 0.01ms)
- No bounces, no spring physics — keep it clean

---

## 10. Reusable Recipes (for next builds)

### Recipe: "Build a similar tracker app"

**Stack starter:**
1. `npx create-next-app@latest myapp --typescript --tailwind --app --src-dir --no-turbopack --skip-install`
2. `npm install @anthropic-ai/sdk lucide-react clsx tailwind-merge`
3. Copy these from somn:
   - `src/lib/utils.ts` (cn, todayStr, fmtDate, weekKey)
   - `src/lib/theme.ts` + `<ThemeToggle>` + globals.css design tokens
   - `src/components/ui/*` primitives (button, card, input, avi, metric, sparkline, bg-chart, skeleton)
   - `src/lib/chat-toggle.ts` + `<ChatPanel>` + `<ChatWidget>` (if you want global chat)
   - The safe-area + tap-target utilities in globals.css
4. Wire your data layer through `/api/*` routes (proxy any external API server-side)
5. Domain components in `src/components/<domain>/`

### Recipe: "Connect to existing Google Sheet"

If you have a Google Apps Script web app:
1. Use `?callback=fn` if you're going JSONP, otherwise just GET returns JSON
2. Always pre-shift dates by +12h before slicing (timezone handling)
3. Make your read parser tolerant of weird header names
4. For writes, use UPSERT (find existing row, update; else append) — never naive `appendRow`
5. Add a `?action=cleanup` action for de-duplication

### Recipe: "Add live AI without spending money"

1. Vercel API route (Node runtime if SDK needs it)
2. Server-side env var `ANTHROPIC_API_KEY`
3. Send REAL data in the system prompt — concrete numbers, not aggregates
4. Cap context to ~3k input tokens for Haiku
5. Cache in browser `localStorage` per (entity, period) — kill cache key when state changes
6. Fall back gracefully on error: return `{ text: '', reason: 'no_api_key' }`, UI shows "AI offline"
7. Cost target: $0.50–1/month for small teams

### Recipe: "Mobile-first responsive popup"

1. Fixed positioning + responsive Tailwind classes for layout
2. Mobile: `inset-x-3 bottom-3 rounded-2xl shadow-2xl max-h-[calc(100dvh-1rem)]`
3. Desktop: `lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[360px]`
4. Different transform origins per breakpoint
5. Different states per breakpoint (scale on mobile, translate-x on desktop)
6. Always `pointer-events-none` when closed to prevent invisible click-blockers
7. Esc key closes, backdrop tap closes (mobile only)

### Recipe: "PWA installable"

1. `public/manifest.json` with `display: standalone`, theme/bg colors, icons
2. `src/app/icon.svg` (Next.js auto-discovers)
3. `metadata: { manifest: '/manifest.json', appleWebApp: { capable: true } }`
4. `viewport: { themeColor: '#09090b', viewportFit: 'cover' }`
5. Custom favicon SVG with brand mark

---

## 11. Lessons Learned

### What worked phenomenally well

- **Single-page philosophy** — no navigation = less code, less cognitive load, faster to build
- **Hardcoded names** — `NAMES = ['Clara...', 'Petrica...', 'Cornel...']` is liberating for a small team app. No multi-tenant complexity.
- **Server-side API routes for everything** — no CORS pain, env vars stay private, easier debugging
- **localStorage for client state** — zero infra, perfect for a no-auth team app
- **Same Sheet as backend** — preserved all v1 data, no migration scripts
- **Dark-first design** — IT-dev users love it, and light mode being an override is way simpler than "theme provider" patterns
- **Adaptive AI tone** — code picks mode, AI writes; clean separation of decision and generation
- **Background area charts** — way more impressive visually than tiny corner sparklines
- **Daily journal** — 50 lines of code, but transforms AI quality from "generic" to "knowing"

### What got cut and why

- **Levels with 30 names** ("Somnoros" → "Grand Master") → kept just 3 tiers (Începător / Pro / Maestru). Less is more.
- **Weekly challenges system** → no one engaged, dropped entirely
- **Habits tracker** → out of scope, separate concept
- **Streak repair with XP cost** → felt punitive, removed
- **Chart.js (60KB)** → replaced with pure SVG sparklines + BgChart (~2KB total)
- **Per-day reset of weekly champion** → simpler: just "this week vs last 30 days" trend
- **chat as a fullscreen page** → side panel persists across pages instead

### Gotchas hit (and fixes)

| Bug | Symptom | Fix |
|---|---|---|
| Date timezone | "Petrica n-a logat azi" when he had | +12h before slicing date string |
| Apps Script duplicate rows | Multi-row per (date, name) | Upsert + cleanup action + read-time dedup |
| Sheet header drift | `score: rem` merged column | Header-tolerant parser |
| AI sees only my data | "Don't have detail for Clara/Cornel" | Send ALL team daily data in prompts |
| Vercel deployment auth | 401 SSO on shared deploy URLs | Disable Deployment Protection OR share canonical alias only |
| `100vh` on mobile keyboard | Composer cut off | Use `100dvh` |
| Tap target tiny | Hard to tap on touch | `.tap` class + `@media (pointer: coarse)` bumps |
| Hover-scale stuck on touch | Buttons stay scaled after tap | Disable hover transforms via `@media (pointer: coarse)` |
| Hydration mismatch | Theme flash on load | Inline pre-React script that sets class on `<html>` |
| Stale chat history | Old messages from previous user | Per-user localStorage keys (`somn_chat_${user}`) |

### What I'd do differently next time

- **Skip JSONP entirely** — go REST from day one. Apps Script supports it.
- **Add typed contracts (Zod) at API boundaries** — would have caught the score-column drift instantly.
- **Use proper service accounts for Sheets API** — Apps Script web apps are hacky. The Sheets API + OAuth would be cleaner long-term.
- **Bundle in UI tests** — Playwright smoke for "log entry → save → roast appears" flows.
- **Track AI calls server-side** — log token usage to a Sheet so the user can see cost trends.
- **Add a "compare two users" mode** — would be a natural extension.

---

## 12. Roadmap / Backlog

Things considered but not built (saved for next iteration):

- **Push notifications** — when someone gets a roast / achieves a milestone (would need a Service Worker + a backend-triggered push)
- **Compare mode** — pick 2 users → see SS / REM / HRV / RHR side by side
- **Journal search** — find all journals containing "alcool" / "sport" → see metric correlation
- **Monthly PDF export** — recap with patterns + AI commentary, downloadable
- **Sleep Oracle** (predictions) — was in v1, killed for now; could come back as "based on the last 4 nights, tonight's SS will probably be X"
- **Trophy system** (visible) — in v1 there were 20 weekly trophies; we kept the LOGIC (champion banner) but stripped the visual collection
- **Team chat between users** (not AI) — share a quick "good night" message
- **Dashboard for `/team`** — leaderboards / averages from the team's perspective rather than "my view"
- **Alerts as proactive AI** — instead of deterministic rules, ask Haiku weekly "any concerning patterns?" → if yes, surface

---

## TL;DR

A Next.js + Tailwind + Anthropic SDK web app for a 3-person team tracking sleep. Backed by Google Sheets. Deployed on Vercel. Costs $0.30/month in AI. Supports 4 metrics (SS, REM, RHR, HRV) + freeform journal. Has chat panel, pattern alerts, daily roast, weekly story, weekly pattern finder, full dark/light theming, mobile-first responsive layouts, PWA installable. Built in ~7 sessions of pair-coding with Claude.

**Next builds**: copy `lib/utils`, `lib/theme`, `components/ui/*`, `lib/chat-toggle` + chat components → instant 60% headstart.
