'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { FIRST_NAME, personColor } from '@/lib/sleep';
import { calcXP, xpLevel, levelProgress, tierFor, streakFor, maxStreakFor } from '@/lib/gamify';
import { Avi } from '@/components/ui/avi';

/**
 * Profile chip + popover (top-right of the top bar).
 *
 * Chip: avatar + first name in the person's color, click to open.
 * Popover (right-aligned, 18rem wide):
 *   - Big avatar + name + tier line
 *   - XP bar + streak
 *   - Total logs + days counter
 *   - "Schimbă utilizator" button
 */
export function ProfilePopover() {
  const { user, setUser } = useUser();
  const { entries } = useEntries();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const c = personColor(user);
  const xp = calcXP(entries, user);
  const lvl = xpLevel(xp);
  const tier = tierFor(lvl);
  const streak = streakFor(entries, user);
  const { into, need, pct, maxed } = levelProgress(xp);

  // Personal lifetime records — read straight from the user's entries.
  const mine = entries.filter(e => e.name === user);
  const bestSS = mine.length ? Math.max(...mine.map(e => e.ss)) : 0;
  const remVals = mine.map(e => e.rem).filter((v): v is number => v != null);
  const bestREM = remVals.length ? Math.max(...remVals) : 0;
  const maxStreak = maxStreakFor(entries, user);

  return (
    <div className="relative" ref={wrapRef}>
      {/* Trigger chip */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full border transition-colors"
        style={{
          background: open
            ? `linear-gradient(135deg, ${c}24, transparent 70%)`
            : `linear-gradient(135deg, ${c}10, transparent 70%)`,
          borderColor: open ? `${c}60` : 'var(--color-border)',
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Avi name={user} size="sm" />
        <span className="text-xs font-bold hidden sm:inline" style={{ color: c }}>{fn}</span>
        <span className="text-[var(--color-fg-muted)] text-[10px]" aria-hidden>▾</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl shadow-black/40 overflow-hidden z-40 fade-in-up"
          role="dialog"
          aria-label="Profilul tău"
        >
          {/* Profile header strip */}
          <div
            className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-[var(--color-border)]"
            style={{ background: `linear-gradient(135deg, ${c}1f, transparent 70%)` }}
          >
            <Avi name={user} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate" style={{ color: c }}>{fn}</div>
              <div className="text-[10px] text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
                <span style={{ color: tier.color }}>{tier.icon}</span>
                <span className="num font-semibold">Lv {lvl}</span>
                <span className="text-[var(--color-fg-dim)]">·</span>
                <span>{tier.name}</span>
              </div>
            </div>
          </div>

          {/* XP + streak */}
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="num font-bold text-[var(--color-accent)]">{xp} XP total</span>
              {streak > 0 && (
                <span className="num font-bold text-[var(--color-accent)]">{streak}d 🔥</span>
              )}
            </div>
            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--color-accent-soft), var(--color-accent))',
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] num text-[var(--color-fg-dim)] mt-1">
              {maxed ? (
                <><span className="font-bold" style={{ color: tier.color }}>NIVEL MAXIM</span><span>Lv {lvl}</span></>
              ) : (
                <><span>spre Lv {lvl + 1}</span><span>{into}/{need}</span></>
              )}
            </div>
          </div>

          {/* Personal records — best SS, best REM, longest streak ever */}
          {mine.length > 0 && (
            <div className="px-4 pb-3">
              <div className="label mb-2">Recorduri</div>
              <div className="grid grid-cols-3 gap-2">
                <RecordCell emoji="🏆" value={bestSS} unit="SS" color={c} />
                <RecordCell emoji="🌙" value={bestREM} unit="min REM" color={c} />
                <RecordCell emoji="🔥" value={maxStreak} unit="zile" color={c} />
              </div>
            </div>
          )}

          {/* Total logs + days stat */}
          <div className="px-4 pb-3 text-[10px] text-[var(--color-fg-muted)] num">
            <span className="font-bold text-[var(--color-fg)]">{mine.length}</span> loguri ·{' '}
            <span className="font-bold text-[var(--color-fg)]">{new Set(mine.map(e => e.date)).size}</span> zile
          </div>

          {/* Actions */}
          <div className="px-3 pb-3">
            <button
              onClick={() => { setUser(null); setOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg-dim)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <span>↩</span>
              <span>Schimbă utilizator</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordCell({ emoji, value, unit, color }: { emoji: string; value: number; unit: string; color: string }) {
  return (
    <div
      className="rounded-xl px-2 py-2 text-center"
      style={{ background: color + '0d', border: `1px solid ${color}22` }}
    >
      <div className="text-base leading-none mb-1" aria-hidden>{emoji}</div>
      <div className="num font-bold text-sm leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] text-[var(--color-fg-muted)] mt-0.5 leading-tight">{unit}</div>
    </div>
  );
}
