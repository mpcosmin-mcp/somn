# AI-Powered Dashboard Template

> ⚠️ **STALE + ~7K tokens. Do NOT whole-file read.** somn's AI coach was REMOVED — this template describes the old AI-edits-data architecture that no longer exists in somn. Kept as a generic reference for FUTURE AI-dashboard builds only. For current somn state: read `EOD.md` or grep a section.

> Full-stack template for building dashboards where users talk to AI and **the AI can read AND edit the data**, with the UI updating instantly to reflect the changes.
>
> Battle-tested in [somn](https://somn-xi.vercel.app). Reusable for habit trackers, finance dashboards, fitness logs, project trackers, anything CRUD + chat.

---

## What this enables

- User opens dashboard → sees their data
- User types in chat: *"șterge logul de marți, am greșit valorile"* → AI deletes the entry → dashboard refreshes → entry is gone
- User types: *"hai notează 50 minute de cardio acum"* → AI writes the entry → dashboard refreshes → row appears
- User types: *"care a fost ziua mea cea mai prostă?"* → AI reads, analyzes, replies in plain language

The chat is not a separate tool. It's an interface to the same data the dashboard shows. **AI talks AND acts.**

---

## The Big Picture

```
                                ┌────────────────────────────┐
                                │  USER                       │
                                │  ─────                       │
                                │  Sees dashboard. Types in    │
                                │  chat. Sees changes.         │
                                └─────────────┬──────────────┘
                                              │
                       ┌──────────────────────▼─────────────────────────┐
                       │  FRONTEND (Next.js + React)                    │
                       │  ────────────────────────                      │
                       │  • Reads data via /api/data                    │
                       │  • Sends chat turns to /api/chat               │
                       │  • REFETCHES data after AI mutation             │
                       │  • Shows tool-call indicators in chat UI        │
                       └────────────┬───────────┬───────────────────────┘
                                    │           │
                          fetch     │           │ fetch (long-lived)
                                    │           │
       ┌────────────────────────────▼───┐ ┌─────▼────────────────────────────┐
       │  /api/data (Next.js route)     │ │  /api/chat (Next.js route)        │
       │  ───────────────────────       │ │  ─────────────────────            │
       │  GET    → list                 │ │  Receives messages.               │
       │  POST   → create / upsert      │ │  Calls Anthropic with TOOLS.      │
       │  DELETE → remove               │ │  AI returns tool_use → executes   │
       │                                │ │  same DB ops as /api/data.        │
       └─────────────┬──────────────────┘ │  Returns assistant text + actions │
                     │                    └────────────┬────────────────────┘
                     │                                 │
                     └──────────────┬──────────────────┘
                                    │
                            ┌───────▼────────────────┐
                            │  REPOSITORY (db.ts)    │
                            │  ──────────────────    │
                            │  Single interface:      │
                            │    list, create,        │
                            │    update, remove       │
                            │  Implementation         │
                            │  swappable.             │
                            └───────┬────────────────┘
                                    │
                ┌───────────────────┼───────────────────────┐
                │                   │                       │
       ┌────────▼─────┐ ┌──────────▼──────┐ ┌───────────────▼──────┐
       │ Google Sheets │ │ Supabase / Pg  │ │ SQLite / Turso       │
       │ (somn)        │ │ (most apps)    │ │ (edge-friendly)      │
       └──────────────┘ └────────────────┘ └─────────────────────┘
```

The trick is the **Repository** abstraction. AI's tools and the frontend's data routes both go through it. Swap the DB without touching anything else.

---

## Stack

**Recommended (this template assumes):**
- **Next.js 16** App Router — API routes co-located with UI
- **TypeScript** — types catch tool/schema mismatches at compile time
- **Tailwind v4** — design tokens via `@theme inline`
- **@anthropic-ai/sdk** — for `messages.create` with `tools`
- **Vercel** — auto-deploy from Git, free tier covers most small apps

**Database options (pick one):**
| Option | Why use it | Why skip |
|---|---|---|
| Google Sheets + Apps Script | Zero setup, free, team-friendly UI | Slow writes, no real-time, no schema |
| Supabase | Postgres, realtime, auth, free tier | Setup overhead, harder local dev |
| Turso (libSQL) | SQLite at edge, ultra-fast reads | Less mature ecosystem |
| Plain JSON file in repo | Easiest possible | No multi-user, no concurrency |

This template uses **Google Sheets** as the running example (somn-style) but every layer's abstraction works the same with the others.

---

## Layer 1 — Data (the Repository)

The single source of truth that both frontend reads AND AI writes go through.

```ts
// src/lib/repo.ts
export interface Entry {
  id: string;          // unique row ID
  date: string;        // YYYY-MM-DD
  // ...your domain fields
}

export interface Repository {
  list(): Promise<Entry[]>;
  get(id: string): Promise<Entry | null>;
  create(input: Omit<Entry, 'id'>): Promise<Entry>;
  update(id: string, input: Partial<Entry>): Promise<Entry>;
  remove(id: string): Promise<void>;
}

// Pick one implementation:
export { sheetsRepo as repo } from './repo-sheets';
// export { supabaseRepo as repo } from './repo-supabase';
// export { sqliteRepo as repo } from './repo-sqlite';
```

### Sheets implementation

```ts
// src/lib/repo-sheets.ts
import type { Repository, Entry } from './repo';

const SHEETS_URL = process.env.SHEETS_API_URL!;

export const sheetsRepo: Repository = {
  async list() {
    const r = await fetch(`${SHEETS_URL}?v=${Date.now()}`, { cache: 'no-store' });
    const json = await r.json() as { data: RawRow[] };
    return json.data.map(rowToEntry);
  },

  async get(id: string) {
    const all = await this.list();
    return all.find(e => e.id === id) ?? null;
  },

  async create(input) {
    const id = `${input.date}::${crypto.randomUUID().slice(0, 8)}`;
    const entry: Entry = { id, ...input };
    const params = new URLSearchParams({
      action: 'write', id, ...stringifyEntry(entry),
    });
    await fetch(`${SHEETS_URL}?${params}`);
    return entry;
  },

  async update(id, input) {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Entry ${id} not found`);
    const merged = { ...existing, ...input };
    const params = new URLSearchParams({
      action: 'write', ...stringifyEntry(merged),
    });
    await fetch(`${SHEETS_URL}?${params}`);
    return merged;
  },

  async remove(id: string) {
    await fetch(`${SHEETS_URL}?action=delete&id=${encodeURIComponent(id)}`);
  },
};
```

### Apps Script (the actual DB engine)

```javascript
// In your Google Sheet → Extensions → Apps Script
const SHEET = 'Sheet1';

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
  const json = obj => ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  if (e.parameter.action === 'write') {
    upsert(sheet, e.parameter);
    return json({ ok: true });
  }
  if (e.parameter.action === 'delete') {
    deleteRow(sheet, e.parameter.id);
    return json({ ok: true });
  }
  return json({ data: readAll(sheet) });
}

function upsert(sheet, params) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  const row = headers.map(h => params[h] ?? '');
  let foundIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === params.id) { foundIdx = i + 1; break; }
  }
  if (foundIdx > 0) {
    sheet.getRange(foundIdx, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function deleteRow(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('id');
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idIdx] === id) sheet.deleteRow(i + 1);
  }
}

function readAll(sheet) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}
```

The **`id`** column is critical. Without it you can't update or delete a specific row — you'd have to upsert by content, which is fragile.

---

## Layer 2 — API Routes

Thin HTTP wrapper around the repository. Each route delegates straight to a `repo` method.

```ts
// src/app/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { repo } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ entries: await repo.list() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.id) {
    return NextResponse.json(await repo.update(body.id, body));
  }
  return NextResponse.json(await repo.create(body));
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await repo.remove(id);
  return NextResponse.json({ ok: true });
}
```

Two design rules:
1. **API routes never call other API routes** — they call `repo` directly. Avoids HTTP round-trips and keeps stack traces clean.
2. **AI tools call `repo` too**, not these routes. Same logic, no proxying.

---

## Layer 3 — AI with Tools (the magic)

This is where AI gets superpowers. Anthropic's tool calling lets the model declare *"I want to call this function with these args"*, the server executes it, returns the result, and the AI continues the conversation.

### Define tools as JSON schema

```ts
// src/lib/ai-tools.ts
import { repo, type Entry } from './repo';
import Anthropic from '@anthropic-ai/sdk';

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_entries',
    description: 'Returns all entries for the current user, most recent first.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default 30)' },
      },
    },
  },
  {
    name: 'create_entry',
    description: 'Creates a new entry. Use when the user says "log X", "save Y", "adaugă Z".',
    input_schema: {
      type: 'object',
      required: ['date', 'value'],
      properties: {
        date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        value: { type: 'number' },
        note: { type: 'string', description: 'Optional free text' },
      },
    },
  },
  {
    name: 'update_entry',
    description: 'Updates fields on an existing entry. Use when the user says "schimbă X", "actualizează Y".',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        value: { type: 'number' },
        note: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_entry',
    description: 'Permanently removes an entry. Confirm with the user before calling this if the action is destructive.',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  },
];

/** Map a tool call to the repository. AI sends `name` + `input` → we execute. */
export async function executeTool(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'list_entries':
      return (await repo.list()).slice(0, (input.limit as number) ?? 30);
    case 'create_entry':
      return await repo.create(input as Omit<Entry, 'id'>);
    case 'update_entry':
      return await repo.update(input.id as string, input);
    case 'delete_entry':
      await repo.remove(input.id as string);
      return { ok: true };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

### The chat route — the agentic loop

```ts
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from '@/lib/ai-tools';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an assistant for a sleep tracker dashboard.
You can read AND modify the user's data using the provided tools.
- When the user asks a question, fetch data with list_entries first.
- When the user says "log/save/add", call create_entry.
- When the user says "change/update", call update_entry.
- When the user says "delete/remove", confirm in plain text first, then call delete_entry.
Reply concisely in Romanian.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json() as { messages: ChatMessage[] };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Anthropic message format with tools
  const conversation: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let mutated = false;     // tracks whether any write tool ran
  let safetyCounter = 0;   // bound the agentic loop (max 8 iterations)

  while (safetyCounter++ < 8) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: conversation,
    });

    // If the model wants to use tools, execute them and feed back the results
    if (response.stop_reason === 'tool_use') {
      // Add the assistant's tool_use turn to conversation
      conversation.push({ role: 'assistant', content: response.content });

      // Execute each tool block, build tool_result blocks
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const writes = ['create_entry', 'update_entry', 'delete_entry'];
        if (writes.includes(block.name)) mutated = true;
        try {
          const result = await executeTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: err instanceof Error ? err.message : 'unknown error',
            is_error: true,
          });
        }
      }
      // Feed tool results back to the model and loop
      conversation.push({ role: 'user', content: toolResults });
      continue;
    }

    // No more tool calls — collect final text
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return NextResponse.json({ text, mutated });
  }

  return NextResponse.json({ text: 'Loop limit reached.', mutated });
}
```

The key insight is the **`mutated`** flag. The frontend uses it to know when to refetch data.

---

## Layer 4 — Frontend (chat that triggers refetch)

```tsx
// src/app/page.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChatWidget } from '@/components/chat-widget';
import { Dashboard } from '@/components/dashboard';
import type { Entry } from '@/lib/repo';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const r = await fetch('/api/data', { cache: 'no-store' });
    const json = await r.json() as { entries: Entry[] };
    setEntries(json.entries);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <main>
      {loading ? <div>Loading…</div> : <Dashboard entries={entries} />}
      <ChatWidget onMutated={refetch} />
    </main>
  );
}
```

```tsx
// src/components/chat-widget.tsx
'use client';
import { useState } from 'react';

interface Msg { role: 'user' | 'assistant'; content: string }

export function ChatWidget({ onMutated }: { onMutated: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');

  async function send() {
    const next: Msg[] = [...messages, { role: 'user', content: input }];
    setMessages(next);
    setInput('');

    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next }),
    });
    const json = await r.json() as { text: string; mutated: boolean };

    setMessages([...next, { role: 'assistant', content: json.text }]);

    // ⚡ THE KEY LINE — if AI mutated data, tell parent to refetch
    if (json.mutated) onMutated();
  }

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.role === 'user' ? '🧑' : '🤖'} {m.content}</div>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="ask or tell me to do something…"
      />
    </div>
  );
}
```

That's the whole loop. User types → backend AI may call tools → if tools mutated state, frontend refetches → dashboard updates. **Instant.**

---

## Layer 5 — Sync (making changes visible instantly)

The pattern above (refetch after each AI turn) works for single-user apps. Here are upgrades when you need more:

### Optimistic updates

If you know exactly what the AI will do (e.g., the user explicitly said "delete entry X"), update the UI before the server replies:

```tsx
async function send() {
  // Try to predict the mutation locally
  if (input.match(/sterge|delete/i)) {
    const guessId = findEntryByContext(messages, entries);
    if (guessId) {
      setEntries(prev => prev.filter(e => e.id !== guessId));  // optimistic
    }
  }
  // Then call the API as before, refetch confirms
}
```

### Multi-user: realtime database

Switch the repository to a realtime backend (Supabase, Firestore) and subscribe in the frontend:

```tsx
useEffect(() => {
  const channel = supabase.channel('entries')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' },
        () => refetch())
    .subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

Now any user's change (or the AI's) propagates to all clients instantly without polling.

### Server-Sent Events (middle ground)

For Sheets-backed apps you can't use Supabase realtime. Add a `/api/events` SSE endpoint that pings clients when a write happens. Or just refetch on `window.focus()` and after every chat turn.

---

## Confirmation pattern (don't let AI delete things blindly)

For destructive actions (delete, bulk update, sending emails), the AI should **ask first** rather than execute immediately. Two patterns:

### Pattern A — soft prompt in tool description

```ts
{
  name: 'delete_entry',
  description: 'Removes an entry. ALWAYS ask the user "ești sigur?" in plain text BEFORE calling this tool. Only call it after the user explicitly confirms.',
  input_schema: { /* ... */ },
}
```

This works well for Haiku/Sonnet — they respect the instruction.

### Pattern B — frontend approval gate

If you want hard guarantees, add a confirmation step in the UI:

```ts
// In /api/chat route — for destructive tools, return a "pending action"
if (block.name === 'delete_entry' && !req.body.confirmed) {
  return NextResponse.json({
    text: response.content.find(c => c.type === 'text')?.text,
    pendingAction: { tool: block.name, input: block.input, id: block.id },
  });
}

// Frontend shows "AI wants to delete X. [Confirm] [Cancel]"
// On confirm, repost with `confirmed: true` and the same messages
```

Pattern A is simpler, Pattern B is bulletproof. Pick based on consequences.

---

## Cost monitoring

Tools loops can spiral. Add safety:

1. **Loop counter**: max 8 tool iterations per turn (in the example above)
2. **Token budget**: cap `max_tokens` and check `response.usage` per turn
3. **Log every call**: write `{turn, model, input_tokens, output_tokens, tools_called}` to a Sheet or Supabase table
4. **Set alerts**: if monthly Anthropic spend > $X, send email/Telegram

Haiku 4.5 reality (per turn):
- Simple chat (no tools): ~$0.003
- Tools loop with 2 calls: ~$0.008
- Worst case (loop hits limit of 8): ~$0.05

For a 3-user team using AI heavily: $1–3/month total.

---

## Security

| Threat | Mitigation |
|---|---|
| API key leaked to browser | Keep `process.env.ANTHROPIC_API_KEY` server-side only. Never import in client components. |
| Anyone can mutate via `/api/chat` | Add auth (NextAuth, Clerk) OR restrict to a known set of users in middleware |
| AI escalates to dangerous actions | Don't expose tools you wouldn't trust the AI with — e.g. no `delete_all` or `send_email_to(addr)` without explicit user-typed approval |
| Tool input injection (LLM-side) | Use strict JSON schema with `pattern`, `enum`, `minimum`, `maximum`. Validate again server-side. |
| Cost overrun | Loop counter + token caps + monthly alerts |
| Race conditions on Sheets writes | Apps Script serializes its execution — for higher load apps, use Supabase with row-level locks |

---

## Starter Checklist (new dashboard in ~1 hour)

1. **Scaffold**: `npx create-next-app@latest myapp --typescript --tailwind --app --src-dir`
2. **Install AI SDK**: `npm i @anthropic-ai/sdk clsx tailwind-merge`
3. **Pick DB**: Sheet → copy the Apps Script above, deploy as web app
4. **Set env**: `ANTHROPIC_API_KEY=sk-...` and `SHEETS_API_URL=...` in `.env.local`
5. **Build the repo**: `src/lib/repo.ts` (interface) + `src/lib/repo-sheets.ts` (impl)
6. **Build the API**: `src/app/api/data/route.ts` for CRUD
7. **Define tools**: `src/lib/ai-tools.ts` mapping AI tool names to repo methods
8. **Build chat route**: `src/app/api/chat/route.ts` with the agentic loop
9. **Build the frontend**: a page that fetches `/api/data` and renders. A `<ChatWidget>` that calls `/api/chat` and triggers refetch on `mutated`.
10. **Deploy**: `gh repo create` → import in Vercel → set env vars → done

For somn-quality polish, add (from the [BLUEPRINT.md](./BLUEPRINT.md)):
- Theme system + design tokens
- Loading skeletons + error boundary + 404 page
- Mobile safe-area utilities + tap-target class
- PWA manifest + custom favicon + OG image
- Stagger entrance animations
- Pattern alerts (deterministic, no AI cost)
- Adaptive AI tone via mode dispatching

---

## Walk-through: Building a Workout Tracker in 30 minutes

Concrete example using this template.

**1. Define the entry shape (`src/lib/repo.ts`)**

```ts
export interface Entry {
  id: string;
  date: string;          // YYYY-MM-DD
  exercise: string;      // "bench", "squat", "run-5k"
  reps?: number;
  weight_kg?: number;
  duration_min?: number;
  note?: string;
}
```

**2. Sheet headers** (row 1):
```
id | date | exercise | reps | weight_kg | duration_min | note
```

**3. Tools (`src/lib/ai-tools.ts`)** — adapt the example:

```ts
export const TOOLS = [
  {
    name: 'list_workouts',
    description: 'Returns recent workouts, most recent first.',
    input_schema: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'log_workout',
    description: 'Save a workout. Use when user says "tocmai am făcut 4×10 bench la 80kg".',
    input_schema: {
      type: 'object',
      required: ['date', 'exercise'],
      properties: {
        date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        exercise: { type: 'string' },
        reps: { type: 'number' },
        weight_kg: { type: 'number' },
        duration_min: { type: 'number' },
        note: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_workout',
    description: 'Remove a workout. Confirm before calling.',
    input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
];
```

**4. System prompt:**

```
Ești un asistent pentru un tracker de antrenamente. User-ul vorbește în română.
Când zice "am făcut X" → log_workout cu data de azi.
Când zice "câte squat-uri am făcut săptămâna asta?" → list_workouts și calculezi.
Confirmă înainte să ștergi.
```

**5. Frontend** — same pattern as Layer 4 above. Done.

User types: *"acum am făcut 5 km de alergare în 28 min"*
- AI calls `log_workout({date: '2026-05-08', exercise: 'run-5k', duration_min: 28})`
- Server writes to Sheet
- Returns `mutated: true`
- Frontend refetches, the row appears in the dashboard
- AI replies: *"salvat — 5 km în 28 min e un pace de 5:36/km, nu-i rău. Continuă."*

That's it. **30 minutes.**

---

## TL;DR

1. **Repository** abstracts the DB. Implementations are swappable.
2. **API routes** delegate to the repo (no proxying).
3. **AI tools** call the same repo, server-side. Anthropic SDK handles the tool-use loop.
4. **Frontend** refetches when the chat response says `mutated: true`. User sees changes instantly.
5. **Confirmation patterns** stop AI from deleting blindly.
6. **Cost** is trivial with Haiku — under $5/month for small teams.

Copy this template, swap the domain (`Entry` shape + tool list + system prompt), ship in an afternoon.
