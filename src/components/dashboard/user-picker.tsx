'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry, NAMES, FIRST_NAME, personColor, aggregate, lastNDays } from '@/lib/sleep';
import { calcXP, xpLevel, tierFor, streakFor } from '@/lib/gamify';
import { fetchAllEntries } from '@/lib/client-api';
import { Avi } from '@/components/ui/avi';
import { Card } from '@/components/ui/card';

/* ─── Cool greetings, rotating per page-load ─── */
const GREETINGS = [
  'salut · alege-ți cardul',
  'cine logghează azi?',
  '~$ whoami',
  'noapte bună / dimineață bună',
  'time to log somn',
  'hai cu data',
];

/* ─── Adjective resolver — picks a fun, data-driven label per user ─── */
function adjectiveFor(user: string, entries: SleepEntry[]): string {
  const last30 = lastNDays(entries, 30);
  const agg30 = aggregate(last30);
  const mine = agg30.find(a => a.name === user);
  if (!mine || mine.entries < 3) return 'rookie';

  // REM master — highest avg REM in team
  const remBest = bestBy(agg30, a => a.rem ?? -1);
  if (remBest?.name === user && (mine.rem ?? 0) >= 90) return 'REM master';

  // Recovery king — lowest avg RHR in team
  const rhrBest = bestBy(agg30, a => -a.rhr);
  if (rhrBest?.name === user) return 'recovery king';

  // HRV phenom — highest avg HRV in team
  const hrvBest = bestBy(agg30, a => a.hrv ?? -1);
  if (hrvBest?.name === user && (mine.hrv ?? 0) >= 50) return 'HRV phenom';

  // Score king — highest avg SS in team
  const ssBest = bestBy(agg30, a => a.ss);
  if (ssBest?.name === user && mine.ss >= 80) return 'score king';

  // Iron man — longest streak
  const streak = streakFor(entries, user);
  if (streak >= 14) return `${streak}d streak`;
  if (streak >= 7) return 'consistent';

  // Trend up — last 7 vs prior 7
  const last7 = lastNDays(entries.filter(e => e.name === user), 7);
  if (last7.length >= 4) {
    const avg7 = last7.reduce((s, e) => s + e.ss, 0) / last7.length;
    const all = entries.filter(e => e.name === user);
    if (all.length >= 14) {
      const allAvg = all.reduce((s, e) => s + e.ss, 0) / all.length;
      if (avg7 - allAvg >= 5) return 'on the rise';
      if (avg7 - allAvg <= -5) return 'recovering';
    }
  }

  // Defaults by SS tier
  if (mine.ss >= 85) return 'sleep deity';
  if (mine.ss >= 75) return 'solid sleeper';
  if (mine.ss >= 65) return 'getting there';
  return 'work in progress';
}

function bestBy<T>(arr: T[], score: (x: T) => number): T | null {
  if (!arr.length) return null;
  let best = arr[0];
  let bestScore = score(best);
  for (const x of arr.slice(1)) {
    const s = score(x);
    if (s > bestScore) { best = x; bestScore = s; }
  }
  return bestScore > -Infinity ? best : null;
}

export function UserPicker({ onPick }: { onPick: (name: string) => void }) {
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  useEffect(() => {
    fetchAllEntries().then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Sort users by XP descending so the leader sits on top
  const sortedNames = [...NAMES].sort((a, b) => calcXP(entries, b) - calcXP(entries, a));

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 dots">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 sm:mb-8">
          <span className="num text-3xl font-bold tracking-tight">somn</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] font-medium">
            sleep · IT · ai
          </span>
        </div>

        <div className="text-sm text-[var(--color-fg-muted)] mb-4 num">~$ {greeting}</div>

        <div className="flex flex-col gap-2">
          {sortedNames.map((n, idx) => {
            const xp = calcXP(entries, n);
            const lvl = xpLevel(xp);
            const tier = tierFor(lvl);
            const streak = streakFor(entries, n);
            const adjective = loading ? 'loading...' : adjectiveFor(n, entries);
            const c = personColor(n);
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

            return (
              <button
                key={n}
                onClick={() => onPick(n)}
                disabled={loading}
                className="group text-left transition-all hover:translate-x-1 active:scale-[0.99] disabled:opacity-50"
              >
                <Card className="flex items-center gap-3 px-4 py-3 hover:border-[var(--color-fg-dim)] relative overflow-hidden">
                  {/* Subtle gradient accent matching person color */}
                  <div
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: `linear-gradient(180deg, ${c}, transparent)` }}
                  />
                  <span className="text-base shrink-0" aria-hidden>{medal}</span>
                  <Avi name={n} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-[var(--color-fg)]">{FIRST_NAME[n]}</span>
                      <span
                        className="text-[9px] num font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: tier.color, background: tier.color + '15' }}
                      >
                        {tier.icon} Lv {lvl}
                      </span>
                      {streak > 0 && (
                        <span className="text-[9px] num font-bold text-[var(--color-accent)]">
                          {streak}d 🔥
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5 italic">
                      {adjective} <span className="text-[var(--color-fg-dim)]">· {tier.name}</span>
                    </div>
                  </div>
                  <span
                    className="text-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    style={{ color: c }}
                  >
                    →
                  </span>
                </Card>
              </button>
            );
          })}
        </div>

        <div className="mt-8 space-y-1.5">
          <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1.5">
            <span className="text-sm">🦞</span>
            <span>
              <strong className="text-[var(--color-fg)]">Hipnos</strong> · zeul grec al somnului · AI-ul tău
            </span>
          </div>
          <div className="text-[10px] text-[var(--color-fg-dim)] num">
            built with next.js · powered by claude haiku · open source on github
          </div>
        </div>
      </div>
    </main>
  );
}
