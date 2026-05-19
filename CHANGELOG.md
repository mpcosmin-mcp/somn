# Changelog

All notable changes to **somn**, in reverse chronological order.

Versioning is loose — no SemVer. Each session is its own release.

---

## [v0.8] · Chat retirement → PWA install → metric drilldown · 2026-05-19

A long focused session. Ten commits, ~1260 lines added / ~720 deleted across 33 files.

### Added
- **Per-user avatars** in `public/avatars/` (Petrica, Clara, Gabi) — disco-themed JPGs. `<Avi>` upgraded with optional image source, `face`/`full` variants, `xl`/`2xl` sizes. Falls back to colored initial when missing.
- **Login hover-card** (`ProfileHoverCard`) on desktop login picker — face avatar + tier + Lv + XP progress + streak + computed **best-at** badge (Petrica 🫀 lowest RHR, Clara 🔥 top streak, Gabi 🌙 REM master).
- **Recorduri** in profile popover — 3-cell grid under XP: 🏆 best SS · 🌙 best REM · 🔥 longest streak ever. New `maxStreakFor()` helper in `gamify.ts` for lifetime-record streaks.
- **PWA installable** — minimal cache-first service worker (`public/sw.js`) registered prod-only, `useInstall` hook centralizes `beforeinstallprompt` + iOS detection + standalone check + dismiss persistence. `InstallButton` (TopBar) + `InstallToast` (one-time card) + `LoginInstallBanner` (lime-gradient CTA above login picker).
- **PNG icons** at 192 and 512 (generated from SVG via PowerShell + System.Drawing) for PWABuilder / Play Store. Manifest lists SVG + both PNGs as `any maskable`. Manifest gained `scope: "/"` + `id: "/"`.
- **Metric detail modal** ("ca la health tracker") — every KPI card is now a button. Click → bottom-sheet (mobile) / centered card (desktop) with status pill, headline + delta + target pill, 30-day `MultiLineChart` with target reference line, 4 quick stats (avg 7d / avg 30d / lifetime best / total logs), full descending history. Escape + backdrop close, body scroll lock.
- **INSTALL.md** at project root — PWA on desktop / Android / iOS, APK via PWABuilder TWA (Digital Asset Links + Play Store), troubleshooting, Capacitor path note.

### Changed
- **Personal History redesign** — 5-column tabular layout → 7-column on `sm+`: `Data | Trend | RHR | Scor | REM | HRV | Status`. Per-row 7-day SS sparkline colored by user. Mobile keeps compact 4-column view.
- **`Cornel-Gabriel Meleru` → display name Gabi** (DB key untouched via FIRST_NAME map).
- **Login mandatory** — dropped `localStorage` + cookie persistence in `UserProvider`. Every fresh open lands on `UserPicker`.
- Login picker avatar shrunk from `xl` to `lg` per feedback.
- Loguri/zile counter scoped to current user (was summing the whole team).

### Removed
- **Sforăilă chat surface entirely** — chat component, `/api/chat`, Lobster mascot SVG, `@anthropic-ai/sdk` dependency. `@vercel/kv` kept for social routes.

### Fixed
- Avatar mapping mishap — Petrica and Gabi images were swapped.
- Streak chip dedupes against best-at badge when both would say "streak".

### Verification
Every batch followed AGENTS.md preview-and-approval — `npm run build` clean, `preview_eval` DOM checks (screenshots timed out on Windows headless, replaced with structured DOM reads), then push to `master`.

### Pending verification
- Real-device install flow (desktop Chrome/Edge, Android Chrome, iPhone Safari) — covered as pickup item in EOD.
- Local KV env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) needed for `/api/social/*` local testing; prod is fine.
- Stale docs in README/BLUEPRINT/TEMPLATE still reference removed chat + old user names.

---

## [v0.7] · Polish + dev-ready · 2026-05-08

### Added
- **Mobile chat popup** — floating card pinned bottom-right with shadow, scale-in from origin, backdrop-blur. Replaces the slide-in drawer that didn't feel native on mobile. Desktop still docks to right edge.
- **PWA installable** — `manifest.json`, custom moon SVG favicon, `appleWebApp` metadata, `viewportFit: cover`
- **Open Graph image** — dynamic via `next/og` edge runtime, used when sharing the URL on Slack/WhatsApp/etc
- **Loading skeletons** — `<DashboardSkeleton>` and `<DetailSkeleton>` replace plain "se încarcă..." text
- **404 page** with personality ("Probabil ai dormit prea puțin și ai tastat greșit")
- **Error boundary** (`error.tsx`) — full app-router error fallback with retry + dashboard buttons
- **Stagger fade-up animations** on dashboard cards (CSS keyframes, respects `prefers-reduced-motion`)
- **Focus rings** on all `.tap` buttons for keyboard nav
- `BLUEPRINT.md` and this CHANGELOG

### Changed
- Empty hero state gets emoji + "REM-ul tău nu se loghează singur" tagline
- Empty detail history gets 📭 + "încearcă alt range"
- Robots `noindex/nofollow` (private team app, keep out of search engines)
- Chat close icon swapped from `<` chevron to `×` (better fit for popup)

### Fixed
- **Vercel Deployment Protection 401** on deployment-specific URLs — caused chat to "not work" on other laptops. Solution: share only canonical `somn-xi.vercel.app`, or disable protection in Vercel settings.

---

## [v0.6] · AI sees full team data + background charts · 2026-05-08

### Added
- **Background area charts** in detail page metric cards — `<BgChart>` fills the entire card behind the numbers with gradient fill + line, replacing tiny corner sparklines
- `<BgChart>` component: viewBox 400×100 stretched via `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke` so the line stays 1.5px regardless of card size

### Fixed
- **AI now sees daily data for ALL teammates**, not just the current user. Was sending aggregates for non-current users → Claude correctly complained "I only have 30-day averages for Clara/Cornel". Now `/api/chat`, `/api/patterns`, `/api/story` all ship 30-day daily detail (with journals) for all 3 users. ~+2k input tokens per call.

---

## [v0.5] · Dropped score column + cleanup action + AI nudges · 2026-05-08

### Added
- **Cleanup action** in Apps Script — `?action=cleanup` removes duplicate (date, name) rows from Sheet, keeping the most-complete one
- `/api/sheets/cleanup` route + UI button on `/detail` admin card
- **`<AINudge>` card** on dashboard — rotating 12 playful prompts, click opens chat with prompt pre-sent
- `chatSend(prompt)` global helper — opens panel + dispatches send event
- `<ChatWidget>` accepts `pendingPrompt` prop — auto-sends on mount, calls `onPromptConsumed` to clear

### Changed
- **Schema simplified** from 8 columns to 7 (date | name | sleep_score | rhr | hrv | rem | journal). Removed legacy `score` column.
- "Already logged" warning swapped from amber-warn to friendly blue: "📝 actualizezi datele pentru ... (un singur log/zi · upsert)"
- SETUP.md rewrites Apps Script with full upsert + cleanup actions

---

## [v0.4] · Mobile polish · 2026-05-08

### Added
- **Safe-area utilities** — `.pb-safe`, `.pt-safe` wrap `env(safe-area-inset-*)`. Applied to sticky headers (notch/Dynamic Island), chat composer (home indicator), main page bottom.
- **Tap target class** — `.tap` enforces 36px on mouse, 40px on `pointer: coarse` (touch). Plus focus-visible accent outline.
- `touch-action: manipulation` on all buttons (kills iOS double-tap zoom)
- `overscroll-behavior-y: none` (kills rubber-band)
- Active-state press feedback (instead of hover-scale on touch)

### Changed
- **Hero**: SS headline scales `5xl→7xl→8xl` across breakpoints; sparkline 140×40 mobile, 180×48 desktop; tighter padding on small
- **Leaderboard row**: info chips (RHR · HRV · REM · entries) now `flex-wrap` on small; SS scales `2xl→3xl`; champion banner truncates long names
- **Detail history row**: stacks date+journal-icon on top, metrics below on small screens; side-by-side on `sm+`
- **Chat composer**: text bumped from xs to sm (touch friendly); send button uses arrow SVG icon; `pb-safe` for iOS keyboard
- **Headers**: tighter px/gap on mobile, brand visible, subtitle hidden under md, button text → icons saving ~150px
- Removed mobile-only "📊 detalii" full-width button — replaced by chart icon in header

---

## [v0.3] · Pattern alerts + adjective login + instant feedback + side chat · 2026-05-08

### Added
- **Pattern alerts** — deterministic, no AI cost. `lib/alerts.ts` runs on dashboard mount. Detects:
  - HRV decline 3 days · RHR rise 3 days · REM dip vs personal avg · 2-night SS slump
  - REM personal records · best-week jumps · streak milestones (7/14/30/60/100/365d)
  - Excellent night highlight · low-RHR recovery · streak-about-to-break
- `<AlertsBar>` component — chips at top of dashboard, dismissable per-user with weekly auto-revival
- **UserPicker upgrades** — level + tier badge + streak + data-driven adjective ("REM master", "recovery king", "HRV phenom", "sleep deity", etc), sorted by XP, rotating greeting
- **Instant feedback** after log save — celebration screen with SS hero + REM/RHR/HRV tiles + AI roast generated immediately. Tone color matches mode (celebrate/observe/roast).
- **Side chat panel** — extracted `<ChatWidget>`, mounted globally as `<ChatPanel>` in root layout. Slides in from right on lg+, full-width drawer on mobile. Toggleable via global event from any header. Persists open state in localStorage. Body content shifts left when open on lg+.
- `/chat` URL → redirects home + opens side panel (legacy)

---

## [v0.2] · AI integration · 2026-05-08

### Added
- **Adaptive AI tone** — `/api/roast` picks mode from data:
  - SS≥85 OR REM≥100 → CELEBRATE (🎉 hype + specific compliment)
  - SS 70–84 → OBSERVE (👀 nuance + small nudge)
  - SS<70 → ROAST (🔥 mocking with love + actionable tip)
  - Title icon + accent color match. Cache key includes journal length so adding a note busts cache.
- **Daily journal** — optional 500-char textarea on log entry, stored in 8th Sheet column. Used as context by AI roast for sharper jabs ("ai băut bere — sigur de aia REM-ul a căzut").
- **Pattern finder** — `/api/patterns` analyzes 30 days, returns JSON with `personal` + `team` insights. PatternCard on dashboard, cached per ISO week per user.
- Journal display in detail page history rows with 📝 indicator

---

## [v0.1] · Initial v2 launch · 2026-05-07

Complete rebuild from scratch on Next.js 16 + Tailwind v4. Same Google Sheet backend (preserves all v1 data). Headline metric is REM minutes alongside the existing SS/RHR/HRV trio.

### Added
- **Pages**: `/` (main dashboard), `/detail` (per-user drill-down)
- **API routes**: `/api/sheets` (read/write), `/api/roast` (Haiku 1-liner), `/api/story` (weekly recap), `/api/chat` (conversation)
- **Components**: Hero, Leaderboard (Azi/7zile/Lună/Total tabs + champion banner + medals + fun badges), LogEntry (4 metrics + retroactive date), DetailView, RemEducation, AI blocks, UserPicker, Hero, Avi, Sparkline, Metric, Card, Button, Input
- **Stack**: Next.js 16.2.6 App Router, React 19.2.4, Tailwind v4, Geist + Geist Mono, @anthropic-ai/sdk
- Dark-first theme (light mode toggle), monospace numbers, Linear/Vercel-style tiny uppercase labels
- 3-tier system (Începător / Pro / Maestru) replacing v1's 10-tier overengineering
- Single accent color (lime-600), per-person colors as small dots only

### Cuts vs v1
- 4 navigation tabs → single page + detail
- 10 tiers → 3
- 30 level titles → 0 (just "Lv X")
- Chart.js (60KB) → pure SVG sparklines (~2KB total)
- Streak repair, challenges, habits, oracle, shared duels — all removed
- HighlightReel, BonusSection, ChallengeSection, BonusPopup — deleted dead code

---

## [v1.x] · Original SleepTracker · 2026-02 to 2026-05

The original app at `mpcosmin-mcp/sleep-dashboard` (GitHub Pages, single-file HTML, no AI). Still alive as a read-only archive of pre-REM data. v2 reads the same Sheet so all that data is now in somn too.
