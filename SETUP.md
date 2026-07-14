# Setup checklist · somn

One-time setup for v2 to be fully functional. ~10 minutes.

---

## 1. Anthropic API key

The AI roasts and weekly stories use Claude Haiku 4.5 (cheap, ~$0.50/month for 3 users).

1. Go to https://console.anthropic.com/settings/keys
2. Create a key, label it `somn-vercel`
3. Copy it — you'll paste it in step 3

---

## 2. Google Sheet — clean schema (9 columns, no `score`)

**Final header row:**

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| `date` | `name` | `sleep_score` | `rhr` | `hrv` | `rem` | `journal` | `start` | `end` |

The legacy `score` column was never used by anything — drop it.

> `start`/`end` = bedtime/wake as `HH:MM` (v3 sleep-time logging). **Format
> columns H and I as Plain Text** (Format → Number → Plain text) — otherwise
> Google coerces "22:36" into a time serial that reads back wrong on a UTC server.

### If you've already started using v2 — fix the Sheet

The current Sheet has confused headers (`score: rem`, shifted columns). Fix:

1. Open the Sheet
2. **Right-click on column F header → Delete column** (this removes the empty `score: rem`)
3. Now columns shift: what was G is now F, what was H is now G
4. Rename the headers in row 1:
   - **F1** → `rem`
   - **G1** → `journal`
5. Done. Data lives in correct columns now.

Verify by checking row 1 reads exactly: `date | name | sleep_score | rhr | hrv | rem | journal | start | end`.

### If starting fresh

Create those 9 headers in row 1, in that order (format `start`/`end` as Plain Text).

### Update the Apps Script — REPLACE the entire file

Open `Extensions → Apps Script` and **replace the whole file** with this. What's new vs. the old version (the hunt fixes, 14 iul 2026):
- **normDate()** — Google coerces `"2026-05-07"` into a Date, so the old upsert's `String(date).slice(0,10)` = `"Wed May 07"` never matched `"2026-05-07"` → it appended a **duplicate** every time and corrections became invisible. Both sides now normalize to `YYYY-MM-DD` before comparing.
- **Merge upsert (keep())** — an update no longer overwrites a field with a blank. A Garmin sync (which sends no journal) can't wipe a hand-written journal; a partial update keeps what it didn't touch.
- **Token on mutations** — `write`/`delete`/`cleanup` require `?token=<TOKEN>`. Reads stay open (the URL is the read capability). Replace `PASTE_YOUR_SHEETS_TOKEN_HERE` with the value of `SHEETS_TOKEN` from Vercel / `.env.local`.
- **LockService** — serializes mutations so two writes can't both append the same row.

```javascript
const SHEET_NAME = 'Sheet1';
const TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

// Shared write token — MUST equal SHEETS_TOKEN in Vercel / .env.local.
const TOKEN = 'PASTE_YOUR_SHEETS_TOKEN_HERE';

// A date cell may be a real Date (Google coerced "2026-05-07") or a string.
// Normalize both to plain YYYY-MM-DD so an upsert's two sides compare equal.
function normDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return s.slice(0, 10);
}

// Keep the existing cell when the incoming value is blank — never wipe a field
// the caller didn't provide (e.g. a Garmin sync sends no journal).
function keep(incoming, existing) {
  return (incoming !== '' && incoming != null) ? incoming : (existing == null ? '' : existing);
}

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const callback = e.parameter.callback;
  const respond = (obj) => {
    const out = JSON.stringify(obj);
    return ContentService.createTextOutput(callback ? callback + '(' + out + ')' : out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  };

  const action = e.parameter.action;
  const isMutation = action === 'write' || action === 'delete' || action === 'cleanup';

  // ─── AUTH — mutations require the shared token ─────────
  if (isMutation && e.parameter.token !== TOKEN) {
    return respond({ status: 'error', error: 'unauthorized' });
  }

  // ─── LOCK — serialize mutations ───────────────────────
  var lock = null;
  if (isMutation) {
    lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (err) { return respond({ status: 'error', error: 'busy' }); }
  }

  try {
    // ─── WRITE (upsert by date+name, merge-preserving) ───
    if (action === 'write') {
      const date = String(e.parameter.date || '');
      const name = String(e.parameter.name || '');
      const sleepScore = parseFloat(e.parameter.sleep_score) || 0;
      const rhr = parseFloat(e.parameter.rhr) || 0;
      const hrv = e.parameter.hrv ? parseFloat(e.parameter.hrv) : '';
      const rem = e.parameter.rem ? parseFloat(e.parameter.rem) : '';
      const journal = String(e.parameter.journal || '');
      const start = String(e.parameter.start || '');
      const end = String(e.parameter.end || '');

      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const dateIdx = headers.indexOf('date');
      const nameIdx = headers.indexOf('name');
      const key = normDate(date) + '::' + name;

      let foundRow = -1, existing = null;
      for (let i = 1; i < data.length; i++) {
        if (normDate(data[i][dateIdx]) + '::' + String(data[i][nameIdx]) === key) {
          foundRow = i + 1; existing = data[i]; break;
        }
      }

      let rowValues;
      if (foundRow > 0) {
        rowValues = [date, name, sleepScore, rhr,
          keep(hrv, existing[4]), keep(rem, existing[5]), keep(journal, existing[6]),
          keep(start, existing[7]), keep(end, existing[8])];
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        rowValues = [date, name, sleepScore, rhr, hrv, rem, journal, start, end];
        sheet.appendRow(rowValues);
      }
      return respond({ status: 'ok', upsert: foundRow > 0 ? 'update' : 'append' });
    }

    // ─── DELETE (by date+name) ────────────────────────────
    if (action === 'delete') {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return respond({ status: 'ok', removed: 0 });
      const headers = data[0];
      const dateIdx = headers.indexOf('date');
      const nameIdx = headers.indexOf('name');
      const key = normDate(e.parameter.date || '') + '::' + String(e.parameter.name || '');
      let removed = 0;
      for (let i = data.length - 1; i >= 1; i--) {
        if (normDate(data[i][dateIdx]) + '::' + String(data[i][nameIdx]) === key) {
          sheet.deleteRow(i + 1); removed++;
        }
      }
      return respond({ status: 'ok', removed });
    }

    // ─── CLEANUP (dedupe by date+name, keep most complete) ─
    if (action === 'cleanup') {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return respond({ status: 'ok', removed: 0 });
      const headers = data[0];
      const dateIdx = headers.indexOf('date');
      const nameIdx = headers.indexOf('name');
      const groups = {};
      for (let i = 1; i < data.length; i++) {
        const d = normDate(data[i][dateIdx]);
        const n = String(data[i][nameIdx] || '');
        if (!d || !n) continue;
        const k = d + '::' + n;
        (groups[k] = groups[k] || []).push(i + 1);
      }
      const toDelete = [];
      Object.keys(groups).forEach(function(k) {
        const idxs = groups[k];
        if (idxs.length <= 1) return;
        let bestIdx = idxs[0], bestScore = -1;
        idxs.forEach(function(idx) {
          const row = data[idx - 1];
          let score = 0;
          for (let c = 0; c < row.length; c++) if (row[c] !== '' && row[c] !== null) score++;
          if (score > bestScore) { bestScore = score; bestIdx = idx; }
        });
        idxs.forEach(function(idx) { if (idx !== bestIdx) toDelete.push(idx); });
      });
      toDelete.sort(function(a, b) { return b - a; });
      toDelete.forEach(function(idx) { sheet.deleteRow(idx); });
      return respond({ status: 'ok', removed: toDelete.length });
    }
  } finally {
    if (lock) lock.releaseLock();
  }

  // ─── READ (open) ──────────────────────────────────────
  const rows = sheet.getDataRange().getValues();
  const data = rows.length < 2 ? [] : (function () {
    const headers = rows[0];
    return rows.slice(1).map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
  })();
  return respond({ status: 'ok', data });
}
```

**Rollout order (avoids breaking prod writes):**
1. First make sure `SHEETS_TOKEN` is set in Vercel (Production) **and** prod has redeployed with it — otherwise prod sends an empty token and the new script would reject writes.
2. Paste the `TOKEN` value into the script (same value as `SHEETS_TOKEN`).
3. **Save** (`Ctrl+S`) → **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**. Keep "Execute as: Me" and "Who has access: Anyone".

> Note: with the merge upsert, an optional field (hrv/rem/journal/start/end) can't be *cleared* by sending it blank — a blank keeps the old value. Clearing a field is done by editing the Sheet directly. This is the deliberate trade that stops the cron from wiping journals.

### One-time cleanup of the existing duplicates

The hunt found ~6 duplicate dates for Petrica (one with 3 rows) from the old date bug. After deploying the new script, run cleanup **once** (it's now auth-gated, so from a terminal):

```
curl -X POST "https://somn-xi.vercel.app/api/sheets/cleanup?key=<CRON_SECRET>"
```

It keeps the most-complete row per (date, name) and returns how many it removed. Future writes upsert correctly, so duplicates won't come back.

---

## 3. Vercel env vars

After the GitHub repo is pushed and Vercel auto-detects it (or after `vercel link`):

1. Go to your project on https://vercel.com/dashboard
2. **Settings → Environment Variables**
3. Add:

| Name | Value | Environments |
|---|---|---|
| `ANTHROPIC_API_KEY` | (paste from step 1) | Production, Preview, Development |

4. Optional, only if you want to override:
   - `ANTHROPIC_MODEL` (default: `claude-haiku-4-5`)
   - `SHEETS_API_URL` (default: existing team Apps Script URL)

5. Trigger a redeploy: `Deployments → ... → Redeploy` (or just push a commit)

---

## 4. Verify

After deploy:

1. Visit your Vercel URL → pick a user → log a number for today
2. Check the Sheet — new row should appear with REM populated
3. Daily roast should appear within ~2-3s on first visit per day (cached after)
4. Weekly story collapsed at the bottom — click to expand

If AI sections show "AI offline", the env var isn't set or the deployment hasn't picked it up yet.

---

## Troubleshooting

**"Eroare la sync" on the dashboard:** The Apps Script URL is unreachable, or it returned non-JSON. Check the Apps Script deployment, make sure it's set to `Execute as: Me` and `Who has access: Anyone`.

**Logs aren't writing:** Check the Apps Script logs (`Executions` tab) for errors. Most often it's the `setValues` call expecting the wrong column count after adding REM.

**AI returns empty:** Check Vercel function logs (`Deployments → ... → Functions`). If you see `401 Unauthorized`, the API key is wrong or expired.

**Old logs show wrong REM:** They shouldn't have any. UI displays `—` when null. If you see garbage, check the Sheet column header is exactly `rem` (lowercase).
