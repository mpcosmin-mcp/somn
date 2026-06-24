'use client';
import { useRef } from 'react';
import { fmtDuration } from '@/lib/sleep';

/**
 * TimeRangeSlider — drag bedtime + wake on a sleep timeline (18:00 → 12:00),
 * same visual language as the team "Program de somn". Snaps to 5 min, shows the
 * live duration, and a green "sweet spot" band (22:30–06:30) so you place
 * yourself against the ideal window. Pointer-drag + keyboard (←/→ = ±5 min).
 *
 * Values are "HH:MM" strings; internally everything is minutes-from-18:00 so the
 * past-midnight wrap is linear.
 */
const SPAN = 1080;        // 18:00 → 12:00 next day
const SWEET_START = 270;  // 22:30
const SWEET_END = 750;    // 06:30
const AXIS = [120, 360, 600, 840]; // 20:00 · 00:00 · 04:00 · 08:00
const STEP = 5;
const MIN_SLEEP = 60;     // keep at least 1h between the two handles

const clampPct = (m: number) => Math.max(0, Math.min(100, (m / SPAN) * 100));
const toClock = (m: number) => {
  const t = (((Math.round(m) + 18 * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const fromClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (((h * 60 + m) - 18 * 60) % 1440 + 1440) % 1440;
};

export function TimeRangeSlider({ start, end, onChange }: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | 'start' | 'end'>(null);

  const startMin = fromClock(start);
  const endMin = fromClock(end);
  const dur = endMin - startMin;
  const inSweet = startMin >= SWEET_START - 1 && endMin <= SWEET_END + 1;

  const valFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const frac = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(SPAN, Math.round((frac * SPAN) / STEP) * STEP));
  };

  const apply = (m: number) => {
    if (drag.current === 'start') onChange(toClock(Math.min(m, endMin - MIN_SLEEP)), end);
    else if (drag.current === 'end') onChange(start, toClock(Math.max(m, startMin + MIN_SLEEP)));
  };

  const down = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    drag.current = which;
    trackRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => { if (drag.current) apply(valFromX(e.clientX)); };
  const up = () => { drag.current = null; };

  const key = (which: 'start' | 'end') => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0;
    if (!d) return;
    e.preventDefault();
    if (which === 'start') onChange(toClock(Math.max(0, Math.min(startMin + d, endMin - MIN_SLEEP))), end);
    else onChange(start, toClock(Math.min(SPAN, Math.max(endMin + d, startMin + MIN_SLEEP))));
  };

  return (
    <div className="select-none">
      <div className="h-4 mb-1 text-center">
        {inSweet && <span className="text-[10px] font-bold" style={{ color: 'var(--color-good)' }}>★ în sweet spot</span>}
      </div>

      <div
        ref={trackRef}
        className="relative h-10 mt-5 rounded-xl bg-[var(--color-surface)] touch-none"
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {/* sweet-spot band */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${clampPct(SWEET_START)}%`,
            width: `${clampPct(SWEET_END) - clampPct(SWEET_START)}%`,
            background: 'color-mix(in srgb, var(--color-good) 14%, transparent)',
            borderLeft: '1px dashed color-mix(in srgb, var(--color-good) 45%, transparent)',
            borderRight: '1px dashed color-mix(in srgb, var(--color-good) 45%, transparent)',
          }}
          aria-hidden
        />
        {/* filled sleep bar — duration written on it */}
        <div
          className="absolute inset-y-2.5 rounded-full grid place-items-center overflow-hidden"
          style={{
            left: `${clampPct(startMin)}%`,
            width: `${clampPct(endMin) - clampPct(startMin)}%`,
            background: 'var(--color-accent)',
            boxShadow: '0 0 12px var(--color-accent-glow)',
          }}
          aria-hidden
        >
          <span className="num font-bold text-[11px] text-white whitespace-nowrap px-1">{fmtDuration(dur)}</span>
        </div>
        <Thumb pos={clampPct(startMin)} icon="🌙" label={toClock(startMin)} ariaLabel="Ora de culcare" onDown={down('start')} onKey={key('start')} />
        <Thumb pos={clampPct(endMin)} icon="☀️" label={toClock(endMin)} ariaLabel="Ora de trezire" onDown={down('end')} onKey={key('end')} />
      </div>

      {/* time axis */}
      <div className="relative h-3 mt-1.5">
        {AXIS.map(a => (
          <span key={a} className="absolute text-[9px] num text-[var(--color-fg-dim)] -translate-x-1/2" style={{ left: `${clampPct(a)}%` }}>
            {toClock(a)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Thumb({ pos, icon, label, ariaLabel, onDown, onKey }: {
  pos: number;
  icon: string;
  label: string;
  ariaLabel: string;
  onDown: (e: React.PointerEvent) => void;
  onKey: (e: React.KeyboardEvent) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onDown}
      onKeyDown={onKey}
      aria-label={`${ariaLabel}: ${label}`}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 grid place-items-center w-9 h-9 rounded-full bg-[var(--color-card)] border-2 border-[var(--color-accent)] shadow-lg cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      style={{ left: `${pos}%` }}
    >
      <span className="text-sm leading-none" aria-hidden>{icon}</span>
      <span className="absolute -top-5 num text-[10px] font-bold text-[var(--color-fg)] whitespace-nowrap">{label}</span>
    </button>
  );
}
