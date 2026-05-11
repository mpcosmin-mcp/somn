'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';

/**
 * Instagram-story-style horizontal row of circular topic banners.
 * Each circle = an educational topic; click → modal with content.
 * Replaces the old REM 101 expandable card with something snackable.
 */

interface Topic {
  id: string;
  emoji: string;
  label: string;
  color: string;
  /** The lessons. Each item is one "bullet" with a title + body. */
  content: { title: string; body: string }[];
}

const TOPICS: Topic[] = [
  {
    id: 'rem',
    emoji: '🌙',
    label: 'REM',
    color: '#a78bfa',
    content: [
      { title: 'Ce e REM?', body: 'Rapid Eye Movement — faza în care creierul consolidează memoria, învățarea, și procesează emoțiile. Adult sănătos: 90-120 min/noapte, ~20-25% din somnul total.' },
      { title: 'Alcoolul fură 20% din REM', body: 'Chiar și 1-2 pahare reduc REM-ul cu ~20% în prima jumătate a nopții. Corpul prioritizează metabolizarea alcoolului.' },
      { title: 'Camera rece = REM mai bun', body: '17-19°C optim. Peste 22°C → REM fragmentat. Termoreglarea consumă energie pe care creierul o vrea pentru cicluri REM.' },
      { title: 'REM crește spre dimineață', body: 'Primul ciclu = ~10 min. Ultimul (5-7 AM) = 60+ min. Trezirea cu alarma la 5:30 te scoate din cel mai bogat REM al nopții.' },
    ],
  },
  {
    id: 'deep',
    emoji: '💤',
    label: 'Deep Sleep',
    color: '#60a5fa',
    content: [
      { title: 'Ce e Deep Sleep?', body: 'Faza 3 (NREM) — somnul cel mai profund. Aici corpul își repară mușchii, eliberează hormoni de creștere, întărește sistemul imunitar. ~13-23% din noapte.' },
      { title: 'Concentrat în prima jumătate', body: 'Mai mult deep sleep apare în primele 3-4 ore. De aia "să te culci devreme" chiar contează — nu doar pentru durată totală.' },
      { title: 'Sport intens târziu strică Deep', body: 'HIIT sau cardio greu cu < 3h înainte de culcare ridică cortizolul + temperatura → deep sleep fragmentat. Sport ușor seara e OK.' },
      { title: 'Cofeina ucide deep, nu doar REM', body: 'Cofeina după 14:00 reduce deep sleep cu până la 30% chiar dacă reușești să adormi. Timpul de înjumătățire = 5-6h.' },
    ],
  },
  {
    id: 'hrv',
    emoji: '❤️',
    label: 'HRV',
    color: '#34d399',
    content: [
      { title: 'Ce e HRV?', body: 'Heart Rate Variability — diferența între intervalele bătăilor inimii. Înalt = sistem nervos echilibrat, recovery bun. Foarte personal — compară-l cu tine însuți, nu cu alții.' },
      { title: 'Cum îl ridic?', body: 'Somn de calitate (90+ min REM, 8h total), zile fără alcool, antrenament cu intensitate progresivă (nu doar maxim), respirație lentă 10 min/zi (4-7-8 breathing).' },
      { title: 'Cum îl scade?', body: 'Stres acumulat, alcool, mese târzii, lipsa somn, antrenament prea greu fără recovery. Dacă scade 3+ zile la rând = corpul cere repaus.' },
      { title: 'Femeile au HRV diferit', body: 'Ciclul menstrual influențează HRV — scade în luteală, urcă în foliculară. Normal, nu un semn că ceva e greșit.' },
    ],
  },
  {
    id: 'rhr',
    emoji: '🫀',
    label: 'RHR',
    color: '#f59e0b',
    content: [
      { title: 'Ce e RHR?', body: 'Resting Heart Rate — bătăile pe minut când stai liniștit. Adult fit: 50-70. Sub 60 e foarte bun. Sub 50 e elite (atleți).' },
      { title: 'Scade cu fitness', body: 'Inima atletilor antrenați pompează mai mult sânge per bătaie → mai puține bătăi necesare. Antrenamentul aerob constant scade RHR cu 5-15 bpm în luni.' },
      { title: 'Crește când ești bolnav', body: 'Înainte să apară simptomele, RHR poate sări cu 5-10 bpm. E un early warning pentru răceală/gripă.' },
      { title: 'Variază cu vârsta', body: 'Tinerii au RHR mai mic în general. Dar fitness-ul îl bate pe vârstă — mai mult mișcare = RHR mai mic, indiferent de an.' },
    ],
  },
  {
    id: 'score',
    emoji: '🎯',
    label: 'Sleep Score',
    color: '#a3e635',
    content: [
      { title: 'Cum se calculează?', body: 'Combinație între durată totală, eficiență (timp adormit vs în pat), REM, deep sleep, și treziri. Fiecare wearable folosește formula lui — Garmin, Oura, Whoop dau scoruri diferite pentru aceeași noapte.' },
      { title: 'Ce înseamnă SS 80+?', body: 'Recovery bun, ai dormit eficient, ești ready de zi. Sub 70 = ai nevoie de mai mult somn în următoarele nopți să compensezi.' },
      { title: 'Sleep debt e real', body: '3 nopți consecutive sub SS 70 = sleep debt. Plătești prin reacții mai lente, decizii proaste, RHR mai mare. Recovery: minim 2 nopți de SS 85+.' },
    ],
  },
  {
    id: 'fun',
    emoji: '🎲',
    label: 'Fun fact',
    color: '#ec4899',
    content: [
      { title: 'Adormim în 7 minute (sănătos)', body: 'Sub 5 min = ești prea obosit (sleep deprived). Peste 30 min = anxietate sau stres. Sweet spot: 7-15 min.' },
      { title: 'Visăm în fiecare ciclu REM', body: 'Avem 4-6 cicluri REM pe noapte → minim 4 vise. Nu le ții minte pe toate pentru că, în mod normal, nu te trezești între cicluri.' },
      { title: 'Animalele care dorm cel mai mult', body: 'Koala: 22h/zi. Liliacul brun: 20h/zi. Tigru: 16h. Pe o scală umană, asta ar fi "weekend mode" în fiecare zi.' },
      { title: 'Insomnia fatală e reală', body: 'O boală genetică (FFI) împiedică somnul. Pacienții mor în 6-18 luni. Demonstrează că somnul nu e luxul — e necesar pentru supraviețuire.' },
      { title: 'Visele sunt mai vii primăvara', body: 'Studiile arată că melatonina crește mai brusc în nopțile cu temperaturi mai joase + lumina dimineții mai timpurie = REM mai intens primăvara/toamna.' },
    ],
  },
];

export function TopicBanners() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = TOPICS.find(t => t.id === activeId) ?? null;

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {TOPICS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className="group flex flex-col items-center gap-1 shrink-0 focus:outline-none"
            aria-label={`Citește despre ${t.label}`}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all group-hover:scale-105 group-active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${t.color}30, ${t.color}10)`,
                border: `2px solid ${t.color}60`,
              }}
            >
              {t.emoji}
            </div>
            <span className="text-[9px] font-semibold text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Modal */}
      {active && <TopicModal topic={active} onClose={() => setActiveId(null)} />}
    </>
  );
}

function TopicModal({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <Card className="w-full max-w-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{
              background: `linear-gradient(135deg, ${topic.color}30, ${topic.color}10)`,
              border: `2px solid ${topic.color}60`,
            }}
          >
            {topic.emoji}
          </div>
          <div className="flex-1">
            <div className="label" style={{ color: topic.color }}>topic</div>
            <div className="text-lg font-bold">{topic.label}</div>
          </div>
          <button
            onClick={onClose}
            className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Închide"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {topic.content.map((c, i) => (
            <div key={i} className="border-l-2 pl-3" style={{ borderColor: topic.color }}>
              <div className="text-sm font-semibold mb-0.5">{c.title}</div>
              <div className="text-xs text-[var(--color-fg-muted)] leading-relaxed">{c.body}</div>
            </div>
          ))}
        </div>
      </Card>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" aria-hidden />
      <div className="fixed z-[70] inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto pointer-events-auto" role="dialog">
        {children}
      </div>
    </>
  );
}
