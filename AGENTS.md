<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Workflow rule — ALWAYS preview before push

The user explicitly set this rule: **whenever we make a change, preview locally and let the user verify BEFORE pushing to remote**. No exceptions, no batching commits and pushing in one go.

The exact sequence for any code change:

1. **Make the edit(s).** Small, focused commits — one logical change at a time.
2. **`npm run build`** to catch TypeScript / type errors.
3. **`mcp__Claude_Preview__preview_start({ name: "somn-dev" })`** to spin up the dev server from `.claude/launch.json` (port 3000). It reuses the server if already running — safe to call repeatedly.
4. **Take a screenshot** with `mcp__Claude_Preview__preview_screenshot` to visually verify the change. Also `preview_logs` (level: "error") to confirm no runtime errors.
   - **Fallback when screenshot times out** (Windows headless can be flaky): use `preview_eval` with a small DOM-query expression to read back the actual rendered content — labels, values, presence of key elements. This is often MORE precise than a screenshot because you inspect actual text/state, not pixels. Example:
     ```js
     // Verify TopBar + KPI cards rendered with real data
     const q = (s) => document.querySelector(s);
     const all = (s) => Array.from(document.querySelectorAll(s));
     ({
       topBar: !!q('header') && q('header a span.num')?.textContent,
       kpis: all('.kpi.card').map(c => ({
         label: c.querySelector('.label')?.textContent,
         value: c.querySelector('.num.font-bold.leading-none')?.textContent,
       })),
       bodySnippet: document.body.innerText.slice(0, 300),
     })
     ```
   - Also check `preview_console_logs` (level: "error") for client-side runtime errors.
5. **Present the screenshot + a short summary** to the user. Wait for explicit approval ("ok push", "merge it", "looks good") OR feedback to iterate.
6. **Only after approval:** commit, then `git push origin master`.

**Do NOT skip step 5.** Even if the build passes, even if you're sure, the user wants to see it before it lands on the live deploy. The whole reason for this workflow is to catch visual regressions BEFORE Vercel auto-deploys to production.

**Iteration path:** if the user asks for changes, edit → rebuild (if needed) → re-screenshot → present again. The dev server stays running between iterations (Turbopack handles HMR).

**When to stop the preview server:** at the end of a session, OR when switching to a different project. Use `mcp__Claude_Preview__preview_stop` with the serverId.

## Design language (locked)

This project uses the **somn masterpiece** UI. Global skill: `~/.claude/skills/masterpiece-ui/SKILL.md`. Don't drift from it — slate 950 base, indigo accent, slim TopBar with profile popover, floating chat bubble with always-visible label, KPI cards with glowing colored bottom borders, single scrolling page.

## When in doubt

- For data/types: `src/lib/sleep.ts` is the source of truth.
- For UI components: `src/components/dashboard/` (feature) and `src/components/ui/` (primitives).
- For layout: `src/components/layout/{app-shell,top-bar,profile-popover}.tsx`.
- For AI calls: `src/app/api/{chat,vibe,patterns,story,roast}/route.ts` + `src/lib/ai-tools.ts`.

