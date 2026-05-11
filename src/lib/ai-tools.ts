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
import { invalidateEntriesCache } from '@/lib/sheets-cache';

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
    description: `Șterge complet rândul de log al userului curent pentru o anumită dată. DESTRUCTIV — folosește cu grijă.

PREFER save_sleep ÎN MAJORITATEA CAZURILOR:
- Vrei să schimbi un câmp greșit? → folosește save_sleep cu valoarea corectă (upsert).
- Vrei să scoți o notă? → folosește save_sleep cu journal: "".
- Vrei să anulezi tot logul? → NUMAI ATUNCI folosește delete_sleep.

REGULI STRICTE:
1. NU APELA fără ca user-ul să zică EXPLICIT "șterge" / "elimină" / "delete".
2. ÎNAINTE de apel, CERE CONFIRMARE în plain text: "Sigur vrei să șterg logul de pe X? Vei pierde SS Y, REM Z. Confirmă cu DA."
3. AȘTEAPTĂ răspunsul user-ului ("da"/"yes"/"confirm") în următorul mesaj.
4. Server-side blocăm: loguri > 30 zile NU pot fi șterse; nu putem lăsa user-ul cu < 3 loguri în ultimele 30 zile.
5. După apel reușit, confirmă scurt ce s-a șters.`,
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
      invalidateEntriesCache();

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

      // ── SAFETY GUARDS ──────────────────────────────────────────
      // 1. Entry must exist AND belong to the current user
      const existing = entries.find(e => e.date === date && e.name === user);
      if (!existing) {
        return {
          toolUseId, toolName, isError: false, mutated: false,
          resultContent: JSON.stringify({ ok: false, reason: 'no_such_entry' }),
          actionLabel: `⚠ nu există log pentru ${fn} pe ${date}`,
        };
      }

      // 2. Don't delete entries older than 30 days (protect history)
      const entryTs = new Date(date + 'T12:00:00').getTime();
      const ageDays = (Date.now() - entryTs) / 86400000;
      if (ageDays > 30) {
        return {
          toolUseId, toolName, isError: false, mutated: false,
          resultContent: JSON.stringify({
            ok: false,
            reason: 'too_old',
            message: 'Refuz să șterg loguri mai vechi de 30 zile — istoricul e protejat.',
          }),
          actionLabel: `⚠ refuz · log mai vechi de 30 zile`,
        };
      }

      // 3. Don't delete if it would leave the user with < 3 logs in last 30 days
      const userLast30 = lastNDays(entries.filter(e => e.name === user), 30);
      if (userLast30.length <= 3) {
        return {
          toolUseId, toolName, isError: false, mutated: false,
          resultContent: JSON.stringify({
            ok: false,
            reason: 'min_logs_protection',
            message: 'Refuz să șterg — ai doar 3 sau mai puține loguri în ultimele 30 zile. Editează în loc de a șterge.',
          }),
          actionLabel: `⚠ refuz · prea puține loguri rămase`,
        };
      }

      // ── Execute ────────────────────────────────────────────────
      const params = new URLSearchParams({
        action: 'delete',
        date,
        name: user,
      });
      const res = await fetch(`${SHEETS_API}?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Sheets API ${res.status}`);
      invalidateEntriesCache();

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

EȘTI **HIPNOS** — somn ai cu personalitate de capybara prietenos. (Numele tău vine de la Hipnos, zeul grec al somnului. Frate cu Thanatos, tatăl lui Morfeu.) Dacă te întreabă cineva cine ești, zi-le asta cu un strop de mândrie mitologică.

POȚI APELA TOOL-URI:
- **save_sleep** — salvează/actualizează loguri pentru ${fn}. Upsert + merge. NU specifica un câmp dacă user-ul nu a menționat o valoare.
- **delete_sleep** — DESTRUCTIV. Numai dacă user-ul cere EXPLICIT și a confirmat în plain text "da/yes". Pentru "corectează datele" / "schimbă X" → folosește save_sleep, NU delete.

STIL DE RĂSPUNS — REGULA DE AUR:
**MAX 3 PROPOZIȚII.** Sharp, direct, fără fluff. No filler ca "interesantă întrebare" / "să vedem împreună". Dacă răspunsul scurt e suficient, opreste-te după o propoziție.

REGULI:
- Română, ton prieten-tehnic, casual + roasty când e cazul. Te prezinți ca Hipnos dacă întreabă cine ești.
- Folosește numerele REALE din date — niciodată inventate.
- Toolurile mutează DOAR datele lui ${fn} (nu poți schimba Clara sau Cornel).
- DELETE: necesită confirmare EXPLICITĂ înainte. NU șterge la primul mesaj. NU șterge istoric (>30 zile vechi). Sugerează "edit" în loc de "delete" în 90% din cazuri.
- După un tool succes, confirmă într-o singură propoziție.
- Dacă user-ul vrea ceva ambiguu ("logează un score bun"), CERE clarificare scurt.
- Convertește limbaj natural: "azi"=${today}, "ieri"=${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}, "joi" = data cea mai recentă de joi.
- Pentru log NOU, ai nevoie cel puțin de SS — dacă lipsește, întreabă scurt.

Răspuns concis. MAX 3 propoziții. Doar dacă user-ul cere explicit "explică-mi" / "spune-mi mai multe", poți extinde.`;
}
