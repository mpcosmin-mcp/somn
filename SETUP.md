# Setup checklist · somn

One-time setup for v2 to be fully functional. ~10 minutes.

---

## 1. Anthropic API key

The AI roasts and weekly stories use Claude Haiku 4.5 (cheap, ~$0.50/month for 3 users).

1. Go to https://console.anthropic.com/settings/keys
2. Create a key, label it `somn-vercel`
3. Copy it — you'll paste it in step 3

---

## 2. Google Sheet — add REM column

The existing Sheet stores `date | name | sleep_score | rhr | hrv`. We add `rem` as a 6th column.

1. Open the team's Sleep Tracker Google Sheet
2. Add a new column header `rem` after `hrv`
3. Old rows leave `rem` empty — that's fine, UI shows `—`

### Update the Apps Script (so REM gets written)

1. In the Sheet: `Extensions → Apps Script`
2. Find the `doGet` function (the one that handles `?action=write`)
3. Make sure the parameter list includes `rem` — example:

```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');

  if (e.parameter.action === 'write') {
    const date = e.parameter.date;
    const name = e.parameter.name;
    const ss = parseFloat(e.parameter.sleep_score) || 0;
    const rhr = parseFloat(e.parameter.rhr) || 0;
    const hrv = e.parameter.hrv === '' ? '' : parseFloat(e.parameter.hrv);
    const rem = e.parameter.rem === '' ? '' : parseFloat(e.parameter.rem);  // NEW

    // Find existing row for date+name; update if found, append if not
    const data = sheet.getDataRange().getValues();
    let found = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === date && data[i][1] === name) { found = i + 1; break; }
    }
    if (found > 0) {
      sheet.getRange(found, 1, 1, 6).setValues([[date, name, ss, rhr, hrv, rem]]);
    } else {
      sheet.appendRow([date, name, ss, rhr, hrv, rem]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Read all
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = r[i]);
    return o;
  });
  return ContentService.createTextOutput(JSON.stringify({ data: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**.
   Keep the same web app URL — that's what's hardcoded in `src/lib/config.ts`.

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
