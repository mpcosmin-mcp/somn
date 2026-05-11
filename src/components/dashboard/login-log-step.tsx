'use client';
import { useState } from 'react';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { chatSend } from '@/lib/chat-toggle';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';
import { LogEntry } from '@/components/dashboard/log-entry';

/**
 * Login-step screen. Shown right after the user picks their profile
 * IF today's sleep isn't logged yet. Gives 3 paths:
 *   📝 form  → inline LogEntry
 *   💬 chat  → opens Hipnos with a starter prompt
 *   →  skip  → straight to dashboard
 *
 * Auto-closes when an entry is saved (any path).
 */
export function LoginLogStep({
  user,
  entries,
  onSaved,
  onSkip,
}: {
  user: string;
  entries: SleepEntry[];
  onSaved: (entry: SleepEntry) => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<'choice' | 'form'>('choice');
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  if (mode === 'form') {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4 py-8 dots">
        <div className="w-full max-w-md space-y-3">
          <button
            onClick={() => setMode('choice')}
            className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors flex items-center gap-1"
          >
            ← înapoi
          </button>
          <LogEntry
            user={user}
            entries={entries}
            onSaved={onSaved}
            onClose={() => setMode('choice')}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8 dots">
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-7 text-center relative overflow-hidden">
          {/* Soft gradient backdrop */}
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.18), transparent 60%)' }}
          />

          <div className="relative">
            <Lobster size={80} className="mx-auto mb-3" />
            <div className="text-xl sm:text-2xl font-bold mb-1">salut, {fn} 👋</div>
            <div className="text-sm text-[var(--color-fg-muted)] mb-6">
              cum vrei să loghezi azi?
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setMode('form')}
                className="w-full p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)] transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">📝</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm group-hover:text-[var(--color-accent)] transition-colors">Formular</div>
                    <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
                      SS, REM, RHR, HRV — taci și completează
                    </div>
                  </div>
                  <div className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition-colors">→</div>
                </div>
              </button>

              <button
                onClick={() => {
                  chatSend('salut Hipnos, vreau să loghez somnul de azi. Întreabă-mă rând pe rând: SS, REM, RHR, HRV.');
                  onSkip();
                }}
                className="w-full p-4 rounded-2xl border border-[var(--color-accent)]/30 hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/5 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">💬</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm group-hover:text-[var(--color-accent)] transition-colors">
                      Vorbește cu Hipnos
                    </div>
                    <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">
                      Spune-i cu cuvintele tale și el scrie pentru tine
                    </div>
                  </div>
                  <div className="text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)] transition-colors">→</div>
                </div>
              </button>
            </div>

            <button
              onClick={onSkip}
              className="mt-5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              sari peste · mergi direct la dashboard
            </button>
          </div>
        </Card>

        <div className="mt-4 text-center text-[10px] text-[var(--color-fg-dim)] flex items-center justify-center gap-1.5">
          <span className="text-sm">🦞</span>
          <span>Hipnos · zeul grec al somnului</span>
        </div>
      </div>
    </main>
  );
}
