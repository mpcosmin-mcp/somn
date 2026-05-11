# Setup checklist · somn

One-time setup for v2 to be fully functional. ~10 minutes.

---

## 1. Anthropic API key

The AI roasts and weekly stories use Claude Haiku 4.5 (cheap, ~$0.50/month for 3 users).

1. Go to https://console.anthropic.com/settings/keys
2. Create a key, label it `somn-vercel`
3. Copy it — you'll paste it in step 3

---

## 2. Google Sheet — clean schema (7 columns, no `score`)

**Final header row:**

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| `date` | `name` | `sleep_score` | `rhr` | `hrv` | `rem` | `journal` |

The legacy `score` column was never used by anything — drop it.

### If you've already started using v2 — fix the Sheet

The current Sheet has confused headers (`score: rem`, shifted columns). Fix:

1. Open the Sheet
2. **Right-click on column F header → Delete column** (this removes the empty `score: rem`)
3. Now columns shift: what was G is now F, what was H is now G
4. Rename the headers in row 1:
   - **F1** → `rem`
   - **G1** → `journal`
5. Done. Data lives in correct columns now.

Verify by checking row 1 reads exactly: `date | name | sleep_score | rhr | hrv | rem | journal`.

### If starting fresh

Create those 7 headers in row 1, in that order.

### Update the Apps Script — REPLACE the entire file

Open `Extensions → Apps Script` and **replace the whole file** with this. Features:
- 7-column schema (no `score`)
- **Upsert** writes — find existing row by (date, name), update in place; otherwise append
- **Cleanup action** — `?action=cleanup` removes duplicate rows, keeping the most-complete one
- JSONP callback support (kept for backwards compatibility with v1)

```javascript
const SHEET_NAME = 'Sheet1';

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const callback = e.parameter.callback;
  const respond = (obj) => {
    const out = JSON.stringify(obj);
    return ContentService.createTextOutput(callback ? `${callback}(${out})` : out)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  };

  // ─── WRITE (upsert by date+name) ──────────────────────
  if (e.parameter.action === 'write') {
    const date = String(e.parameter.date || '');
    const name = String(e.parameter.name || '');
    const sleepScore = parseFloat(e.parameter.sleep_score) || 0;
    const rhr = parseFloat(e.parameter.rhr) || 0;
    const hrv = e.parameter.hrv ? parseFloat(e.parameter.hrv) : '';
    const rem = e.parameter.rem ? parseFloat(e.parameter.rem) : '';
    const journal = String(e.parameter.journal || '');

    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const dateIdx = headers.indexOf('date');
    const nameIdx = headers.indexOf('name');

    // Find existing row (date+name match)
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      const rowDate = String(data[i][dateIdx] || '');
      const cleanDate = rowDate.length > 10 ? rowDate.slice(0, 10) : rowDate;
      if ((cleanDate === date || rowDate === date) && String(data[i][nameIdx]) === name) {
        foundRow = i + 1;
        break;
      }
    }

    const rowValues = [date, name, sleepScore, rhr, hrv, rem, journal];
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return respond({ status: 'ok', upsert: foundRow > 0 ? 'update' : 'append' });
  }

  // ─── DELETE (remove a single row by date+name) ──────
  if (e.parameter.action === 'delete') {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return respond({ status: 'ok', removed: 0 });
    const headers = data[0];
    const dateIdx = headers.indexOf('date');
    const nameIdx = headers.indexOf('name');
    const targetDate = String(e.parameter.date || '');
    const targetName = String(e.parameter.name || '');
    let removed = 0;
    // Bottom-up to keep indices valid
    for (let i = data.length - 1; i >= 1; i--) {
      const rowDate = String(data[i][dateIdx] || '').slice(0, 10);
      const rowName = String(data[i][nameIdx] || '');
      if (rowDate === targetDate && rowName === targetName) {
        sheet.deleteRow(i + 1);
        removed++;
      }
    }
    return respond({ status: 'ok', removed });
  }

  // ─── CLEANUP (remove duplicate rows by date+name) ─────
  if (e.parameter.action === 'cleanup') {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return respond({ status: 'ok', removed: 0 });
    const headers = data[0];
    const dateIdx = headers.indexOf('date');
    const nameIdx = headers.indexOf('name');

    // Group all rows by (date, name) → keep array of (sheet-row-index)
    const groups = {};
    for (let i = 1; i < data.length; i++) {
      const rowDate = String(data[i][dateIdx] || '').slice(0, 10);
      const rowName = String(data[i][nameIdx] || '');
      if (!rowDate || !rowName) continue;
      const key = rowDate + '::' + rowName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(i + 1);  // sheet row number (1-indexed)
    }

    // For each group with > 1 row, score and delete the worse ones
    const toDelete = [];
    Object.keys(groups).forEach(function(key) {
      const indices = groups[key];
      if (indices.length <= 1) return;
      let bestIdx = indices[0];
      let bestScore = -1;
      indices.forEach(function(idx) {
        const row = data[idx - 1];
        let score = 0;
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== '' && row[c] !== null) score++;
        }
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      });
      indices.forEach(function(idx) {
        if (idx !== bestIdx) toDelete.push(idx);
      });
    });

    // Delete bottom-up so indices stay valid
    toDelete.sort(function(a, b) { return b - a; });
    toDelete.forEach(function(idx) { sheet.deleteRow(idx); });

    return respond({ status: 'ok', removed: toDelete.length });
  }

  // ─── READ ──────────────────────────────────────────────
  const rows = sheet.getDataRange().getValues();
  const data = rows.length < 2 ? [] : (() => {
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  })();

  return respond({ status: 'ok', data });
}
```

After pasting:
1. **Save** (`Ctrl+S`)
2. **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**
3. Keep the **same web app URL** — that's what's hardcoded in `src/lib/config.ts`. Don't change "Who has access" or "Execute as" — keep them as before.

### One-time cleanup of existing duplicates

After deploying the Apps Script, on the somn site:
- Open `/detail` page → scroll to the bottom → click **curăță duplicate**
- Toast shows how many duplicate rows were removed
- Future writes use upsert, so this won't happen again

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
