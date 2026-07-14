# Vânătoare de anomalii — somn — 14 iul 2026

4 vânători Fable în paralel: economie XP · integritate date · UX/texte · securitate.
Context: chiar înainte de vânătoare am adăugat sync-ul automat Garmin (cron 10:00 RO,
scrie doar nopțile lipsă ale lui Petrica) și am scos chatul. Multe constatări ating
exact aceste două schimbări.

---

## TRIAJ — ordinea reală de gravitate (nu ordinea din rapoarte)

### 🔴 NIVEL 0 — Date deja expuse public (necesită DECIZIA lui Cosmin + acțiune în afara codului)

**S1. Datele de sănătate + jurnalele celor 3, citibile de oricine.** URL-ul Apps Script e
hardcodat în `src/lib/config.ts:4-6` și commit-uit în repo-ul GitHub **public**. Vânătorul 4
a făcut GET pe el fără niciun token → **369 înregistrări** (scor somn, RHR, HRV, jurnal
personal). World-readable ȘI world-writable (POST/DELETE/cleanup prin query string, ocolind
validarea din Next). `curl` direct pe URL sau pe `somn-xi.vercel.app/api/sheets` →
falsifică/șterge orice.
→ **Acțiune:** (a) rotește Web App-ul Apps Script (New deployment, URL nou), (b) scoate URL-ul
din `config.ts`, mută-l DOAR în env, (c) pune un token partajat verificat pe ambele capete
(Next + Apps Script). Datele existente = considerate compromise.

**S2. Parola Garmin a apărut în clar** în `.env.local.example` (commit evitat la timp) și în
transcript. → **schimbă parola de Garmin** după ce terminăm.

### 🔴 NIVEL 1 — Cifre false afișate utilizatorului (reparabile în cod, autonom)

**A. Ghid: „la Lv 50 → +0 XP".** `ghid/page.tsx:80` face `[5,20,50].map(xpToNextLevel)`, dar
`MAX_LEVEL=46` → `xpToNextLevel(50)=0`. Pagina construită „ca să nu poată minți" afișează un
premiu de 0 la un nivel inexistent. (Vânătorii 1 + 3.)

**B. Ghid: Mastery „+5%…+20%" hardcodat** (`ghid/page.tsx:127`) vs motorul care plătește
3/6/10/15% (`TIER_PCT`, afișat corect 3 carduri mai jos pe ACEEAȘI pagină). Calibrare veche
uitată. (Vânător 1.)

**C. Descriere badge Ascensiune: „Lv 5 = 200 XP, Lv 50 = 1325"** (`gamify.ts:209`) — ambele
false pe curba actuală (Lv 5→6 = 164; Lv 50 nu există). Cifre din economia veche. (Vânători 1+3.)

**D. Card KPI RHR o penalizează pe Clara cu pragul bărbaților.** `kpi-cards.tsx:124`
`target={60}` hardcodat unisex → cifra mare e verde (`rhrColor(62,'F')`=bun) dar pastila zice
„săpt 0/7 ✓" roșu și tooltipul „≤60bpm"; modalul aceluiași card zice „≤65". Același număr, două
verdicte opuse. Fix bug-ul pe care leaderboard-ul l-a reparat deja, uitat pe KPI. (Vânător 3.)

### 🔴 NIVEL 2 — Date pierdute ireversibil (reparabile în cod + Apps Script)

**E. Quick-log „reactualizează" ȘTERGE datele Garmin.** `user-picker.tsx` LogStep nu preîncarcă
(spre deosebire de `log-entry.tsx:40-58`). Cronul scrie SS/RHR/HRV/REM/ore; Petrica deschide de
pe telefon, vede „azi e deja logat — poți reactualiza", formular gol, completează doar SS+RHR,
submit → `hrv/rem/start/end = ''` → Apps Script `setValues` rescrie toată linia → HRV/REM/ore
dispar, cad badge-urile. Textul promite merge, codul face replace. (Vânător 3, 🔴 #1.)
→ **Direct legat de feature-ul de azi. Prioritate maximă de cod.**

**F. Rădăcina de dată Apps Script (închide 3 bug-uri deodată).** Sheets coercează `"2026-05-07"`
în Date; upsert-ul din Apps Script compară `String(Date).slice(0,10)="Wed May 07"` cu
`"2026-05-07"` → nu se potrivește → **appendRow duplicat**; corecțiile devin invizibile (dedupe
GET preferă rândul vechi cu journal); cleanup grupează pe cheie fără an; DELETE raportează succes
fals. (Vânător 2, 🔴 #1/#2/#5.) → **fix unic: normalizare identică pe ambele capete + LockService.**

**G. Cron Garmin poate suprascrie logarea manuală (fereastra 10:00).** `existingKeys()` snapshot
la început; login+fetch durează zeci de secunde; dacă Petrica loghează manual în interval, sync-ul
cu snapshot stale ajunge la `writeEntry` cu `journal:''` → suprascrie journal-ul. (Vânător 2, 🔴#3.)

### 🟠 NIVEL 3 — Securitate exploatabilă cu impact limitat + logică ruptă vizibilă

- **S3.** `/api/sheets/cleanup` POST neautentificat (dedup distructiv, la vederea tuturor pe /detail).
- **S4.** Ownership idei/comentarii = string spoofabil (`user`/`by` din body) → editezi/ștergi ale
  altora. Zero rate limit. Login = picker localStorage, deci identitate reală imposibilă fără auth.
- **S5.** `/api/health` divulgă ce env-uri sunt setate + SHA git. `CRON_SECRET` prin `?key=` → loguri.
- **H. Branding mort:** „SLEEP · IT · **AI**", „powered by claude haiku", OG „Roastuit zilnic de
  Claude Haiku" — AI scos acum 2 luni. (top-bar, user-picker, layout meta, opengraph-image.)
- **I. Coach + hover-card RHR unisex** (`coach.ts:117,124`, `profile-hover-card.tsx:150`) — Clara
  sub-lăudată/supra-alarmată; „cel mai bun RHR" are 2 câștigători după ecran. Ghidul promite calibrare pe sex.
- **J. Erorile server în română strivite** în „POST /api/sheets 400" de `client-api.ts:21`.
- **K. God Mode ziua 7:** badge stins dar boost +20% plătit (`boostedDates` 1..7 vs `godMode` daysLeft).
- **L. „vs ieri"** compară cu ultimul log oricând (`kpi-cards.tsx:31`), modalul zice corect „vs ultima".
- **M. refetch() după save nu e `fresh`** → intrarea salvată dispare până la 60s (multi-lambda / race).
- **N. Read-modify-write KV** comentarii/idei simultane → ultimul câștigă, primul se pierde.

### 🟡 NIVEL 4 — Cosmetic / de decis cu echipa

- Backfill retroactiv (~+700 XP peste noapte pentru Petrica): matematic corect, dar sare fără
  explicație în clasament; streak-milestones pe nopți backfill-uite = legitimitate discutabilă. **Decizie.**
- „★ sweet spot 22:30–06:30" fără acoperire în motor (motorul punctează <23:00). **Decizie: vizual sau real?**
- Fereastra „7 zile" include 8 zile calendaristice + zi UTC 00:00–03:00 (`lastNDays`, `sleep.ts:230`).
- Oricine schimbă statusul ideilor altcuiva fără confirmare.
- Leaderboard: XP/Lv all-time lângă metrici scopate pe tab.
- Chei KV moarte (`chat` după ștergere, field-uri sociale orfane), avatare/poze reale în public/ + repo.

---

## ZONE VERIFICATE CURATE
Total XP o singură sursă · fold Ascension · guard NaN · cap Lv46 în UI · guard Garmin sync corect pe
Vercel · tokenii KV neexpuși · fără XSS (mentions = noduri React) · fără 500 cu stack · validare POST
range · fără dublă-scriere din retry (retry doar pe citiri) · empty states oneste.

---

## VERIFICĂRI LIVE (14 iul, raw pe Apps Script, non-distructiv)

- **Backfill-ul de azi = curat.** Cele 12 nopți backfill-uite au 1 rând fiecare — scrise pe date
  genuin lipsă, fără duplicat. `~+700 XP` e repricing legitim, nu o eroare de scriere.
- **Bug-ul F dovedit live:** 6 date ale lui Petrica au duplicate preexistente (05-10, 05-11, 06-20,
  06-21, 06-22 ×2; **06-23 ×3**) — din logări manuale vechi care au ratat upsert-ul Apps Script.
  NU curățate cu tool-ul existent (cleanup e distructiv, S3/#2). Se rezolvă la rădăcină + manual review.

## HOLD / DECIZII pentru Cosmin înainte de reparații

1. **Cron Garmin NU se activează** până se repară E+F+G (write-path pierde date). Cererea de a seta
   env-urile Vercel e RETRASĂ. Feature-ul rămâne construit dar dezactivat.
2. **F și G se repară ÎMPREUNĂ, niciodată F singur** — altfel duplicatul de azi devine wipe de journal.
3. **După fix, cron mutat la 05:00–06:00 RO** (nu 10:00 = fereastra de logare manuală).
4. **Rotația Apps Script + parola Garmin** = acțiuni ale lui Cosmin în consolele Google/Garmin.
5. **Branding AI, sweet-spot, backfill-XP-legitimacy** = decizii de produs.

## DE REPARAT (plan) — după aprobarea lui Cosmin
