/**
 * AI tool definitions + executors.
 *
 * The chat AI can call these tools to READ and WRITE the user's sleep data.
 * Each tool maps to a server-side operation against the Sheet. When a write
 * tool succeeds, /api/chat sets `mutated=true` so the frontend refetches.
 *
 * Tools are scoped to the CURRENT USER — the chat route resolves "me" from
 * the request body. AI cannot mutate other teammates' data.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { type SleepEntry, NAMES, FIRST_NAME, lastNDays } from '@/lib/sleep';
import { SHEETS_API } from '@/lib/config';

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'save_sleep',
    description: `Salvează sau actualizează datele de somn ale userului curent pentru o anumită dată.

USE WHEN:
- User zice "logează că am dormit X" / "salvează SS 78 azi" / "ieri am avut REM 95"
- User vrea să UPDATE-uieze un câmp existent ("schimbă jurnalul de pe 7 mai")
- User vrea să adauge o notă ("notează că am băut bere aseară")

BEHAVIOR (upsert + merge):
- Dacă rândul (date, current_user) NU există → creează unul nou
- Dacă există → MERGE cu cel existent (câmpurile NESPECIFICATE se păstrează)
- Toate câmpurile sunt opționale EXCEPT date

After calling: confirm by repeating what you saved in plain language.`,
    input_schema: {
      type: 'object',
      required: ['date'],
      properties: {
        date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Data în format YYYY-MM-DD. Daca user-ul zice "azi" / "ieri" / "joi", calculează data corectă în funcție de today.',
        },
        ss: { type: 'number', minimum: 0, maximum: 100, description: 'Sleep Score 0-100' },
        rhr: { type: 'number', minimum: 30, maximum: 150, description: 'Resting heart rate in bpm' },
        hrv: { type: 'number', minimum: 0, maximum: 200, description: 'Heart rate variability in ms' },
        rem: { type: 'number', minimum: 0, maximum: 300, description: 'REM sleep in minutes' },
        journal: { type: 'string', maxLength: 500, description: 'Notiță liberă' },
      },
    },
  },
  {
    name: 'delete_sleep',
    description: `Șterge complet rândul de log al userului curent pentru o anumită dată.

USE ONLY WHEN:
- User cere EXPLICIT: "șterge logul de ieri", "elimină datele de pe 5 mai"
- ÎNTOTDEAUNA cere confirmare în plain text ÎNAINTE să apelezi acest tool ("ești sigur?")
- Dacă user-ul confirmă, atunci apelezi tool-ul

After calling: confirm what you deleted.`,
    input_schema: {
      type: 'object',
      required: ['date'],
      properties: {
        date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Data în format YYYY-MM-DD.',
        },
      },
    },
  },
];

/* ─── Executor ─────────────────────────────────────────── */

export interface ToolExecResult {
  toolUseId: string;
  toolName: string;
  /** Stringified result returned to the AI as tool_result content */
  resultContent: string;
  isError: boolean;
  /** True if this tool mutated the DB — used by frontend to trigger refetch */
  mutated: boolean;
  /** Short human label for the action chip in chat ("✓ salvat SS 78 pentru azi") */
  actionLabel?: string;
}

/**
 * Execute a single tool call from the AI. Scoped to `user` — all writes are
 * for THIS user only, regardless of what the AI tries.
 */
export async function executeTool({
  toolUseId,
  toolName,
  input,
  user,
  entries,
}: {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  user: string;
  entries: SleepEntry[];
}): Promise<ToolExecResult> {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  try {
    if (toolName === 'save_sleep') {
      const date = String(input.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format');

      // MERGE with existing if any
      const existing = entries.find(e => e.date === date && e.name === user);
      const merged: SleepEntry = {
        date,
        name: user,
        ss:   input.ss   != null ? Number(input.ss)   : existing?.ss   ?? 0,
        rhr:  input.rhr  != null ? Number(input.rhr)  : existing?.rhr  ?? 0,
        hrv:  input.hrv  != null ? Number(input.hrv)  : existing?.hrv  ?? null,
        rem:  input.rem  != null ? Number(input.rem)  : existing?.rem  ?? null,
        journal: input.journal != null ? String(input.journal) : existing?.journal ?? null,
      };

      // Sanity check: a brand-new entry must have at least SS
      if (!existing && merged.ss === 0 && input.ss == null) {
        throw new Error('Pentru un log nou ai nevoie cel puțin de SS. Întreabă user-ul.');
      }

      // Write via Apps Script
      const params = new URLSearchParams({
        action: 'write',
        date: merged.date,
        name: merged.name,
        sleep_score: String(merged.ss),
        rhr: String(merged.rhr),
        hrv: merged.hrv == null ? '' : String(merged.hrv),
        rem: merged.rem == null ? '' : String(merged.rem),
        journal: merged.journal ?? '',
      });
      const res = await fetch(`${SHEETS_API}?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Sheets API ${res.status}`);

      // Build human-readable confirmation chip
      const changedFields: string[] = [];
      if (input.ss != null) changedFields.push(`SS ${merged.ss}`);
      if (input.rem != null) changedFields.push(`REM ${merged.rem}m`);
      if (input.rhr != null) changedFields.push(`RHR ${merged.rhr}`);
      if (input.hrv != null) changedFields.push(`HRV ${merged.hrv}`);
      if (input.journal != null) changedFields.push('jurnal');
      const action = existing ? 'actualizat' : 'salvat';
      const label = `✓ ${action} ${changedFields.join(', ')} pentru ${date}`;

      return {
        toolUseId,
        toolName,
        resultContent: JSON.stringify({
          ok: true,
          mode: existing ? 'update' : 'create',
          entry: merged,
        }),
        isError: false,
        mutated: true,
        actionLabel: label,
      };
    }

    if (toolName === 'delete_sleep') {
      const date = String(input.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format');

      const existing = entries.find(e => e.date === date && e.name === user);
      if (!existing) {
        return {
          toolUseId,
          toolName,
          resultContent: JSON.stringify({ ok: false, reason: 'no_such_entry' }),
          isError: false,
          mutated: false,
          actionLabel: `nu există log pentru ${fn} pe ${date}`,
        };
      }

      const params = new URLSearchParams({
        action: 'delete',
        date,
        name: user,
      });
      const res = await fetch(`${SHEETS_API}?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Sheets API ${res.status}`);

      return {
        toolUseId,
        toolName,
        resultContent: JSON.stringify({ ok: true, deleted: date }),
        isError: false,
        mutated: true,
        actionLabel: `🗑 șters logul pentru ${date}`,
      };
    }

    throw new Error(`Tool necunoscut: ${toolName}`);
  } catch (err) {
    return {
      toolUseId,
      toolName,
      resultContent: err instanceof Error ? err.message : 'unknown error',
      isError: true,
      mutated: false,
      actionLabel: `⚠ eroare: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

/* ─── Helpers ─────────────────────────────────────────── */

/** Build the system prompt with team data + user identity for the chat route */
export function buildSystemPrompt(user: string, entries: SleepEntry[]): string {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const dayShort = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm'];
  const today = new Date().toISOString().slice(0, 10);

  const formatPerson = (name: string) => {
    const fnN = FIRST_NAME[name] ?? name.split(' ')[0];
    const theirs = lastNDays(entries.filter(e => e.name === name), 30)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!theirs.length) return `${fnN}: zero loguri în ultimele 30 zile`;
    const lines = theirs.map(e => {
      const d = new Date(e.date + 'T12:00:00');
      const dn = dayShort[d.getDay()];
      const j = e.journal ? ` · "${e.journal.replace(/\s+/g, ' ').replace(/"/g, "'").slice(0, 100)}"` : '';
      return `  ${e.date} ${dn}: SS ${e.ss}, RHR ${e.rhr}, HRV ${e.hrv ?? '—'}, REM ${e.rem ?? '—'}${j}`;
    });
    return `${fnN} (${theirs.length} loguri):\n${lines.join('\n')}`;
  };

  const teamSections = NAMES.map(formatPerson).join('\n\n');

  return `Ești somn ai — asistent prietenos pentru echipa IT din Sibiu (Clara, Petrica, Cornel).
Userul curent (cu care vorbești): **${fn}** (${user}). Azi e ${today}.

═══════════ DATE ECHIPĂ (zilnic, ultimele 30 zile) ═══════════

${teamSections}

═══════════════════════════════════════════════════════════════

POȚI APELA TOOL-URI:
- **save_sleep** — salvează/actualizează loguri pentru ${fn}. Upsert + merge: dacă rândul (date, ${fn}) există, câmpurile NESPECIFICATE se păstrează. NU specifica un câmp dacă user-ul nu a menționat o valoare pentru el.
- **delete_sleep** — șterge un log al lui ${fn}. Înainte de a apela, CERE confirmare explicită în plain text și AȘTEAPTĂ răspunsul.

REGULI:
- Răspunde în română, ton prieten-tehnic, casual + roasty când e cazul
- Folosește numerele REALE din date — niciodată inventate
- Toolurile mutează DOAR datele lui ${fn} (nu poți schimba Clara sau Cornel)
- După un tool succes, confirmă în plain text ce-ai făcut
- Dacă user-ul vrea ceva ambiguu ("logează un score bun"), CERE clarificare
- Convertește limbaj natural în date concrete: "azi"=${today}, "ieri"=${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}, etc
- Pentru creare de log NOU, ai nevoie cel puțin de SS — dacă lipsește, întreabă

Răspuns concis, 1-4 propoziții decât dacă user-ul cere mai mult.`;
}
