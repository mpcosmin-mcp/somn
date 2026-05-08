# Setup checklist · somn

One-time setup for v2 to be fully functional. ~10 minutes.

---

## 1. Anthropic API key

The AI roasts and weekly stories use Claude Haiku 4.5 (cheap, ~$0.50/month for 3 users).

1. Go to https://console.anthropic.com/settings/keys
2. Create a key, label it `somn-vercel`
3. Copy it — you'll paste it in step 3

---

## 2. Google Sheet — fix the headers

**Final header row (8 columns, exactly):**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| `date` | `name` | `sleep_score` | `rhr` | `hrv` | `score` | `rem` | `journal` |

### If you've already started using v2 — fix headers in place

Inspecting the live Sheet, the current headers look like this:

| F | G | H |
|---|---|---|
| `score: rem` ← merged into one cell | `journal` ← actually contains REM values | (empty) ← actually contains journal text |

The data in the columns is fine — only the **labels in row 1** are wrong. Fix:

1. Open the Sheet
2. In row 1, rename:
   - **F1**: change `score: rem` → `score`
   - **G1**: change `journal` → `rem`
   - **H1**: type `journal`
3. Save (Ctrl+S inside the Sheet does nothing; just navigate away)

After this, REM values that were stored under "journal" become correctly labeled as REM, and the journal text in the unnamed column becomes the proper `journal` column. **No data is moved or lost — only labels change.**

### If starting fresh

Just create the 8 headers in row 1 in the order shown above. Old rows leave new columns empty — UI shows `—` for missing REM, no journal section if empty.

### Update the Apps Script — REPLACE the entire `doGet` function

Open `Extensions → Apps Script` and **replace the whole file** with this. It adds:
- `rem` and `journal` parameter handling on writes
- **Upsert** logic (find existing row by date+name, update in place; otherwise append) — fixes the duplicate-row bug from the old `appendRow`-only version
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

  if (e.parameter.action === 'write') {
    const date = String(e.parameter.date || '');
    const name = String(e.parameter.name || '');
    const sleepScore = parseFloat(e.parameter.sleep_score) || 0;
    const rhr = parseFloat(e.parameter.rhr) || 0;
    const hrv = e.parameter.hrv ? parseFloat(e.parameter.hrv) : '';
    const score = e.parameter.score ? parseFloat(e.parameter.score) : '';   // legacy column
    const rem = e.parameter.rem ? parseFloat(e.parameter.rem) : '';         // NEW
    const journal = String(e.parameter.journal || '');                       // NEW

    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const dateIdx = headers.indexOf('date');
    const nameIdx = headers.indexOf('name');

    // Find existing row by (date, name) for upsert
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][dateIdx]) === date && String(data[i][nameIdx]) === name) {
        foundRow = i + 1;
        break;
      }
    }

    const rowValues = [date, name, sleepScore, rhr, hrv, score, rem, journal];
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return respond({ status: 'ok', upsert: foundRow > 0 ? 'update' : 'append' });
  }

  // Read all rows
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
