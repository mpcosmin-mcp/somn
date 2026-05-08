'use client';
import { useState, useRef, useEffect } from 'react';
import { type SleepEntry, ssColor, rhrColor, hrvColor, remColor, ssTier, FIRST_NAME } from '@/lib/sleep';
import { todayStr, fmtDate, cn } from '@/lib/utils';
import { submitEntry } from '@/lib/client-api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Metric } from '@/components/ui/metric';

export function LogEntry({
  user,
  entries,
  onSaved,
  onClose,
}: {
  user: string;
  entries: SleepEntry[];
  onSaved: (e: SleepEntry) => void;
  onClose?: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [journal, setJournal] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedEntry, setSavedEntry] = useState<SleepEntry | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{ text: string; mode: 'celebrate' | 'observe' | 'roast' | null } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const ssRef = useRef<HTMLInputElement>(null);
  const remRef = useRef<HTMLInputElement>(null);
  const rhrRef = useRef<HTMLInputElement>(null);
  const hrvRef = useRef<HTMLInputElement>(null);

  // Pre-existing entry for the selected date?
  const existing = entries.find(e => e.date === date && e.name === user);
  const isToday = date === todayStr();

  useEffect(() => {
    if (existing) {
      if (ssRef.current) ssRef.current.value = String(existing.ss);
      if (remRef.current) remRef.current.value = existing.rem != null ? String(existing.rem) : '';
      if (rhrRef.current) rhrRef.current.value = String(existing.rhr);
      if (hrvRef.current) hrvRef.current.value = existing.hrv != null ? String(existing.hrv) : '';
      setJournal(existing.journal ?? '');
    } else {
      if (ssRef.current) ssRef.current.value = '';
      if (remRef.current) remRef.current.value = '';
      if (rhrRef.current) rhrRef.current.value = '';
      if (hrvRef.current) hrvRef.current.value = '';
      setJournal('');
    }
  }, [date, existing]);

  const handleSave = async () => {
    setErr('');
    const ss = parseFloat(ssRef.current?.value || '');
    const rhr = parseFloat(rhrRef.current?.value || '');
    const remVal = remRef.current?.value;
    const hrvVal = hrvRef.current?.value;
    const rem = remVal ? parseFloat(remVal) : null;
    const hrv = hrvVal ? parseFloat(hrvVal) : null;
    const journalText = journal.trim();

    if (isNaN(ss) || isNaN(rhr)) {
      setErr('SS și RHR sunt obligatorii');
      return;
    }
    if (ss < 0 || ss > 100) { setErr('SS trebuie între 0–100'); return; }
    if (rhr < 30 || rhr > 150) { setErr('RHR în afara intervalului plauzibil'); return; }

    setSaving(true);
    const entry: SleepEntry = { date, name: user, ss, rhr, hrv, rem, journal: journalText || null };
    try {
      await submitEntry(entry);
      // Notify parent (so it merges into state) BUT don't close yet — show instant feedback first
      onSaved(entry);
      setSavedEntry(entry);
      // Bust cached roast for this date so next dashboard view re-runs with new data
      try { localStorage.removeItem(`somn_roast_${user}_${date}_j${(existing?.journal?.length ?? 0)}`); } catch { /* ignore */ }
      // Fire AI feedback in background
      setAiLoading(true);
      const recentMine = entries
        .filter(e => !(e.date === date && e.name === user))   // exclude old version
        .concat(entry)                                          // include just-saved
        .filter(e => e.name === user)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);
      try {
        const res = await fetch('/api/roast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: user, entries: recentMine }),
        });
        const data = await res.json() as { text?: string; mode?: 'celebrate' | 'observe' | 'roast' };
        if (data.text) {
          setAiFeedback({ text: data.text, mode: data.mode ?? null });
          // Cache the fresh roast for the dashboard widget
          try {
            const cacheKey = `somn_roast_${user}_${date}_j${(entry.journal?.length ?? 0)}`;
            localStorage.setItem(cacheKey, JSON.stringify({ text: data.text, mode: data.mode }));
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      setAiLoading(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  // ── INSTANT FEEDBACK SCREEN ──
  if (savedEntry) {
    const mode = aiFeedback?.mode;
    const meta = mode === 'celebrate'
      ? { icon: '🎉', label: 'celebration', accent: '#a3e635' }
      : mode === 'roast'
      ? { icon: '🔥', label: 'roast', accent: '#f87171' }
      : { icon: '👀', label: 'observation', accent: '#60a5fa' };
    const tier = ssTier(savedEntry.ss);

    return (
      <Card className="p-5 max-w-md mx-auto w-full">
        <div className="text-center mb-4">
          <div className="text-2xl mb-1">✓</div>
          <div className="font-bold text-lg">salvat</div>
          <div className="text-[10px] text-[var(--color-fg-muted)] num">{fmtDate(savedEntry.date)}</div>
        </div>

        {/* Hero: SS giant */}
        <div className="text-center mb-4 py-4 rounded-xl dots">
          <div className="label mb-1">Sleep Score</div>
          <div className="flex items-baseline justify-center gap-2">
            <span
              className="num font-bold leading-none text-6xl"
              style={{ color: ssColor(savedEntry.ss) }}
            >
              {savedEntry.ss}
            </span>
            <span className="text-sm text-[var(--color-fg-muted)]">/100</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-2" style={{ color: tier.color }}>
            {tier.label}
          </div>
        </div>

        {/* REM / RHR / HRV grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="REM" value={savedEntry.rem}  unit="min"  color={savedEntry.rem != null ? remColor(savedEntry.rem) : '#52525b'} />
          <Stat label="RHR" value={savedEntry.rhr}  unit="bpm"  color={rhrColor(savedEntry.rhr)} />
          <Stat label="HRV" value={savedEntry.hrv}  unit="ms"   color={hrvColor(savedEntry.hrv)} />
        </div>

        {/* AI feedback */}
        <div
          className="px-3 py-3 rounded-xl border mb-4"
          style={{
            background: `linear-gradient(135deg, ${meta.accent}10, transparent 70%)`,
            borderColor: `${meta.accent}40`,
          }}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-lg shrink-0">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="label mb-1" style={{ color: meta.accent }}>claude · {meta.label}</div>
              {aiLoading && (
                <div className="text-xs text-[var(--color-fg-muted)] italic">se generează feedback...</div>
              )}
              {!aiLoading && aiFeedback?.text && (
                <p className="text-xs leading-relaxed">{aiFeedback.text}</p>
              )}
              {!aiLoading && !aiFeedback && (
                <p className="text-xs text-[var(--color-fg-dim)] italic">AI offline — verifică ANTHROPIC_API_KEY</p>
              )}
            </div>
          </div>
        </div>

        <Button variant="primary" className="w-full" onClick={onClose}>ok, înapoi la dashboard</Button>
      </Card>
    );
  }

  // ── DEFAULT EDIT FORM ──
  return (
    <Card className="p-5 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label">{isToday ? 'Log azi' : 'Log retroactiv'}</div>
          <div className="text-lg font-bold">{fn}</div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        )}
      </div>

      {/* Date picker */}
      <div className="mb-4">
        <label className="label block mb-1.5">Data</label>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={e => setDate(e.target.value)}
          className={cn(
            'w-full h-10 px-3 rounded-lg num',
            'bg-[var(--color-card)] text-[var(--color-fg)]',
            'border border-[var(--color-border)]',
            'focus:outline-none focus:border-[var(--color-accent)]',
          )}
        />
        <div className="text-[10px] text-[var(--color-fg-muted)] mt-1">{fmtDate(date)}</div>
      </div>

      {/* 4 metric grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field ref={ssRef}  label="Sleep Score" hint="0-100"  ph="85" />
        <Field ref={remRef} label="REM"         hint="minute" ph="95" />
        <Field ref={rhrRef} label="RHR"         hint="bpm"    ph="58" />
        <Field ref={hrvRef} label="HRV"         hint="ms"     ph="45" />
      </div>

      {/* Optional journal */}
      <div className="mb-4">
        <label className="label block mb-1.5">notă · opțional</label>
        <textarea
          value={journal}
          onChange={e => setJournal(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="cum te-ai simțit? de ce crezi că ai dormit așa? (alcool, sport, stres, ce-ai mâncat...)"
          className={cn(
            'w-full px-3 py-2 rounded-lg text-xs resize-none',
            'bg-[var(--color-card)] text-[var(--color-fg)]',
            'border border-[var(--color-border)]',
            'placeholder:text-[var(--color-fg-dim)]',
            'focus:outline-none focus:border-[var(--color-accent)]',
          )}
        />
        <div className="text-[9px] text-[var(--color-fg-dim)] num text-right mt-0.5">
          {journal.length}/500 · AI-ul folosește nota asta când te roastuieste
        </div>
      </div>

      {existing && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          Date deja logate pentru {fmtDate(date)} — salvarea va suprascrie.
        </div>
      )}

      {err && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
          {err}
        </div>
      )}

      <Button variant="primary" className="w-full" disabled={saving} onClick={handleSave}>
        {saving ? 'Salvăm...' : isToday ? 'Salvează' : 'Salvează retroactiv'}
      </Button>
    </Card>
  );
}

/* Local sub-component */
import { forwardRef } from 'react';
const Field = forwardRef<HTMLInputElement, { label: string; hint: string; ph: string }>(
  ({ label, hint, ph }, ref) => (
    <div className="flex flex-col gap-1">
      <label className="label">{label}</label>
      <Input
        ref={ref}
        type="number"
        inputMode="numeric"
        placeholder={ph}
        className="text-center text-lg font-bold"
      />
      <span className="text-[10px] text-[var(--color-fg-muted)] text-center">{hint}</span>
    </div>
  ),
);
Field.displayName = 'Field';

/* Compact stat tile for the post-save feedback screen */
function Stat({ label, value, unit, color }: { label: string; value: number | null; unit: string; color: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-2 text-center">
      <div className="label mb-0.5">{label}</div>
      <div className="num font-bold text-lg leading-none" style={{ color: value == null ? '#52525b' : color }}>
        {value ?? '—'}
      </div>
      <div className="text-[9px] text-[var(--color-fg-muted)] mt-0.5">{unit}</div>
    </div>
  );
}

/* Convenience: tier preview after save (used elsewhere) */
export function SavedSummary({ entry }: { entry: SleepEntry }) {
  const tier = ssTier(entry.ss);
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <Metric label="SS"  value={entry.ss}  unit="/100" color={ssColor(entry.ss)}   size="md" />
      <Metric label="REM" value={entry.rem} unit="min"  color={remColor(entry.rem)} size="md" />
      <Metric label="RHR" value={entry.rhr} unit="bpm"  color={rhrColor(entry.rhr)} size="md" />
      <Metric label="HRV" value={entry.hrv} unit="ms"   color={hrvColor(entry.hrv)} size="md" />
      <div className="ml-auto self-end text-xs font-bold" style={{ color: tier.color }}>{tier.label}</div>
    </div>
  );
}
