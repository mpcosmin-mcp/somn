'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { useEntries } from '@/lib/entries-provider';
import { fetchPatterns, type Patterns } from '@/lib/client-api';
import { FIRST_NAME } from '@/lib/sleep';
import { weekKey } from '@/lib/utils';
import { openChat } from '@/lib/chat-toggle';
import { Card } from '@/components/ui/card';
import { Lobster } from '@/components/ui/lobster';

interface Topic {
  id: string;
  emoji: string;
  label: string;
  color: string;
  tagline: string;
  content: { title: string; body: string }[];
}

const TOPICS: Topic[] = [
  {
    id: 'rem', emoji: '🌙', label: 'REM', color: '#a78bfa',
    tagline: 'visele se fac aici · 90-120 min/noapte e ideal',
    content: [
      { title: 'Ce e REM?', body: 'Rapid Eye Movement — faza în care creierul consolidează memoria, învățarea, și procesează emoțiile. Adult sănătos: 90-120 min/noapte, ~20-25% din somnul total.' },
      { title: 'Alcoolul fură 20% din REM', body: 'Chiar și 1-2 pahare reduc REM-ul cu ~20% în prima jumătate a nopții. Corpul prioritizează metabolizarea alcoolului.' },
      { title: 'Camera rece = REM mai bun', body: '17-19°C optim. Peste 22°C → REM fragmentat. Termoreglarea consumă energie pe care creierul o vrea pentru cicluri REM.' },
      { title: 'REM crește spre dimineață', body: 'Primul ciclu = ~10 min. Ultimul (5-7 AM) = 60+ min. Trezirea cu alarma la 5:30 te scoate din cel mai bogat REM al nopții.' },
    ],
  },
  {
    id: 'deep', emoji: '💤', label: 'Deep Sleep', color: '#60a5fa',
    tagline: 'somnul profund · când corpul se reconstruiește',
    content: [
      { title: 'Ce e Deep Sleep?', body: 'Faza 3 (NREM) — somnul cel mai profund. Aici corpul își repară mușchii, eliberează hormoni de creștere, întărește sistemul imunitar. ~13-23% din noapte.' },
      { title: 'Concentrat în prima jumătate', body: 'Mai mult deep sleep apare în primele 3-4 ore. De aia "să te culci devreme" chiar contează — nu doar pentru durată totală.' },
      { title: 'Sport intens târziu strică Deep', body: 'HIIT sau cardio greu cu < 3h înainte de culcare ridică cortizolul + temperatura → deep sleep fragmentat. Sport ușor seara e OK.' },
      { title: 'Cofeina ucide deep, nu doar REM', body: 'Cofeina după 14:00 reduce deep sleep cu până la 30% chiar dacă reușești să adormi. Timpul de înjumătățire = 5-6h.' },
    ],
  },
  {
    id: 'hrv', emoji: '❤️', label: 'HRV', color: '#34d399',
    tagline: 'variabilitatea inimii · indicator de recovery',
    content: [
      { title: 'Ce e HRV?', body: 'Heart Rate Variability — diferența între intervalele bătăilor inimii. Înalt = sistem nervos echilibrat, recovery bun. Foarte personal — compară-l cu tine însuți, nu cu alții.' },
      { title: 'Cum îl ridic?', body: 'Somn de calitate (90+ min REM, 8h total), zile fără alcool, antrenament cu intensitate progresivă (nu doar maxim), respirație lentă 10 min/zi (4-7-8 breathing).' },
      { title: 'Cum îl scade?', body: 'Stres acumulat, alcool, mese târzii, lipsa somn, antrenament prea greu fără recovery. Dacă scade 3+ zile la rând = corpul cere repaus.' },
    ],
  },
  {
    id: 'rhr', emoji: '🫀', label: 'RHR', color: '#f59e0b',
    tagline: 'pulsul de repaus · sub 60 e fit',
    content: [
      { title: 'Ce e RHR?', body: 'Resting Heart Rate — bătăile pe minut când stai liniștit. Adult fit: 50-70. Sub 60 e foarte bun. Sub 50 e elite (atleți).' },
      { title: 'Scade cu fitness', body: 'Inima atletilor antrenați pompează mai mult sânge per bătaie → mai puține bătăi necesare. Antrenamentul aerob constant scade RHR cu 5-15 bpm în luni.' },
      { title: 'Crește când ești bolnav', body: 'Înainte să apară simptomele, RHR poate sări cu 5-10 bpm. E un early warning pentru răceală/gripă.' },
    ],
  },
  {
    id: 'score', emoji: '🎯', label: 'Sleep Score', color: '#a3e635',
    tagline: 'scor general · 75+ e recovery bun',
    content: [
      { title: 'Cum se calculează?', body: 'Combinație între durată totală, eficiență (timp adormit vs în pat), REM, deep sleep, și treziri.' },
      { title: 'Ce înseamnă SS 80+?', body: 'Recovery bun, ai dormit eficient, ești ready de zi. Sub 70 = ai nevoie de mai mult somn.' },
      { title: 'Sleep debt e real', body: '3 nopți consecutive sub SS 70 = sleep debt. Plătești prin reacții mai lente, decizii proaste, RHR mai mare.' },
    ],
  },
  {
    id: 'fun', emoji: '🎲', label: 'Fun fact', color: '#ec4899',
    tagline: 'șocant + util · curiozități',
    content: [
      { title: 'Adormim în 7 minute (sănătos)', body: 'Sub 5 min = ești prea obosit. Peste 30 min = anxietate sau stres. Sweet spot: 7-15 min.' },
      { title: 'Visăm în fiecare ciclu REM', body: 'Avem 4-6 cicluri REM pe noapte → minim 4 vise. Nu le ții minte pe toate.' },
      { title: 'Koala doarme 22h/zi', body: 'Liliacul brun: 20h. Tigru: 16h. Pe scală umană = weekend mode toată viața.' },
    ],
  },
];

/**
 * Top-of-dashboard action surface. One horizontal row of circular bubbles:
 *
 *   [💬 Hipnos]  [📊 patterns]  ⎮  [🌙][💤][❤️][🫀][🎯][🎲]
 *
 * • Hover any bubble → tooltip popover with label + tagline.
 * • Hipnos bubble → opens chat (pulsing ring = "live").
 * • Pattern bubble → opens AI pattern-finder modal.
 * • Topic bubbles → open educational modals.
 *
 * Horizontal scroll on small viewports; flex-wrap on tablet+.
 */
export function BubbleRow() {
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveTopic(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="flex items-end gap-2 sm:gap-3 overflow-x-auto overflow-y-visible pb-2 pt-12 -mx-1 px-1">
        <HipnosBubble />
        <PatternBubble />

        {/* Divider between Hipnos+Pattern and topics */}
        <div className="self-center w-px h-12 bg-[var(--color-border)] mx-1 shrink-0" />

        {TOPICS.map(t => (
          <TopicBubble key={t.id} topic={t} onOpen={() => setActiveTopic(t)} />
        ))}
      </div>

      {activeTopic && <TopicModal topic={activeTopic} onClose={() => setActiveTopic(null)} />}
    </>
  );
}

/* ─── Hipnos chat trigger ─── */
function HipnosBubble() {
  return (
    <div className="group relative flex flex-col items-center gap-1 shrink-0">
      <TooltipAbove color="rgba(132, 204, 22, 0.6)">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <span>Hipnos · <span className="text-[var(--color-accent)]">live</span></span>
        </div>
        <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">vorbește cu mine</div>
      </TooltipAbove>

      <button
        onClick={() => openChat()}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-bg)] border-2 border-[var(--color-accent)]/40 hover:border-[var(--color-accent)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative shadow-md"
        aria-label="Vorbește cu Hipnos"
      >
        <Lobster size={36} talking />
        <span className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]/40 animate-ping opacity-60 pointer-events-none" />
      </button>

      <span className="text-[9px] font-semibold text-[var(--color-accent)] group-hover:text-[var(--color-fg)] transition-colors">
        Hipnos
      </span>
    </div>
  );
}

/* ─── Pattern finder trigger ─── */
function PatternBubble() {
  const { user } = useUser();
  const { entries } = useEntries();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Patterns | null>(null);
  const [loading, setLoading] = useState(false);

  const wk = weekKey();
  const fn = user ? (FIRST_NAME[user] ?? user.split(' ')[0]) : '';

  useEffect(() => {
    if (!user) return;
    const cacheKey = `somn_patterns_${user}_${wk}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setData(JSON.parse(cached) as Patterns); return; }
    } catch { /* ignore */ }
    if (entries.length < 5) return;
    setLoading(true);
    fetchPatterns(user, entries)
      .then(p => {
        if (p.personal || p.team) {
          setData(p);
          try { localStorage.setItem(cacheKey, JSON.stringify(p)); } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false));
  }, [user, wk, entries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!user) return null;
  const color = '#60a5fa';

  return (
    <>
      <div className="group relative flex flex-col items-center gap-1 shrink-0">
        <TooltipAbove color={`${color}50`}>
          <div className="text-xs font-bold" style={{ color }}>Pattern finder</div>
          <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5">
            {loading ? 'caut pattern-uri...' : data ? `vezi insight pentru ${fn}` : 'apasă pentru insight'}
          </div>
        </TooltipAbove>

        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl sm:text-3xl transition-all hover:scale-110 active:scale-95 focus:outline-none"
          style={{
            background: `linear-gradient(135deg, ${color}30, ${color}10)`,
            border: `2px solid ${color}60`,
          }}
          aria-label="Pattern finder"
        >
          📊
        </button>

        <span className="text-[9px] font-semibold text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
          Pattern
        </span>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" aria-hidden />
          <div className="fixed z-[70] inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto" role="dialog">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: `${color}30`, border: `2px solid ${color}60` }}>📊</div>
                <div className="flex-1">
                  <div className="label">pattern finder · {wk}</div>
                  <div className="text-sm font-bold">despre {fn} + echipă</div>
                </div>
                <button onClick={() => setOpen(false)} className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors" aria-label="Închide">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {loading && <div className="text-xs italic text-[var(--color-fg-muted)] py-4 text-center">caut pattern-uri...</div>}
              {!loading && data && (
                <div className="space-y-4">
                  {data.personal && (
                    <div>
                      <div className="label mb-1.5">despre {fn}</div>
                      <p className="text-sm leading-relaxed">{data.personal}</p>
                    </div>
                  )}
                  {data.team && (
                    <div>
                      <div className="label mb-1.5">despre echipă</div>
                      <p className="text-sm leading-relaxed">{data.team}</p>
                    </div>
                  )}
                </div>
              )}
              {!loading && !data && (
                <p className="text-xs italic text-[var(--color-fg-dim)] py-4 text-center">
                  {entries.length < 5 ? 'minim 5 loguri necesare.' : 'AI nu a returnat nimic.'}
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Topic bubble ─── */
function TopicBubble({ topic, onOpen }: { topic: Topic; onOpen: () => void }) {
  return (
    <div className="group relative flex flex-col items-center gap-1 shrink-0">
      <TooltipAbove color={`${topic.color}50`}>
        <div className="text-xs font-bold" style={{ color: topic.color }}>{topic.label}</div>
        <div className="text-[10px] text-[var(--color-fg-muted)] mt-0.5 max-w-[200px] whitespace-normal">{topic.tagline}</div>
      </TooltipAbove>

      <button
        onClick={onOpen}
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl sm:text-3xl transition-all hover:scale-110 active:scale-95 focus:outline-none"
        style={{
          background: `linear-gradient(135deg, ${topic.color}30, ${topic.color}10)`,
          border: `2px solid ${topic.color}60`,
        }}
        aria-label={`Citește despre ${topic.label}`}
      >
        {topic.emoji}
      </button>

      <span className="text-[9px] font-semibold text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
        {topic.label}
      </span>
    </div>
  );
}

/* ─── Shared tooltip ─── */
function TooltipAbove({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl bg-[var(--color-bg)] border shadow-xl whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 pointer-events-none z-10 min-w-max"
      style={{ borderColor: color }}
    >
      {children}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b -mt-1"
        style={{ background: 'var(--color-bg)', borderColor: color }}
      />
    </div>
  );
}

/* ─── Topic modal (educational content) ─── */
function TopicModal({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" aria-hidden />
      <div className="fixed z-[70] inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto" role="dialog">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ background: `linear-gradient(135deg, ${topic.color}30, ${topic.color}10)`, border: `2px solid ${topic.color}60` }}
            >
              {topic.emoji}
            </div>
            <div className="flex-1">
              <div className="label" style={{ color: topic.color }}>topic</div>
              <div className="text-lg font-bold">{topic.label}</div>
            </div>
            <button onClick={onClose} className="tap rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors" aria-label="Închide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
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
      </div>
    </>
  );
}
