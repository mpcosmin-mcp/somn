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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

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
    } else {
      if (ssRef.current) ssRef.current.value = '';
      if (remRef.current) remRef.current.value = '';
      if (rhrRef.current) rhrRef.current.value = '';
      if (hrvRef.current) hrvRef.current.value = '';
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

    if (isNaN(ss) || isNaN(rhr)) {
      setErr('SS și RHR sunt obligatorii');
      return;
    }
    if (ss < 0 || ss > 100) { setErr('SS trebuie între 0–100'); return; }
    if (rhr < 30 || rhr > 150) { setErr('RHR în afara intervalului plauzibil'); return; }

    setSaving(true);
    const entry: SleepEntry = { date, name: user, ss, rhr, hrv, rem };
    try {
      await submitEntry(entry);
      onSaved(entry);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

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
