'use client';
import { NAMES, FIRST_NAME, personColor } from '@/lib/sleep';
import { Avi } from '@/components/ui/avi';
import { Card } from '@/components/ui/card';

export function UserPicker({ onPick }: { onPick: (name: string) => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 dots">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <span className="num text-3xl font-bold tracking-tight">somn</span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] font-medium">
            sleep · IT · ai
          </span>
        </div>

        <div className="label mb-3">Cine ești?</div>
        <div className="flex flex-col gap-2">
          {NAMES.map(n => (
            <button
              key={n}
              onClick={() => onPick(n)}
              className="group text-left transition-all hover:translate-x-0.5 active:scale-[0.99]"
            >
              <Card className="flex items-center gap-3 px-4 py-3 hover:border-[var(--color-fg-dim)]">
                <Avi name={n} size="md" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--color-fg)]">{FIRST_NAME[n]}</div>
                  <div className="text-[10px] text-[var(--color-fg-muted)]">{n.split(' ').slice(1).join(' ')}</div>
                </div>
                <span
                  className="text-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: personColor(n) }}
                >
                  →
                </span>
              </Card>
            </button>
          ))}
        </div>

        <div className="mt-8 text-[10px] text-[var(--color-fg-dim)] font-mono">
          built with next.js · powered by claude haiku · open source on github
        </div>
      </div>
    </main>
  );
}
