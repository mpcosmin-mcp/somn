'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  type SleepEntry, type RangeKey,
  LOG_FIELDS, RANGES, parseInRange,
  ssColor, ssTier, remColor, rhrColor, hrvColor, personSex,
  FIRST_NAME,
} from '@/lib/sleep';
import { todayStr, fmtDate, fmtDateShort, cn } from '@/lib/utils';
import { submitEntries } from '@/lib/client-api';
import { Button } from '@/components/ui/button';
import { NumPad, type PadKey } from '@/components/dashboard/num-pad';

/* ─────────────────────────────────────────────────────────
   One logger for one night or for a whole week away.

   A night is four bounded numbers, so the fields hand themselves off: type 85
   and the cursor moves to RHR by itself, finish a night and it drops into the
   next one. Six nights are one uninterrupted run of digits, thumb parked on
   the pad.

   Nothing is written until ✓, and then every night is judged on its own — a
   typo on Wednesday rejects Wednesday, not the week.

   No bedtime, no wake time: a night is the four numbers Garmin already
   computed, and REM sits last because Garmin keeps it on its own screen.
   ───────────────────────────────────────────────────────── */

const STRIP_DAYS = 14;

type Vals = Record<RangeKey, string>;

interface Night {
  date: string;
  v: Vals;
  journal: string;
  /** An entry already exists for this date — saving overwrites it. */
  had: boolean;
  saved: boolean;
  error: string;
}

const EMPTY_VALS: Vals = { ss: '', rhr: '', rem: '', hrv: '' };

function lastDays(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

const num = (s: string, k: RangeKey): number | null => (s === '' ? null : parseInRange(s, k));

/** A night saves only if it carries the two numbers the store insists on. */
function ready(n: Night): boolean {
  return num(n.v.ss, 'ss') != null && num(n.v.rhr, 'rhr') != null;
}

/** Anything typed at all — a half-filled night keeps the sheet open. */
function touched(n: Night): boolean {
  return LOG_FIELDS.some(f => n.v[f.key] !== '') || !!n.journal;
}

function metricColor(k: RangeKey, value: number, name: string): string {
  if (k === 'ss') return ssColor(value);
  if (k === 'rem') return remColor(value);
  if (k === 'rhr') return rhrColor(value, personSex(name));
  return hrvColor(value);
}

export function SleepLogger({
  user,
  entries,
  initialDates,
  onSavedMany,
  onClose,
  /** 'sheet' is the modal over the dashboard; 'login' drops the card shell so
   *  the glass login panel can wrap it, and renames the two exits. */
  mode = 'sheet',
  onBack,
}: {
  user: string;
  entries: SleepEntry[];
  initialDates: string[];
  onSavedMany: (saved: SleepEntry[]) => void;
  onClose: () => void;
  mode?: 'sheet' | 'login';
  onBack?: () => void;
}) {
  const existingFor = useCallback(
    (date: string) => entries.find(e => e.date === date && e.name === user),
    [entries, user],
  );

  const makeNight = useCallback((date: string): Night => {
    const ex = entries.find(e => e.date === date && e.name === user);
    return {
      date,
      v: ex
        ? {
            ss: String(ex.ss),
            rhr: String(ex.rhr),
            rem: ex.rem != null ? String(ex.rem) : '',
            hrv: ex.hrv != null ? String(ex.hrv) : '',
          }
        : { ...EMPTY_VALS },
      journal: ex?.journal ?? '',
      had: !!ex,
      saved: false,
      error: '',
    };
  }, [entries, user]);

  const [nights, setNights] = useState<Night[]>(() =>
    [...new Set(initialDates)].sort().reverse().map(makeNight),
  );
  const [cursor, setCursor] = useState({ i: 0, f: 0 });
  /** The next digit replaces what's there instead of appending — armed every
   *  time the cursor lands somewhere new, so a correction is one keystroke. */
  const [fresh, setFresh] = useState(true);
  /** Which night has its note open. Keyed by date, so moving the cursor
   *  collapses it without an effect reaching in to reset a boolean. */
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState('');
  const [doneEntries, setDoneEntries] = useState<SleepEntry[] | null>(null);

  const activeRef = useRef<HTMLDivElement>(null);

  const strip = useMemo(() => lastDays(STRIP_DAYS), []);
  const selected = useMemo(() => new Set(nights.map(n => n.date)), [nights]);
  const openCount = nights.filter(n => !n.saved).length;
  const readyCount = nights.filter(n => !n.saved && ready(n)).length;
  const gapCount = strip.filter(d => !selected.has(d) && !existingFor(d)).length;
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  /* ── cursor ────────────────────────────────────────────── */

  const moveTo = useCallback((i: number, f: number) => {
    setCursor({ i, f });
    setFresh(true);
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setCursor(c => {
      let { i, f } = c;
      f += dir;
      if (f >= LOG_FIELDS.length) {
        if (i + 1 < nights.length) { i += 1; f = 0; } else { f = LOG_FIELDS.length - 1; }
      } else if (f < 0) {
        if (i - 1 >= 0) { i -= 1; f = LOG_FIELDS.length - 1; } else { f = 0; }
      }
      return { i, f };
    });
    setFresh(true);
  }, [nights.length]);

  const writeField = useCallback((i: number, key: RangeKey, value: string) => {
    setNights(prev => prev.map((n, idx) =>
      idx === i ? { ...n, v: { ...n.v, [key]: value }, error: '' } : n,
    ));
  }, []);

  /* ── typing ────────────────────────────────────────────── */

  const pressDigit = useCallback((d: string) => {
    const { i, f } = cursor;
    const night = nights[i];
    if (!night || night.saved) return;
    const field = LOG_FIELDS[f];
    const key = field.key;
    const cur = fresh ? '' : night.v[key];
    const next = (cur + d).replace(/^0+(?=\d)/, '');
    // One digit too many for this metric — drop it rather than storing a value
    // the store would bounce anyway.
    if (Number(next) > RANGES[key][1]) return;
    writeField(i, key, next);
    setFresh(false);
    // The field is full the moment another digit couldn't fit. That one rule is
    // what makes the pad hands-free — and it runs off the advance ceiling, not
    // the validation bound, so a normal HRV doesn't stall the chain.
    if (Number(next) * 10 > (field.advanceMax ?? RANGES[key][1])) step(1);
  }, [cursor, nights, fresh, writeField, step]);

  const saveRef = useRef<() => void>(() => {});

  const pressKey = useCallback((k: PadKey) => {
    if (doneEntries) return;
    if (k >= '0' && k <= '9') { pressDigit(k); return; }
    const { i, f } = cursor;
    const night = nights[i];
    switch (k) {
      case 'back': {
        if (!night || night.saved) return;
        const cur = night.v[LOG_FIELDS[f].key];
        if (cur === '' || fresh) { step(-1); return; }
        writeField(i, LOG_FIELDS[f].key, cur.slice(0, -1));
        setFresh(false);
        break;
      }
      case 'prev': step(-1); break;
      case 'next': step(1); break;
      case 'clear':
        if (!night || night.saved) return;
        writeField(i, LOG_FIELDS[f].key, '');
        setFresh(true);
        break;
      case 'save': saveRef.current(); break;
    }
  }, [cursor, nights, fresh, doneEntries, pressDigit, writeField, step]);

  /* The same flow on a laptop, without reaching for the mouse. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); pressKey(e.key as PadKey); return; }
      const map: Record<string, PadKey> = {
        Backspace: 'back', ArrowLeft: 'prev', ArrowRight: 'next',
        Delete: 'clear', Enter: 'save', Tab: 'next',
      };
      const mapped = map[e.key];
      if (mapped) { e.preventDefault(); pressKey(mapped); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pressKey]);

  /* Keep the night being typed in view when the cursor drops into the next. */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor.i]);

  /* ── which nights are on the sheet ─────────────────────── */

  const toggleDate = useCallback((date: string) => {
    setNights(prev => {
      const at = prev.findIndex(n => n.date === date);
      if (at >= 0) {
        if (prev[at].saved) return prev;
        const rest = prev.filter(n => n.date !== date);
        return rest.length ? rest : prev; // never leave the sheet with nothing to fill
      }
      return [...prev, makeNight(date)].sort((a, b) => (a.date < b.date ? 1 : -1));
    });
    setCursor({ i: 0, f: 0 });
    setFresh(true);
  }, [makeNight]);

  const addAllGaps = useCallback(() => {
    setNights(prev => {
      const have = new Set(prev.map(n => n.date));
      const gaps = strip.filter(d => !have.has(d) && !existingFor(d)).map(makeNight);
      if (!gaps.length) return prev;
      return [...prev, ...gaps].sort((a, b) => (a.date < b.date ? 1 : -1));
    });
    setCursor({ i: 0, f: 0 });
    setFresh(true);
  }, [strip, existingFor, makeNight]);

  /* ── save ──────────────────────────────────────────────── */

  const save = useCallback(async () => {
    const payload: SleepEntry[] = nights
      .filter(n => !n.saved && ready(n))
      .map(n => ({
        date: n.date,
        name: user,
        ss: num(n.v.ss, 'ss') as number,
        rhr: num(n.v.rhr, 'rhr') as number,
        rem: num(n.v.rem, 'rem'),
        hrv: num(n.v.hrv, 'hrv'),
        journal: n.journal.trim() || null,
      }));
    if (!payload.length) {
      setBanner('Nicio noapte completă — scorul și RHR sunt obligatorii.');
      return;
    }

    setSaving(true);
    setBanner('');
    try {
      const res = await submitEntries(payload);
      const wrote = new Set(res.written);
      const errs = new Map(res.rejected.map(r => [r.date, r.error]));
      setNights(prev => prev.map(n => (
        wrote.has(n.date)
          ? { ...n, saved: true, error: '' }
          : errs.has(n.date)
            ? { ...n, error: errs.get(n.date) as string }
            : n
      )));

      const savedEntries = payload.filter(p => wrote.has(p.date));
      if (savedEntries.length) onSavedMany(savedEntries);

      // Put the cursor on the first night that bounced, so the fix is the next
      // thing you type instead of something you have to go find.
      if (res.rejected.length) {
        const at = nights.findIndex(n => n.date === res.rejected[0].date);
        if (at >= 0) { setCursor({ i: at, f: 0 }); setFresh(true); }
      }

      const leftToFill = nights.some(n => !n.saved && !wrote.has(n.date) && touched(n));
      if (savedEntries.length && !leftToFill) {
        setDoneEntries(savedEntries);
      } else if (res.rejected.length) {
        setBanner(`${res.written.length} salvate · ${res.rejected.length} de corectat`);
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  }, [nights, user, onSavedMany]);

  useEffect(() => { saveRef.current = () => { void save(); }; }, [save]);

  if (doneEntries) {
    return (
      <DoneScreen
        saved={doneEntries}
        user={user}
        onClose={onClose}
        label={mode === 'login' ? 'intră în dashboard' : 'înapoi la dashboard'}
        bare={mode === 'login'}
      />
    );
  }

  return (
    <div className={cn(
      'flex flex-col w-full overflow-hidden',
      mode === 'sheet'
        ? 'card max-h-[92vh] md:max-h-[86vh] rounded-b-none md:rounded-b-2xl'
        : 'max-h-[78vh]',
    )}>
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 shrink-0">
        <div className="min-w-0">
          <div className="label whitespace-nowrap">
            {nights.length === 1 ? 'Log · o noapte' : `Log · ${nights.length} nopți`}
          </div>
          <div className="text-lg font-bold leading-tight truncate">{fn}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {nights.length > 1 && (
            <span className="num text-[11px] text-[var(--color-fg-muted)] whitespace-nowrap">
              {readyCount}/{openCount} gata
            </span>
          )}
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Schimbă utilizatorul">←</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={mode === 'login' ? 'Intră fără log' : 'Închide'}>
            {mode === 'login' ? 'sari peste' : '×'}
          </Button>
        </div>
      </div>

      {/* banda nopților — two weeks at a glance; tap a night to add or drop it */}
      <div className="px-4 pb-3 shrink-0">
        <div className="flex items-end gap-1 overflow-x-auto pb-1" dir="rtl">
          {strip.map(d => {
            const ex = existingFor(d);
            const isSel = selected.has(d);
            const isSaved = !!nights.find(n => n.date === d)?.saved;
            const barH = ex ? 8 + Math.round((ex.ss / 100) * 22) : 10;
            return (
              <button
                key={d}
                type="button"
                dir="ltr"
                onClick={() => toggleDate(d)}
                aria-pressed={isSel}
                aria-label={`${fmtDate(d)} — ${ex ? `scor ${ex.ss}` : 'nelogat'}`}
                className={cn(
                  'shrink-0 w-7 flex flex-col items-center gap-1 py-1 rounded-lg transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                  isSel && 'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]',
                )}
              >
                <span
                  className={cn('w-3 rounded-sm transition-all', !ex && 'border border-dashed')}
                  style={{
                    height: barH,
                    background: ex ? ssColor(ex.ss) : 'transparent',
                    borderColor: ex ? 'transparent' : 'var(--color-fg-dim)',
                    opacity: isSaved || !ex ? 1 : 0.75,
                  }}
                />
                <span className={cn('num text-[9px]', isSel ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-dim)]')}>
                  {Number(d.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
        {gapCount > 0 && (
          <button
            type="button"
            onClick={addAllGaps}
            className="mt-1 text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
          >
            + adaugă {gapCount === 1 ? 'noaptea nelogată' : `cele ${gapCount} nopți nelogate`}
          </button>
        )}
      </div>

      {/* nights */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2 min-h-0">
        {nights.map((n, i) => {
          if (i !== cursor.i) {
            return <CompactNight key={n.date} night={n} user={user} onFocus={() => moveTo(i, 0)} />;
          }
          return (
            <div
              key={n.date}
              ref={activeRef}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                n.saved
                  ? 'border-[var(--color-good)]/40 bg-[var(--color-good)]/5'
                  : 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/[0.04]',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{fmtDateShort(n.date)}</span>
                <span className="flex items-center gap-1.5 text-[9px]">
                  {n.date === todayStr() && <Pill>azi</Pill>}
                  {n.had && !n.saved && <Pill tone="warn">rescrie</Pill>}
                  {n.saved && <Pill tone="good">salvat</Pill>}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {LOG_FIELDS.map((f, fi) => {
                  const raw = n.v[f.key];
                  const val = num(raw, f.key);
                  const isCursor = fi === cursor.f && !n.saved;
                  const bad = raw !== '' && val == null;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => moveTo(i, fi)}
                      aria-label={`${f.label} ${f.unit}`}
                      className={cn(
                        'rounded-lg border px-1 py-2 flex flex-col items-center gap-0.5 transition-all bg-[var(--color-card)]',
                        'focus-visible:outline-none',
                        isCursor
                          ? 'border-[var(--color-accent)] shadow-[0_0_0_3px_var(--color-accent-glow)]'
                          : bad
                            ? 'border-[var(--color-bad)]'
                            : raw === '' && f.required
                              ? 'border-dashed border-[var(--color-fg-dim)]'
                              : 'border-[var(--color-border)]',
                      )}
                    >
                      <span
                        className={cn('num font-bold text-xl leading-none', isCursor && !raw && 'caret-blink')}
                        style={{
                          color: bad
                            ? 'var(--color-bad)'
                            : val != null
                              ? metricColor(f.key, val, user)
                              : 'var(--color-fg-dim)',
                        }}
                      >
                        {raw || (isCursor ? '|' : '–')}
                      </span>
                      <span className="label text-[9px]">{f.label}</span>
                      {/* REM lives on a different Garmin screen than the other
                          three. Saying so on the field is why it's typed last. */}
                      {f.hint && (
                        <span className="text-[8px] leading-none text-[var(--color-fg-muted)] whitespace-nowrap">
                          ↗ {f.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {n.error && <div className="mt-2 text-[11px] text-[var(--color-bad)]">{n.error}</div>}

              {!n.saved && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedDate(d => (d === n.date ? null : n.date))}
                    className="mt-2 text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    {expandedDate === n.date ? '− notă' : '+ notă'}
                    {n.journal && expandedDate !== n.date && (
                      <span className="ml-1 text-[var(--color-accent)]">•</span>
                    )}
                  </button>
                  {expandedDate === n.date && (
                    <div className="mt-3 flex flex-col gap-3">
                      <textarea
                        value={n.journal}
                        onChange={e => setNights(prev => prev.map((x, idx) => (idx === i ? { ...x, journal: e.target.value } : x)))}
                        rows={2}
                        maxLength={500}
                        placeholder="cum a fost noaptea? (alcool, sport, stres...)"
                        className={cn(
                          'w-full px-3 py-2 rounded-lg text-xs resize-none',
                          'bg-[var(--color-card)] text-[var(--color-fg)] border border-[var(--color-border)]',
                          'placeholder:text-[var(--color-fg-dim)]',
                          'focus:outline-none focus:border-[var(--color-accent)]',
                        )}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {banner && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg text-[11px] shrink-0 bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 text-[var(--color-warn)]">
          {banner}
        </div>
      )}

      <div className="shrink-0">
        <NumPad
          onKey={pressKey}
          canSave={readyCount > 0}
          saving={saving}
          saveLabel={readyCount > 1 ? `Salvează ${readyCount} nopți` : 'Salvează noaptea'}
        />
      </div>
    </div>
  );
}

/* ── a night that isn't being typed: date, numbers so far, state ── */
function CompactNight({ night, user, onFocus }: { night: Night; user: string; onFocus: () => void }) {
  const ok = ready(night);
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        'w-full rounded-xl border px-3 py-2 flex flex-col gap-1 text-left transition-colors',
        night.saved
          ? 'border-[var(--color-good)]/30 bg-[var(--color-good)]/5'
          : night.error
            ? 'border-[var(--color-bad)]/40'
            : 'border-[var(--color-border)] hover:border-[var(--color-fg-dim)]',
      )}
    >
      <span className="flex items-center gap-3 w-full">
        <span className="text-xs font-semibold w-20 shrink-0 text-[var(--color-fg-muted)]">
          {fmtDateShort(night.date)}
        </span>
        <span className="flex-1 flex items-baseline gap-2 min-w-0">
          {LOG_FIELDS.map(f => {
            const val = num(night.v[f.key], f.key);
            return (
              <span
                key={f.key}
                className="num text-sm font-bold"
                style={{ color: val != null ? metricColor(f.key, val, user) : 'var(--color-fg-dim)' }}
              >
                {night.v[f.key] || '–'}
              </span>
            );
          })}
        </span>
        <span className="text-[10px] shrink-0 font-semibold">
          {night.saved ? <span className="text-[var(--color-good)]">✓</span>
            : night.error ? <span className="text-[var(--color-bad)]">corectează</span>
            : ok ? <span className="text-[var(--color-accent)]">gata</span>
            : <span className="text-[var(--color-fg-dim)]">gol</span>}
        </span>
      </span>
      {night.error && (
        <span className="text-[10px] text-[var(--color-bad)] leading-tight">{night.error}</span>
      )}
    </button>
  );
}

function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'warn' }) {
  const tones = {
    muted: 'bg-[var(--color-surface)] text-[var(--color-fg-muted)] border-[var(--color-border)]',
    good: 'bg-[var(--color-good)]/10 text-[var(--color-good)] border-[var(--color-good)]/30',
    warn: 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border-[var(--color-warn)]/30',
  } as const;
  return (
    <span className={cn('px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wider', tones[tone])}>
      {children}
    </span>
  );
}

/* ── after the write lands ── */
function DoneScreen({ saved, user, onClose, label, bare }: {
  saved: SleepEntry[];
  user: string;
  onClose: () => void;
  label: string;
  bare: boolean;
}) {
  const one = saved.length === 1 ? saved[0] : null;
  const tier = one ? ssTier(one.ss) : null;
  const ordered = [...saved].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className={cn('p-5 w-full max-w-md mx-auto', !bare && 'card')}>
      <div className="text-center mb-4">
        <div className="text-2xl mb-1">✓</div>
        <div className="font-bold text-lg">{one ? 'salvat' : `${saved.length} nopți salvate`}</div>
        <div className="text-[10px] text-[var(--color-fg-muted)] num">
          {one
            ? fmtDate(one.date)
            : `${fmtDate(ordered[ordered.length - 1].date)} → ${fmtDate(ordered[0].date)}`}
        </div>
      </div>

      {one && tier ? (
        <>
          <div className="text-center mb-4 py-4 rounded-xl dots">
            <div className="label mb-1">Sleep Score</div>
            <div className="flex items-baseline justify-center gap-2">
              <span className="num font-bold leading-none text-5xl sm:text-6xl" style={{ color: ssColor(one.ss) }}>
                {one.ss}
              </span>
              <span className="text-sm text-[var(--color-fg-muted)]">/100</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-2" style={{ color: tier.color }}>
              {tier.label}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1 mb-4 max-h-56 overflow-y-auto">
          {ordered.map(e => (
            <div key={e.date} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-fg-muted)] w-20 shrink-0">{fmtDateShort(e.date)}</span>
              <span className="num font-bold text-lg flex-1" style={{ color: ssColor(e.ss) }}>{e.ss}</span>
              <span className="num text-xs" style={{ color: rhrColor(e.rhr, personSex(user)) }}>{e.rhr} bpm</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" className="w-full" onClick={onClose}>{label}</Button>
    </div>
  );
}
