# somn · sleep tracker

> **Production:** https://somn-xi.vercel.app

Sleep tracker for IT people who care about REM, RHR, HRV — and being roasted by Claude every morning.

Three users, one Google Sheet, single-page Next.js, deployed on Vercel. Dark mode by default because we live in dark mode.

**Documentation:**
- [SETUP.md](./SETUP.md) — one-time setup checklist (API key, env vars, Sheet schema, Apps Script)
- [BLUEPRINT.md](./BLUEPRINT.md) — full architecture, patterns, lessons, reusable recipes for future builds
- [CHANGELOG.md](./CHANGELOG.md) — release history

## Stack

- **Next.js 16** App Router + React 19
- **Tailwind CSS v4** + Geist fonts
- **Claude Haiku 4.5** via `@anthropic-ai/sdk` for daily roasts and weekly stories
- **Google Sheets** as backend (via existing Apps Script endpoint)
- **Vercel** for hosting + automatic deploys

## What's in the box

- **Main page (`/`)** — REM headline number, team row with sparklines, AI daily roast, expandable weekly story
- **Detail page (`/detail`)** — per-user drill-down with 7d/30d/all-time sparklines, XP/level, history table, REM education tips
- **Log entry** — inline 4-field form (SS, REM, RHR, HRV), supports retroactive dates
- **No auth** — 3-name picker stored in localStorage. Trust-based, like v1

## Local dev

```bash
npm install
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000

## Deploy

Push to GitHub → import in Vercel → add env vars → done.

See [SETUP.md](./SETUP.md) for the one-time setup checklist (API key, env vars, Apps Script REM column).

## Migrating from v1

- Same Google Sheet — old data preserved
- New `rem` column added; old rows show `—`
- v1 still lives at the existing GitHub Pages URL (read-only archive)

## Architecture

```
src/
├── app/
│   ├── page.tsx              # main dashboard
│   ├── detail/page.tsx       # per-user drill-down
│   ├── api/
│   │   ├── sheets/           # GET all entries, POST new
│   │   ├── roast/            # POST → Claude Haiku 1-liner
│   │   └── story/            # POST → Claude Haiku weekly recap
│   ├── layout.tsx
│   └── globals.css           # design tokens
├── components/
│   ├── ui/                   # Button, Card, Avi, Sparkline, Metric, Input
│   └── dashboard/            # Hero, TeamRow, LogEntry, DetailView, AI blocks, REM tips
└── lib/
    ├── sleep.ts              # types, color helpers, aggregate
    ├── gamify.ts             # XP = logs×10 + SS bonus, 3-tier system
    ├── client-api.ts         # /api/* fetchers
    ├── config.ts             # server-side env reads
    ├── user.ts               # localStorage user picker
    └── utils.ts              # cn(), date formatters, week keys
```
