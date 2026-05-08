'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/card';

/* Evidence-based REM facts — short, concrete, actionable */
const TIPS: { title: string; body: string }[] = [
  {
    title: 'Alcoolul fură 20% din REM',
    body: 'Chiar și 1-2 pahare reduc REM-ul cu ~20% în prima jumătate a nopții. Corpul prioritizează metabolizarea alcoolului în loc de cicluri REM.',
  },
  {
    title: 'Sport intens după 21:00',
    body: 'Antrenamentele HIIT târzii cresc cortizolul și temperatura corporală. Cardio-ul ușor e OK, dar HIIT cu < 3h înainte de somn taie 30+ min REM.',
  },
  {
    title: 'Cofeina după 14:00',
    body: 'Timpul de înjumătățire al cofeinei e 5-6h. Espresso la 16:00 = jumătate din ea încă activă la 22:00. REM scade direct.',
  },
  {
    title: 'REM crește spre dimineață',
    body: 'Primul ciclu REM = ~10 min. Ultimul (5-7 a.m.) = 60+ min. Trezirea cu alarma la 5:30 a.m. te scoate din cel mai bogat REM al nopții.',
  },
  {
    title: 'Camera rece = REM mai bun',
    body: '17-19°C optim. Peste 22°C = REM fragmentat. Termoreglarea consumă energie pe care creierul o vrea pentru ciclurile REM.',
  },
  {
    title: 'Mese târzii blochează REM',
    body: 'Digestia activă în primele 2-3h de somn ține corpul în "mod muncă". Last meal cu 3h+ înainte de culcare = REM cu până la 25% mai mult.',
  },
  {
    title: 'Stres → REM mai mult, dar prost',
    body: 'Anxietatea CREȘTE REM-ul (creierul procesează emoțiile), dar îl fragmentează. Mai mult timp în REM, dar calitate mai slabă. Vise vii ≠ recuperare bună.',
  },
];

export function RemEducation() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="px-5 py-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="label">REM 101 · de ce contează</div>
          <div className="text-sm font-semibold mt-0.5">7 lucruri concrete care îți ajustează REM-ul</div>
        </div>
        <span className="text-[var(--color-fg-muted)] text-lg">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
          <div className="text-xs text-[var(--color-fg-muted)] mb-2">
            REM (Rapid Eye Movement) e fază în care creierul consolidează memoria, învățarea, și procesează emoțiile.
            Adult sănătos: <span className="num font-bold text-[var(--color-fg)]">90-120 min/noapte</span>, ~20-25% din somnul total.
          </div>
          {TIPS.map((t, i) => (
            <div key={i} className="border-l-2 border-[var(--color-accent)] pl-3">
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-xs text-[var(--color-fg-muted)] mt-0.5 leading-relaxed">{t.body}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
