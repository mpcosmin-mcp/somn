'use client';
import { useState } from 'react';
import { type SleepEntry, NAMES, FIRST_NAME, personColor, missingNights } from '@/lib/sleep';
import { calcXP, xpLevel, tierFor, streakFor } from '@/lib/gamify';
import { useEntries } from '@/lib/entries-provider';
import { todayStr } from '@/lib/utils';
import { Avi } from '@/components/ui/avi';
import { ProfileHoverCard } from '@/components/dashboard/profile-hover-card';
import { LoginInstallBanner } from '@/components/layout/login-install-banner';
import { SleepLogger } from '@/components/dashboard/sleep-logger';


/**
 * Login page — masterpiece edition.
 *
 *   STEP 1: pick your card (3 squad members)
 *   STEP 2: the same logger the dashboard uses — the night you missed, on the
 *           keypad — or skip straight through.
 *
 * All on one page. Aurora background, glassmorphism card.
 */
export function UserPicker({ onPick }: { onPick: (name: string) => void }) {
  // Read the shared entries from context — no duplicate fetch. When the
  // background refetch in EntriesProvider returns fresh data, this picker
  // automatically re-renders with up-to-date XP/level/streak.
  const { entries, loading } = useEntries();
  const [picked, setPicked] = useState<string | null>(null);

  // Until the entries land, every XP calc returns 0 — which used to render as a
  // confident "Lv 1 · Somnoros" for all three, then snap to the real levels a
  // second later. Suppress the stats while loading rather than show fiction.
  const statsReady = !loading && entries.length > 0;

  // If we have at least one entry, sort users by XP descending (leader first).
  // Otherwise keep NAMES order so the picker renders immediately on the very
  // first visit (no entries yet, no cache to seed from).
  const sortedNames = entries.length > 0
    ? [...NAMES].sort((a, b) => calcXP(entries, b) - calcXP(entries, a))
    : [...NAMES];

  return (
    <main className="aurora min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="num text-4xl font-bold tracking-tight text-[var(--color-fg)]">somn</span>
        </div>
        <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-fg-muted)] text-center mb-8 font-semibold">
          sleep · IT · team
        </div>

        {!picked && (
          <>
            <LoginInstallBanner />
            <PickerStep
              sortedNames={sortedNames}
              entries={entries}
              statsReady={statsReady}
              onPick={setPicked}
            />
          </>
        )}

        {picked && (
          loading ? (
            /* The logger prefills from `entries`; mounting it before they land
               would show a blank night for a date that already has data. */
            <div className="glass rounded-3xl p-6 flex items-center gap-3">
              <span className="h-4 w-4 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" aria-hidden />
              <span className="text-sm text-[var(--color-fg-muted)]">se încarcă nopțile tale…</span>
            </div>
          ) : (
            <LogStep
              user={picked}
              entries={entries}
              onBack={() => setPicked(null)}
              onDone={() => onPick(picked)}
            />
          )
        )}

        <div className="mt-8 text-center">
          <div className="text-[10px] text-[var(--color-fg-dim)] num">
            built with next.js · on vercel
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── STEP 1: pick a user ──────────────────────────────── */
function PickerStep({
  sortedNames, entries, statsReady, onPick,
}: {
  sortedNames: string[];
  entries: SleepEntry[];
  /** False while the sheet is still loading — hide levels rather than show Lv 1. */
  statsReady: boolean;
  onPick: (n: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="glass rounded-3xl p-5 sm:p-6 space-y-3">
      <div className="text-center mb-4">
        <div className="text-lg font-bold text-[var(--color-fg)]">Welcome back</div>
        <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">Alege-ți cardul ca să continui</div>
      </div>

      <div className="flex flex-col gap-2">
        {sortedNames.map((n, idx) => {
          const xp = calcXP(entries, n);
          const lvl = xpLevel(xp);
          const tier = tierFor(xp);
          const streak = streakFor(entries, n);
          const c = personColor(n);
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

          return (
            <div
              key={n}
              className="relative"
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(prev => (prev === n ? null : prev))}
            >
              <button
                onClick={() => onPick(n)}
                className="group w-full text-left transition-all hover:translate-x-1 active:scale-[0.99]"
              >
                <div
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl relative overflow-hidden border transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${c}10, transparent 70%)`,
                    borderColor: 'rgba(148,163,184,0.14)',
                  }}
                >
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
                  <span className="text-base shrink-0" aria-hidden>{medal}</span>
                  <Avi name={n} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-base text-[var(--color-fg)]">{FIRST_NAME[n]}</span>
                      {statsReady ? (
                        <>
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
                        </>
                      ) : (
                        <span className="h-[17px] w-16 rounded shimmer shrink-0" aria-hidden />
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">
                      {statsReady ? tier.name : <span className="inline-block h-3 w-24 rounded shimmer align-middle" aria-hidden />}
                    </div>
                  </div>
                  <span
                    className="text-lg opacity-50 group-hover:opacity-100 transition-opacity shrink-0"
                    style={{ color: c }}
                  >
                    →
                  </span>
                </div>
              </button>
              {hovered === n && <ProfileHoverCard name={n} entries={entries} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── STEP 2: log the night you missed ─────────────────
   Same pad as the dashboard sheet — one mechanic in the whole app. Opens on
   the newest night you haven't logged; the strip inside adds the rest of the
   gap in one tap, which is the case that matters after a week away. */
function LogStep({
  user, entries, onBack, onDone,
}: {
  user: string;
  entries: SleepEntry[];
  onBack: () => void;
  onDone: () => void;
}) {
  const { upsertLocal, refetch } = useEntries();
  const c = personColor(user);
  const missing = missingNights(entries, user);
  const initialDates = [missing[0] ?? todayStr()];

  return (
    <div className="glass rounded-3xl overflow-hidden relative">
      <div
        className="absolute top-0 left-0 right-0 h-px z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }}
      />
      <SleepLogger
        user={user}
        entries={entries}
        initialDates={initialDates}
        mode="login"
        onBack={onBack}
        onSavedMany={saved => {
          saved.forEach(upsertLocal);
          void refetch({ fresh: true });
        }}
        onClose={onDone}
      />
    </div>
  );
}
