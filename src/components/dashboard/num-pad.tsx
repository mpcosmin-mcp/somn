'use client';
import { cn } from '@/lib/utils';

export type PadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'back' | 'prev' | 'next' | 'clear' | 'save';

/**
 * The pad the whole logger is built around.
 *
 * Every number a night contains is a bounded 2–3 digit integer, so the fields
 * can hand themselves off: the logger advances the moment one more digit would
 * overflow the field's range. That leaves the thumb parked on one keypad for a
 * whole week of nights — no field taps, no OS keyboard opening and closing
 * between every number.
 */
export function NumPad({
  onKey,
  saveLabel,
  canSave,
  saving,
}: {
  onKey: (k: PadKey) => void;
  saveLabel: string;
  canSave: boolean;
  saving: boolean;
}) {
  return (
    <div
      className="grid grid-cols-4 gap-1.5 p-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {(['1', '2', '3'] as PadKey[]).map(k => <Digit key={k} k={k} onKey={onKey} />)}
      <Util k="back" onKey={onKey} label="⌫" aria="Șterge o cifră" />

      {(['4', '5', '6'] as PadKey[]).map(k => <Digit key={k} k={k} onKey={onKey} />)}
      <Util k="prev" onKey={onKey} label="←" aria="Câmpul anterior" />

      {(['7', '8', '9'] as PadKey[]).map(k => <Digit key={k} k={k} onKey={onKey} />)}
      <Util k="next" onKey={onKey} label="→" aria="Câmpul următor" />

      <Util k="clear" onKey={onKey} label="gol" aria="Golește câmpul" className="col-span-2 text-xs" />
      <Digit k="0" onKey={onKey} />
      <button
        type="button"
        onClick={() => onKey('save')}
        disabled={!canSave || saving}
        aria-label={saveLabel}
        className={cn(
          'h-12 rounded-xl font-bold flex flex-col items-center justify-center leading-none gap-0.5',
          'transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100',
          'bg-[var(--color-accent)] text-[var(--color-bg)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg)]',
        )}
      >
        <span className="text-base">{saving ? '···' : '✓'}</span>
        <span className="text-[9px] font-semibold tracking-tight">{saving ? 'salvez' : 'salvează'}</span>
      </button>
    </div>
  );
}

function Digit({ k, onKey }: { k: PadKey; onKey: (k: PadKey) => void }) {
  return (
    <button
      type="button"
      onClick={() => onKey(k)}
      className={cn(
        'h-12 rounded-xl num text-xl font-bold',
        'bg-[var(--color-card)] text-[var(--color-fg)] border border-[var(--color-border)]',
        'transition-all active:scale-95 active:border-[var(--color-accent)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
      )}
    >
      {k}
    </button>
  );
}

function Util({
  k, onKey, label, aria, className,
}: { k: PadKey; onKey: (k: PadKey) => void; label: string; aria: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onKey(k)}
      aria-label={aria}
      className={cn(
        'h-12 rounded-xl text-lg font-bold',
        'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
        'transition-all active:scale-95 hover:text-[var(--color-fg)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        className,
      )}
    >
      {label}
    </button>
  );
}
