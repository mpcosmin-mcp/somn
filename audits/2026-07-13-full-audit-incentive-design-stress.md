# Full audit — incentivare, design, dimensiuni module + stress test masiv

> **STATUS: REZOLVAT** (2026-07-13, commits `e5078b8` + `27e1781`, local — *nepushuite*).
> P0–P3 implementate integral, cu **o singură excepție deliberată**: persistența sesiunii.
> Login-ul obligatoriu a fost o decizie explicită anterioară („Make login mandatory", 2026-05-19) —
> nu o revocăm fără acordul lui Cosmin. Bug-urile din jurul ei (flash-ul „Lv 1") **sunt** rezolvate.
> Stress test post-fix: **92/92 invarianți** trec. Vezi §6 pentru starea finală.

**Data:** 2026-07-13 · **Scope:** `gamify.ts` + `sleep.ts` (logică), dashboard + modal + /ghid + chat (vizual, live pe dev @1920×855), stress test sintetic (scratchpad `stress.ts`, 60 invarianți + fairness + economie + exploits + perf).

## Verdict pe scurt

Motorul de gamificare e **matematic solid** — 60/60 invarianți trec (boundary-uri exacte, sume consistente, fără NaN, streak-uri corecte peste DST/lună, semantica ferestrei God Mode corectă, timpi malformați respinși curat). Problemele mari sunt de **calibrare economică**, **fairness F/M pe jumătate făcut** și **3 vectori de exploit la ingest**. Vizual, platforma e coerentă și fără erori de consolă; fricțiunile sunt modalul de jucător care necesită scroll, badge-urile nedescriptive pe touch și re-login-ul la fiecare deschidere.

---

## 1. Logica de incentivare

### 1.1 God Mode e conținut mort în datele reale ⚠️ (finding-ul central)

În datele live: Petrica are **97 nopți logate și 0 nopți SS ≥ 95** (badge-urile 💯 God Mode și 👑 Aproape Perfect = „neînceput"), doar 5×90+. Nimeni din echipă nu are flair 💯/🌟 activ. Jackpot-urile +500/+200 — mecanica-vedetă a economiei — **nu s-au declanșat niciodată**. Dacă device-urile (Garmin etc.) practic nu dau 100, God Mode rămâne pură teorie.

**Reversul (simulare 1 an):** dacă scorurile 100 SUNT atinse (persona „consistent-good", medie SS 86), economia explodează: 22 975 XP → **Lv 230**, când tier-ul maxim „Zeu al Somnului" e la Lv 75. Chiar și persona „Average" (1×100/an) termină anul la Lv 87 = tier maxim. Scara de paliere se **saturează într-un an** pentru oricine loghează constant.

**Concluzie:** economia are două moduri de eșec simultan — ori jackpot-urile sunt inaccesibile (realitatea curentă: Zeu = 7 400 XP ≈ **4+ ani** la rata reală a lui Petrica de ~1 780 XP/97 nopți), ori inflatează necontrolat. Cauza: variance-ul uriaș al benzii 500/200 domină tot restul (în simulare, SS100+SS95 = 53% din tot XP-ul; în realitate = 0%).

**Recomandare:** recalibrează pragurile pe distribuția reală de scoruri (ex. God = 95+, Aproape Perfect = 92+, sau trigger pe record personal: „bate-ți PB-ul pe 30 zile"), și fă costul nivelului crescător (nu flat 100 XP/nivel — acum un singur SS100 = +5 nivele instant).

### 1.2 Fairness F/M — doar culorile sunt sex-aware, recompensele NU ⚠️

- ✅ Culorile/statusurile RHR sunt sex-aware (`rhrCutoffs`: F +5 bpm) — afișare corectă peste tot.
- ❌ **Badge-ul 🫀 „Puls Odihnit" e unisex (RHR < 55)**. Stress test fairness: la fitness identic, bărbatul califică **206/365 nopți**, femeia **75/365**. Cu prag sex-aware (<60 pt. F) ar califica identic (206). Clara e structural dezavantajată la acest badge.
- ❌ **Distincția 🫀 „low RHR" din leaderboard** compară media brută între sexe → un bărbat o câștigă mereu. Trebuie comparat delta față de baseline-ul sexului.
- Blocker tehnic: `Achievement.count(data)` nu primește numele/sexul — semnătura trebuie extinsă ca să se poată calibra pragurile per persoană.

### 1.3 Alte goluri de incentivare

- **Badge-urile din leaderboard sunt emoji-only** cu tooltip pe `title` — pe touch (PWA = uz principal) descrierea nu există nicăieri în rând.
- **Achievement cards nu sunt clickabile** — nu există drill-down per badge (feature deja cerut, în EOD pickup).
- **Nu există badge-uri competitive pe perioade** (săptămână/lună/3 luni/an) — doar cele permanente all-time (idem, cerut).
- **Streak-urile se opresc la 30z** (+350 XP total, o singură dată) — streak-uri de 60/100/365 nu primesc nimic; pentru un tracker zilnic, streak-ul lung e exact comportamentul de premiat.
- Ciocârlie premiază culcarea <23:00, dar **consistența orarului** (aceeași oră ± 30min) — cel mai bun predictor de somn — nu e premiată deloc.
- În /ghid, regulile SS citesc cumulativ („≥95 +200, ≥90 +10") dar benzile sunt exclusive în cod — de clarificat textul.

## 2. Stress test — rezultate

### 2.1 Invarianți: 60/60 PASS ✅

Edge-case-uri acoperite: date goale, user necunoscut, boundary-uri SS exacte (79/80/89/90/94/95/99/100), sume breakdown === total, `calcXP === xpBreakdown.total`, timpi malformați (`25:00`, `12:60`, `7:5`, garbage) → null fără crash, wrap peste miezul nopții (529 min), streak-uri cu duplicate deduplicate, DST 2026-03-29 și treceri de lună OK, fereastra God D+1..D+7 exactă, ferestre suprapuse NU se cumulează (+20% o singură dată), praguri achievement exacte la threshold, tier fallback la Lv 0.

### 2.2 Exploits găsite 🔓

1. **Duplicate-date spam:** aceeași noapte SS100 retrimisă ×10 → **5 550 XP** (streak-ul deduplică, XP-ul NU). Ingest-ul trebuie să facă upsert pe `(name, date)`, nu append.
2. **Fără clamp pe SS în engine:** SS=999 acceptat → +500 jackpot. Validarea trăiește doar la ingest (Apps Script) — de confirmat că există și acolo.
3. **`start == end` → 1440 min somn:** 3 typo-uri identice deblochează „Somn Lung" Bronz. `sleepDurationMin` ar trebui să respingă durate implauzibile (>16h → null).

### 2.3 Performanță

| Scenariu | Timp |
|---|---|
| Realist: 3 useri × 2 ani (2 190 entries), recompute complet leaderboard | 97 ms |
| 9 000 entries | 170 ms |
| 51 000 entries | 1 282 ms |
| Patologic: 15 000 entries toate SS100 (fereastra God devine O(n·g)) | 1 223 ms |

La scara echipei de 3 — **non-problemă**. De reținut doar dacă Sleep Tracker devine template MCompany multi-echipă: `inGodWindow` e pătratic și recompute-ul rulează în `useMemo` la fiecare schimb de tab.

### 2.4 Timezone (minor)

`streakFor` și `godMode` folosesc `toISOString()` (UTC) pentru „azi", dar datele sunt locale — între 00:00–03:00 ora României streak-ul poate apărea rupt cu o zi și `daysLeft` poate fi decalat cu 1. `dayNum` (prânz local) e safe. Fix: helper unic `todayISO()` local (există deja în player-drawer).

## 3. Audit vizual & dimensiuni module (live, desktop 1920×855)

- **Structura paginii:** KPI 197px + Leaderboard 493px + Team chart 499px = 1 298px total (~1.5 viewport-uri) — pagină compactă, ritm bun. Chat rail 300px fix stânga, conținut max-w-3xl centrat în spațiul rămas (main left = 717px) — fără coliziuni la 1920.
- **Modal jucător: 448×727, conținut 1 180px → ~60% din conținut sub fold, scroll obligatoriu.** Cauza: grila de 11 achievements pe 2 coloane. Cerința „totul vizibil fără scroll" nu e îndeplinită. (Backdrop-ul **blur(8px) există deja** — cerința „spatele blurry" e implementată pentru modale.)
- **Badge-uri achievements:** au iconițe emoji + nume + hint + tier ladder cu 4 puncte colorate + progres — descriptive și bine făcute **în modal**; problema e doar în rândul de leaderboard (emoji fără text) și lipsa click-ului spre detaliu.
- **KPI cards:** 5 carduri, `grid-cols-2` pe mobil → al 5-lea rămâne orfan pe jumătate de rând.
- **Login:** flash cu date greșite („Lv 1 Somnoros" pentru toți) până se încarcă entries; hover-card-ul de pe carduri interceptează primul click (a fost nevoie de 2 click-uri). **Sesiunea nu persistă** — fiecare deschidere = re-login + gate-ul „azi e deja logat" + „sari peste" = 2-3 tap-uri zilnice de fricțiune pe PWA; navigarea hard la /ghid te deloghează.
- **Chat:** rail-ul desktop e elegant, empty state bun, poll 15s rezonabil. Dar ștergerea folosește `confirm()` nativ de browser — rupe limbajul vizual slate/indigo (și blochează automatizările). 0 mesaje în istoric — feature-ul pare nefolosit; fără notificări push, doar badge pe mobil.
- **/ghid:** complet și **exact** față de cod (benzi, praguri, paliere verificate 1:1 cu gamify.ts) ✅.
- **Consolă: zero erori** pe dashboard ✅.

## 4. Blocker-ul din EOD (2026-07-09) — REZOLVAT ✅

**Cauza „build-ului vechi": pe portul 3000 rulează ALT proiect** — portalul Coldea Expert (proces 50468, tier MCompany). `npm run dev` pentru Sleep Tracker sare automat pe **3001**. Browserul de pe 3000 arăta alt app/server vechi. Regulă nouă: verifică bannerul de port din output-ul `next dev` înainte de orice verificare vizuală.

## 5. Plan de acțiune recomandat (prioritizat)

- **P0 — integritate & fairness:** badge 🫀 + distincție 🫀 sex-aware (necesită `count(data, name)`); dedupe ingest pe `(name,date)`; clamp SS/RHR la ingest; respins durate >16h.
- **P1 — economie:** recalibrare praguri God/Aproape Perfect pe distribuția reală (sau trigger pe PB personal); cost de nivel crescător; streak milestones extinse (60/100/365z).
- **P2 — UX cerut deja:** achievement cards clickabile → modal detaliu per badge (blur-ul există); badge-uri descriptive pe touch (tap → nume); modal jucător compact (3 coloane achievements sau secțiuni colapsabile); persistență sesiune cu logout explicit; înlocuit `confirm()` din chat cu confirm in-UI.
- **P3 — polish:** badge-uri pe perioade (săpt/lună/3l/an); badge consistență orar; KPI al 5-lea orfan pe mobil; flash „Lv 1" la login.

---

## 6. Ce s-a livrat (2026-07-13)

**Economia, recalibrată pe distribuția reală.** God Mode se declanșează acum la **SS ≥ 95** (nu 100 — scor pe care ceasurile echipei nu l-au produs niciodată). Benzile: 100→+300, 95–99→+150, 90–94→+60, 85–89→+25, 80–84→+10. Nivelele costă progresiv (Lv1→2 = 100 XP, Lv20→21 = 575 XP), iar palierele au fost re-scalate: **Zeu = 34.300 XP**. Simulare 1 an: profilul realist („Petrica-real") → Lv 21, ~4.8 ani până la Zeu; jucătorul mediu → 3.4 ani. Înainte, oricine loga constant depășea palierul maxim într-un an. **Nivelele afișate scad pentru toți** (Petrica 18→11, Clara 22→13, Gabi 27→14) — e efectul intenționat al curbei noi, nu o pierdere de XP.

**Fairness — rezolvat la Δ = 0 XP.** `Achievement.count()` primește acum persoana, deci pragurile fiziologice se calibrează pe sex. 🫀 Puls Odihnit: <55 bpm (M) / <60 (F). Distincția 🫀 din leaderboard compară delta față de baseline-ul propriu, nu media brută. Verificat în UI: Clara vede „nopți cu RHR < 60", Petrica „< 55".

**Exploits — închise.** Durate >16h respinse (`start == end` nu mai dă 24h de somn ⇒ „Somn Lung" gratis). Valorile în afara intervalului sunt aruncate la citire și primesc 400 la scriere (SS=999 nu mai încasează banda maximă). Dedup-ul pe `(date,name)` **exista deja** în `/api/sheets` GET — nu am adăugat nimic redundant.

**Bug-uri noi găsite pe parcurs.** `streakFor`/`godMode` foloseau ziua **UTC** pentru „azi" — între 00:00–03:00 ora României, streak-ul apărea rupt. Acum aritmetică pe zi locală. `inGodWindow` era pătratic: cazul patologic a scăzut **1223ms → 194ms**.

**UX.** Click pe badge / pe nivel → modal peste, cu fundalul blurat (exact cerința). Modalul jucătorului: de la **455px de overflow la ~15px** (grilă 4×3). Crown-uri competitive pe perioade (7z/30z/3 luni/An), distincte vizual de cele permanente. `confirm()`-ul nativ din chat înlocuit. Flash-ul „Lv 1" la login → shimmer. Al 5-lea KPI nu mai rămâne orfan pe mobil. `/ghid` rescris — nu mai minte despre reguli.

**Nerezolvat, intenționat:** persistența sesiunii (vezi header). Necesită decizia lui Cosmin.

---
*Stress test reproductibil: scratchpad `stress.ts` (seeded RNG, `node stress.ts`, Node 25). Pre-fix: 60/60. Post-fix: **92/92**, incluzând aserțiuni noi de fairness, curbă de nivel și regresie pe cele 3 exploits.*
