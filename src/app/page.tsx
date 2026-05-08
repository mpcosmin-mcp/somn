'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { useUser } from '@/lib/user';
import { fetchAllEntries } from '@/lib/client-api';
import { todayStr, fmtDate } from '@/lib/utils';
import { Avi } from '@/components/ui/avi';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserPicker } from '@/components/dashboard/user-picker';
import { LogEntry } from '@/components/dashboard/log-entry';
import { Hero } from '@/components/dashboard/hero';
import { Leaderboard } from '@/components/dashboard/leaderboard';
import { DailyRoast, WeeklyStory } from '@/components/dashboard/ai-blocks';

export default function Home() {
  const { user, setUser, hydrated } = useUser();
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setErr('');
      const e = await fetchAllEntries();
      setEntries(e);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'eroare la sync');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm">se încarcă...</div>;
  }

  if (!user) {
    return <UserPicker onPick={setUser} />;
  }

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const today = todayStr();
  const todayLogged = entries.some(e => e.date === today && e.name === user);

  return (
    <main className="min-h-screen pb-12">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-2">
          <Link href="/" className="num font-bold text-lg tracking-tight">somn</Link>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] hidden sm:inline">
            sleep · IT · ai
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant={todayLogged ? 'secondary' : 'primary'} onClick={() => setShowLog(s => !s)}>
              {showLog ? 'închide' : todayLogged ? 'log' : '+ log azi'}
            </Button>
            <Link href="/chat" className="hidden sm:inline-flex">
              <Button size="sm" variant="ghost">chat</Button>
            </Link>
            <Link href={`/detail?u=${encodeURIComponent(user)}`} className="hidden sm:inline-flex">
              <Button size="sm" variant="ghost">detalii</Button>
            </Link>
            <ThemeToggle />
            <button
              onClick={() => setUser(null)}
              className="ml-1"
              title="Schimbă utilizator"
            >
              <Avi name={user} size="sm" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 space-y-4">
        {loading && (
          <div className="text-center text-[var(--color-fg-muted)] text-sm py-12">
            <div className="num text-xs mb-2">~$ fetching sheets...</div>
          </div>
        )}

        {err && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {err}{' '}
            <button onClick={load} className="underline">retry</button>
          </div>
        )}

        {!loading && (
          <>
            {/* Today CTA banner — visible if today not logged yet */}
            {!todayLogged && !showLog && (
              <div className="dots rounded-2xl px-5 py-4 border border-[var(--color-accent)]/30 flex items-center gap-3">
                <span className="text-2xl">🌙</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{fn}, încă n-ai logat azi</div>
                  <div className="text-xs text-[var(--color-fg-muted)]">{fmtDate(today)}</div>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowLog(true)}>+ log</Button>
              </div>
            )}

            {/* Log dialog */}
            {showLog && (
              <LogEntry
                user={user}
                entries={entries}
                onSaved={(saved) => {
                  setEntries(prev => {
                    const filtered = prev.filter(e => !(e.date === saved.date && e.name === saved.name));
                    return [...filtered, saved];
                  });
                  setShowLog(false);
                }}
                onClose={() => setShowLog(false)}
              />
            )}

            <Hero entries={entries} user={user} />

            <Leaderboard entries={entries} currentUser={user} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DailyRoast user={user} entries={entries} />
              <WeeklyStory entries={entries} />
            </div>

            {/* Mobile-only quick links to chat/detail (header hides them on small screens) */}
            <div className="sm:hidden flex gap-2">
              <Link href="/chat" className="flex-1">
                <Button variant="secondary" className="w-full">💬 chat cu ai</Button>
              </Link>
              <Link href={`/detail?u=${encodeURIComponent(user)}`} className="flex-1">
                <Button variant="secondary" className="w-full">📊 detalii</Button>
              </Link>
            </div>

            <div className="pt-4 text-center hidden sm:block">
              <Link
                href={`/detail?u=${encodeURIComponent(user)}`}
                className="inline-flex items-center gap-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors group"
              >
                <span>vezi detaliile complete pentru {fn}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>
          </>
        )}
      </div>

      <footer className="max-w-5xl mx-auto px-4 md:px-6 mt-16 py-6 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] num text-[var(--color-fg-dim)]">
        <span>~$ next.js · vercel · claude haiku</span>
        <span>{entries.length} log{entries.length !== 1 ? 's' : ''} · {new Set(entries.map(e => e.date)).size} days</span>
      </footer>
    </main>
  );
}
