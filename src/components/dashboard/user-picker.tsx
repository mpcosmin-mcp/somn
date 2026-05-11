'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry, NAMES, FIRST_NAME, personColor } from '@/lib/sleep';
import { calcXP, xpLevel, tierFor, streakFor } from '@/lib/gamify';
import { fetchAllEntries, submitEntry } from '@/lib/client-api';
import { todayStr } from '@/lib/utils';
import { Avi } from '@/components/ui/avi';

const QUICK_FIELDS: Array<{
  key: 'ss' | 'rhr' | 'hrv' | 'rem';
  label: string;
  unit: string;
  placeholder: string;
  min: number;
  max: number;
  required?: boolean;
}> = [
  { key: 'ss',  label: 'Sleep Score', unit: '/100', placeholder: '78',  min: 0,  max: 100, required: true },
  { key: 'rem', label: 'REM',         unit: 'min',  placeholder: '92',  min: 0,  max: 300 },
  { key: 'rhr', label: 'RHR',         unit: 'bpm',  placeholder: '58',  min: 30, max: 150, required: true },
  { key: 'hrv', label: 'HRV',         unit: 'ms',   placeholder: '52',  min: 0,  max: 200 },
];

/**
 * Login page — masterpiece edition.
 *
 *   STEP 1: pick your card (3 squad members)
 *   STEP 2: quick log inline (SS / REM / RHR / HRV) OR skip → dashboard
 *
 * All on one page. Aurora background, glassmorphism card.
 */
export function UserPicker({ onPick }: { onPick: (name: string) => void }) {
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    fetchAllEntries().then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const sortedNames = [...NAMES].sort((a, b) => calcXP(entries, b) - calcXP(entries, a));
  const todayAlreadyLogged = picked
    ? entries.some(e => e.name === picked && e.date === todayStr())
    : false;

  return (
    <main className="aurora min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="num text-4xl font-bold tracking-tight text-[var(--color-fg)]">somn</span>
        </div>
        <div className="text-xs uppercase tracking-[0.22em] text-[var(--color-fg-muted)] text-center mb-8 font-semibold">
          sleep · IT · ai
        </div>

        {!picked && (
          <PickerStep
            sortedNames={sortedNames}
            entries={entries}
            loading={loading}
            onPick={setPicked}
          />
        )}

        {picked && (
          <LogStep
            user={picked}
            already={todayAlreadyLogged}
            onBack={() => setPicked(null)}
            onDone={() => onPick(picked)}
          />
        )}

        <div className="mt-8 text-center">
          <div className="text-[10px] text-[var(--color-fg-dim)] num">
            built with next.js · powered by claude haiku
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── STEP 1: pick a user ──────────────────────────────── */
function PickerStep({
  sortedNames, entries, loading, onPick,
}: {
  sortedNames: string[];
  entries: SleepEntry[];
  loading: boolean;
  onPick: (n: string) => void;
}) {
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
          const tier = tierFor(lvl);
          const streak = streakFor(entries, n);
          const c = personColor(n);
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';

          return (
            <button
              key={n}
              onClick={() => onPick(n)}
              disabled={loading}
              className="group text-left transition-all hover:translate-x-1 active:scale-[0.99] disabled:opacity-50"
            >
              <div
                className="flex items-center gap-3 px-4 py-3.5 rounded-2xl relative overflow-hidden border transition-all"
                style={{
                  background: `linear-gradient(135deg, ${c}10, transparent 70%)`,
                  borderColor: 'rgba(148,163,184,0.14)',
                }}
              >
                <div className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
                <span className="text-base shrink-0 ml-1" aria-hidden>{medal}</span>
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
                  <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">
                    {tier.name}
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
          );
        })}
      </div>
    </div>
  );
}

/* ─── STEP 2: quick log form ───────────────────────────── */
function LogStep({
  user, already, onBack, onDone,
}: {
  user: string;
  already: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];
  const c = personColor(user);
  const [vals, setVals] = useState<{ ss: string; rem: string; rhr: string; hrv: string; journal: string }>({
    ss: '', rem: '', rhr: '', hrv: '', journal: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = vals.ss.trim() !== '' && vals.rhr.trim() !== '';

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await submitEntry({
        date: todayStr(),
        name: user,
        ss: Number(vals.ss),
        rhr: Number(vals.rhr),
        hrv: vals.hrv.trim() === '' ? null : Number(vals.hrv),
        rem: vals.rem.trim() === '' ? null : Number(vals.rem),
        journal: vals.journal.trim() === '' ? null : vals.journal.trim(),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'eroare la salvare');
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-5 sm:p-6 space-y-4 relative overflow-hidden">
      {/* Color accent at top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />

      <div className="flex items-center gap-3">
        <Avi name={user} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold" style={{ color: c }}>{fn}</div>
          <div className="text-[11px] text-[var(--color-fg-muted)]">
            {already ? 'azi e deja logat — poți reactualiza' : 'logul de azi · completează ce ai'}
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors px-2 py-1"
        >
          ← schimbă
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {QUICK_FIELDS.map(f => (
          <GlassInput
            key={f.key}
            label={f.label}
            unit={f.unit}
            placeholder={f.placeholder}
            value={vals[f.key]}
            onChange={v => setVals(s => ({ ...s, [f.key]: v }))}
            min={f.min}
            max={f.max}
            required={f.required}
            accent={c}
          />
        ))}
      </div>

      <div>
        <label className="label block mb-1.5">Jurnal · opțional</label>
        <input
          type="text"
          value={vals.journal}
          onChange={e => setVals(s => ({ ...s, journal: e.target.value }))}
          placeholder="cum a fost? (o notă scurtă)"
          maxLength={500}
          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:bg-white/8 transition-all"
        />
      </div>

      {error && (
        <div className="text-xs text-[var(--color-bad)] bg-[var(--color-bad)]/10 border border-[var(--color-bad)]/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={!canSave || saving}
          className="flex-1 rounded-xl px-4 py-3 font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canSave ? 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent-deep))' : 'rgba(255,255,255,0.06)',
            color: canSave ? '#fff' : 'var(--color-fg-muted)',
            boxShadow: canSave ? '0 8px 24px -8px var(--color-accent-glow)' : 'none',
          }}
        >
          {saving ? 'se salvează...' : already ? 'actualizează' : 'salvează și intră'}
        </button>
        <button
          onClick={onDone}
          className="rounded-xl px-4 py-3 text-xs font-semibold text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-all"
        >
          sari peste
        </button>
      </div>

      <div className="text-[10px] text-[var(--color-fg-dim)] text-center pt-1">
        sau vorbește cu Hipnos pe dashboard ca să loghezi conversațional
      </div>
    </div>
  );
}

/* ─── Glassmorphism input ──────────────────────────────── */
function GlassInput({
  label, unit, placeholder, value, onChange, min, max, required, accent,
}: {
  label: string;
  unit: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  required?: boolean;
  accent: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="rounded-xl px-3 py-2.5 border transition-all"
      style={{
        background: focused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        borderColor: focused ? accent : 'rgba(148,163,184,0.14)',
        boxShadow: focused ? `0 0 0 3px ${accent}22` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="label">{label}{required && <span className="text-[var(--color-accent)] ml-0.5">*</span>}</span>
        <span className="text-[9px] num text-[var(--color-fg-dim)]">{unit}</span>
      </div>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        min={min}
        max={max}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none num font-bold text-xl text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] placeholder:font-normal"
      />
    </div>
  );
}
