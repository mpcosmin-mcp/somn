/* ─────────────────────────────────────────────────────────
   sleep coach — deterministic insight engine + reading list
   The SINGLE pattern detector in the app. No AI, instant render.
   Reads ss/rhr/hrv/rem + bedtime/wake (duration). Each nudge is grounded in a
   principle from one of the reading-list books and carries a `source` citation.
   personalTrendNote() is a thin wrapper kept so the metric-detail
   modal keeps its old signature (one shared engine, no double work).
   ───────────────────────────────────────────────────────── */
import { type SleepEntry, sleepDurationMin, bedtimeFrom18, fmtDuration } from './sleep';

export type InsightTone = 'good' | 'warn' | 'tip';

export interface Insight {
  id: string;
  tone: InsightTone;
  /** Compact one-liner — the observation pulled from the data. */
  title: string;
  /** Short prescriptive nudge, grounded in a principle from a reading-list book. */
  body: string;
  /** Citation — which book the principle comes from (rendered as a source chip). */
  source?: string;
}

const round = (n: number) => Math.round(n);
const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

/**
 * Prioritized, de-duplicated coaching insights for one person.
 * Warnings first, then tips, then wins; at most one per topic; capped at `max`.
 * Thin data degrades to a single honest "log more" nudge — never horoscope filler.
 */
export function coachInsights(entries: SleepEntry[], user: string, max = 3): Insight[] {
  const mine = entries
    .filter(e => e.name === user)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cold start — say so honestly instead of inventing a pattern.
  if (mine.length < 2) {
    return [{
      id: 'cold-start',
      tone: 'tip',
      title: 'Loghează 2-3 nopți',
      body: 'Coach-ul are nevoie de câteva loguri ca să-ți vadă pattern-ul. Logează constant și deblochezi insight-uri reale.',
    }];
  }

  const last7 = mine.slice(-7);
  const last = mine[mine.length - 1];
  const prev = mine[mine.length - 2];

  // candidate buckets — `prio` lower = shown first; `topic` collapses duplicates.
  const cand: { topic: string; prio: number; insight: Insight }[] = [];
  const push = (topic: string, prio: number, insight: Insight) => cand.push({ topic, prio, insight });

  /* ── Sleep-score trend ── */
  if (last7.length >= 3) {
    const deltas: number[] = [];
    for (let i = 1; i < last7.length; i++) deltas.push(last7[i].ss - last7[i - 1].ss);
    const k = last7.length - 1;
    if (deltas.every(d => d < 0)) {
      push('ss-trend', 0, {
        id: 'ss-down', tone: 'warn',
        title: `SS în scădere ${k} zile la rând`,
        body: 'Stevenson: revino la baze — cameră la 18-19°C, ecrane stinse cu o oră înainte, cofeina doar dimineața.',
        source: 'Stevenson · Sleep Smarter',
      });
    } else if (deltas.every(d => d > 0)) {
      push('ss-trend', 20, {
        id: 'ss-up', tone: 'good',
        title: `SS în creștere ${k} zile la rând`,
        body: 'Panda: ritmul circadian iubește predictibilitatea. Ține orele fixe și valul continuă.',
        source: 'Panda · The Circadian Code',
      });
    }
  }
  const ssDelta = last.ss - prev.ss;
  if (ssDelta <= -8) {
    push('ss-trend', 1, {
      id: 'ss-drop', tone: 'warn',
      title: `${ssDelta} SS față de aseară`,
      body: 'Winter: o noapte slabă nu strică nimic — fără panică. Presiunea de somn se adună, diseară adormi mai ușor.',
      source: 'Winter · The Sleep Solution',
    });
  } else if (ssDelta >= 8) {
    push('ss-trend', 21, {
      id: 'ss-jump', tone: 'good',
      title: `+${ssDelta} SS față de aseară`,
      body: 'Stevenson: transformă ce-a funcționat aseară într-o rutină fixă. Repetabilitatea face scorul.',
      source: 'Stevenson · Sleep Smarter',
    });
  }

  /* ── REM ── */
  const remVals = last7.filter(e => e.rem != null).map(e => e.rem as number);
  if (remVals.length >= 3) {
    const aRem = round(mean(remVals));
    if (aRem < 70) {
      push('rem', 2, {
        id: 'rem-low', tone: 'warn',
        title: `REM mediu ${aRem}min · sub target`,
        body: 'Walker: alcoolul și culcarea târzie fragmentează REM-ul. Seară fără alcool + oră fixă = mai mult REM.',
        source: 'Walker · Why We Sleep',
      });
    } else if (aRem >= 100) {
      push('rem', 22, {
        id: 'rem-high', tone: 'good',
        title: `REM mediu ${aRem}min · peste target`,
        body: 'Walker: REM-ul consolidează memoria și emoțiile — îl ai din plin. Menține ritmul.',
        source: 'Walker · Why We Sleep',
      });
    }
  }

  /* ── RHR (lower is better) — flag vs. own baseline or absolute ── */
  const baseVals = mine.slice(0, -1).map(e => e.rhr).filter(v => v > 0);
  const baseline = baseVals.length ? mean(baseVals) : 0;
  if (last.rhr > 0 && (last.rhr >= 70 || (baseline && last.rhr - baseline >= 6))) {
    push('rhr', 3, {
      id: 'rhr-high', tone: 'warn',
      title: `RHR ${last.rhr}bpm · ridicat`,
      body: 'Winter: puls de repaus ridicat = corp nerecuperat. Zi ușoară, hidratare, culcare la ora obișnuită.',
      source: 'Winter · The Sleep Solution',
    });
  } else if (last.rhr > 0 && last.rhr < 55) {
    push('rhr', 23, {
      id: 'rhr-low', tone: 'good',
      title: `RHR ${last.rhr}bpm · jos`,
      body: 'Puls jos = recuperare bună (Winter). Profită de energie azi.',
      source: 'Winter · The Sleep Solution',
    });
  }

  /* ── HRV (higher is better) — short-window direction ── */
  const hrvRecent = mine.slice(-4).filter(e => e.hrv != null).map(e => e.hrv as number);
  if (hrvRecent.length >= 3) {
    const first = hrvRecent[0];
    const lastH = hrvRecent[hrvRecent.length - 1];
    if (lastH - first <= -10) {
      push('hrv', 4, {
        id: 'hrv-down', tone: 'warn',
        title: `HRV scade ${first}→${lastH}ms`,
        body: 'HRV în scădere = stres. Stevenson: cameră răcoroasă, fără ecrane în pat, respirație lentă înainte de somn.',
        source: 'Stevenson · Sleep Smarter',
      });
    } else if (lastH - first >= 10) {
      push('hrv', 24, {
        id: 'hrv-up', tone: 'good',
        title: `HRV crește ${first}→${lastH}ms`,
        body: 'HRV crește — sistemul nervos se recuperează (Winter). Ține rutina.',
        source: 'Winter · The Sleep Solution',
      });
    }
  }

  /* ── Consistency (the single biggest lever) ── */
  if (last7.length >= 4) {
    const ssVals = last7.map(e => e.ss);
    if (Math.max(...ssVals) - Math.min(...ssVals) >= 25) {
      push('consistency', 10, {
        id: 'inconsistent', tone: 'tip',
        title: 'Somn inconsistent săptămâna asta',
        body: 'Panda: ancora #1 e ora de TREZIRE fixă, inclusiv weekend. Ritmul circadian se așază pe ea.',
        source: 'Panda · The Circadian Code',
      });
    }
  }

  /* ── "Dorm bine dar tot obosit" — decent score, low REM ── */
  if (last7.length >= 3 && remVals.length >= 3) {
    if (mean(last7.map(e => e.ss)) >= 72 && mean(remVals) < 80) {
      push('rem', 11, {
        id: 'tired-despite-score', tone: 'tip',
        title: 'Scor bun, dar REM mic',
        body: 'Walker: REM-ul vine spre dimineață, în ultimele ore. Tai din final → obosit deși scorul e ok. Somn mai lung.',
        source: 'Walker · Why We Sleep',
      });
    }
  }

  /* ── Sleep duration (needs start+end on ≥3 recent logs) ── */
  const durations = last7
    .map(e => sleepDurationMin(e.start, e.end))
    .filter((d): d is number => d != null);
  if (durations.length >= 3) {
    const avgDur = mean(durations);
    if (avgDur < 420) {
      push('duration', 2, {
        id: 'dur-low', tone: 'warn',
        title: `Media somn ${fmtDuration(round(avgDur))} · sub 7h`,
        body: 'Walker: sub 7h cronic taie din REM și recuperare. Țintește 7-9h — culcare cu 30-45 min mai devreme.',
        source: 'Walker · Why We Sleep',
      });
    } else if (avgDur >= 480) {
      push('duration', 22, {
        id: 'dur-good', tone: 'good',
        title: `Media somn ${fmtDuration(round(avgDur))} · în target`,
        body: 'Littlehales (R90): ~5 cicluri de 90 min ≈ 7h30 — ești fix acolo. Ține ora de trezire fixă.',
        source: 'Littlehales · Sleep (R90)',
      });
    }
  }

  /* ── Bedtime regularity / lateness (needs start on ≥3 recent logs) ──
   * bedtimeFrom18 linearizes evening→morning so the range is meaningful. */
  const bedtimes = last7
    .map(e => bedtimeFrom18(e.start))
    .filter((b): b is number => b != null);
  if (bedtimes.length >= 3) {
    const range = Math.max(...bedtimes) - Math.min(...bedtimes);
    if (range >= 90) {
      push('bedtime', 10, {
        id: 'bed-irregular', tone: 'tip',
        title: 'Ora de culcare variază mult',
        body: 'Littlehales (R90): ancorează ora de TREZIRE; bedtime-ul se aliniază singur. Constanța bate durata.',
        source: 'Littlehales · Sleep (R90)',
      });
    } else if (mean(bedtimes) >= 360) {
      // avg bedtime at/after 00:00 (360 min past 18:00)
      push('bedtime', 11, {
        id: 'bed-late', tone: 'tip',
        title: 'Te culci după miezul nopții',
        body: 'Walker: somnul profund domină prima parte a nopții. Culcare după 00:00 → pierzi deep sleep. Trage spre 23:00.',
        source: 'Walker · Why We Sleep',
      });
    }
  }

  // Keep the highest-priority insight per topic, then rank globally.
  const byTopic = new Map<string, { topic: string; prio: number; insight: Insight }>();
  for (const c of cand) {
    const cur = byTopic.get(c.topic);
    if (!cur || c.prio < cur.prio) byTopic.set(c.topic, c);
  }
  const ranked = [...byTopic.values()].sort((a, b) => a.prio - b.prio);

  if (!ranked.length) {
    // Nothing notable — honest neutral snapshot, not filler.
    const aSS = round(mean(last7.map(e => e.ss)));
    return [{
      id: 'snapshot', tone: 'tip',
      title: `Medie SS săpt: ${aSS} · stabil`,
      body: 'Panda: protejează orele fixe — consistența e totul. Fără alarme acum.',
      source: 'Panda · The Circadian Code',
    }];
  }

  return ranked.slice(0, max).map(r => r.insight);
}

/* ── Thin wrapper: top insight in the old TrendNote shape ──
 * Kept so the metric-detail modal import/usage stays unchanged.
 * Returns null on cold-start to preserve the modal's "no note" behavior. */
export type TrendNote = { text: string; tone: 'good' | 'neutral' | 'warn' };

export function personalTrendNote(entries: SleepEntry[], user: string): TrendNote | null {
  const top = coachInsights(entries, user, 1)[0];
  if (!top || top.id === 'cold-start') return null;
  return { text: top.title, tone: top.tone === 'tip' ? 'neutral' : top.tone };
}

/* ─────────────────────────────────────────────────────────
   Reading list — a small, curated shelf of reputable sleep books.
   Static content, zero runtime cost. Links resolve via Goodreads
   search (built in the component) so they can never 404.
   ───────────────────────────────────────────────────────── */
export interface SleepBook {
  title: string;
  author: string;
  /** One-line tagline (the chip under the title). */
  why: string;
  /** 1-2 sentence "synopsis" — the Netflix-style hover blurb. */
  hook: string;
  /** Local cover image in /public — bundled, so it loads instantly with no
   * dependency on an external (and often slow) cover CDN. */
  cover: string;
}

export const SLEEP_BOOKS: SleepBook[] = [
  {
    title: 'Why We Sleep',
    author: 'Matthew Walker',
    why: 'Biblia somnului',
    hook: 'De ce fiecare oră de somn pierdută îți taie din memorie, imunitate și ani de viață — și ce face de fapt REM-ul pentru creier. Cartea care a schimbat cum vede lumea somnul.',
    cover: '/books/why-we-sleep.jpg',
  },
  {
    title: 'The Sleep Solution',
    author: 'W. Chris Winter',
    why: 'Practic, fără pastile',
    hook: 'Un neurolog care tratează sportivi de top îți arată că insomnia se rezolvă fără medicamente. Calm, concret, anti-panică — exact pentru nopțile în care „nu poți adormi".',
    cover: '/books/the-sleep-solution.jpg',
  },
  {
    title: 'The Circadian Code',
    author: 'Satchin Panda',
    why: 'Ritmul circadian',
    hook: 'Ceasul tău intern decide totul: când mănânci, când vezi lumină, când dormi. Aliniază-le și energia, somnul și greutatea se reglează aproape singure.',
    cover: '/books/the-circadian-code.jpg',
  },
  {
    title: 'Sleep Smarter',
    author: 'Shawn Stevenson',
    why: '21 de pași concreți',
    hook: '21 de lucruri pe care le poți aplica chiar diseară — temperatură, lumină, cofeină, rutină de seară. Zero teorie inutilă, doar ce schimbă noaptea asta.',
    cover: '/books/sleep-smarter.jpg',
  },
  {
    title: 'Sleep: The Myth of 8 Hours',
    author: 'Nick Littlehales',
    why: 'Metoda R90',
    hook: 'Antrenorul de somn al echipelor de fotbal de top: nu număra ore, numără cicluri de 90 de minute. Cum dorm sportivii de performanță — și cum poți și tu.',
    cover: '/books/sleep-myth-8-hours.jpg',
  },
];
