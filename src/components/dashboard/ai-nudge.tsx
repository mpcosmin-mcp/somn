'use client';
import { useEffect, useState } from 'react';
import { type SleepEntry, FIRST_NAME } from '@/lib/sleep';
import { Card } from '@/components/ui/card';
import { chatSend } from '@/lib/chat-toggle';

/**
 * AINudge — small "ask the AI" card on the dashboard. Rotates a list of
 * playful, roasty prompts. Each click opens the side panel and pre-sends
 * the prompt as the user's first message so the AI replies immediately.
 *
 * The current prompt rotates on every page load (random pick).
 */

interface NudgePrompt {
  emoji: string;
  text: string;       // shown on the card
  prompt: string;     // sent to the AI (can differ from displayed text)
}

const PROMPTS: NudgePrompt[] = [
  { emoji: '🥇', text: 'cine a dormit ca un rege azi?', prompt: 'cine a dormit ca un rege aseară? roastuiește-i pe ceilalți 2.' },
  { emoji: '💀', text: 'cine a fost cel mai somnoros bătrân?', prompt: 'cine a avut cel mai prost SS în ultima săptămână și de ce crezi tu? fii direct.' },
  { emoji: '🏆', text: 'cine câștigă săptămâna asta?', prompt: 'cine câștigă săptămâna asta? cine pierde? mini-roast pentru ultimul.' },
  { emoji: '🍻', text: 'cine s-a făcut praf cu alcool?', prompt: 'caută în jurnale dacă cineva a băut și cum i-a stricat REM-ul.' },
  { emoji: '🌙', text: 'cum îmi cresc REM-ul?', prompt: 'uită-te la datele mele — ce-aș putea schimba ca să cresc REM-ul cu 15 min/noapte?' },
  { emoji: '👀', text: 'judecă-mă pentru aseară', prompt: 'judecă-mă fără milă pentru cum am dormit aseară. fii roasty.' },
  { emoji: '📊', text: 'cum stau eu vs echipa?', prompt: 'compară-mă cu Clara și Cornel pe SS, REM, RHR, HRV. cine e mai bun la ce?' },
  { emoji: '🎯', text: 'care zi îmi merge cel mai bine?', prompt: 'care zi a săptămânii e cea mai bună pentru mine la somn? bazează-te pe date reale.' },
  { emoji: '🔥', text: 'roastuiește pe cineva', prompt: 'alege pe cel mai rău din echipă în ultima săptămână și roastuieste-l cu drag.' },
  { emoji: '🎉', text: 'cine merită felicitări azi?', prompt: 'felicită pe cineva din echipă pentru ultima noapte. fii specific cu cifre.' },
  { emoji: '🤔', text: 'ce pattern stupid văd eu?', prompt: 'găsește un pattern surprinzător în datele mele pe care n-aș fi observat singur.' },
  { emoji: '🥱', text: 'sunt mai prost decât mama?', prompt: 'compară-mă cu un adult standard de 30 ani — sunt sub sau peste media populației pentru SS, REM, RHR?' },
];

function pickRandom(): NudgePrompt {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

export function AINudge({ user, entries }: { user: string; entries: SleepEntry[] }) {
  const [current, setCurrent] = useState<NudgePrompt | null>(null);
  const fn = FIRST_NAME[user] ?? user.split(' ')[0];

  useEffect(() => {
    setCurrent(pickRandom());
  }, []);

  if (!current) return null;
  if (entries.length < 2) return null; // skip when there's nothing to talk about

  const handleAsk = () => {
    // Personalize the prompt with first name
    const personalized = current.prompt.replace(/\b(eu|mie|mine|me)\b/gi, fn);
    chatSend(personalized);
  };

  const next = () => setCurrent(pickRandom());

  return (
    <Card className="px-4 py-3 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle at 100% 0%, rgba(163, 230, 53, 0.18), transparent 60%)' }}
      />
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 flex items-center justify-center text-lg shrink-0">
          {current.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="label mb-0.5">claude · ai e aici</div>
          <button
            onClick={handleAsk}
            className="text-sm font-semibold text-left hover:text-[var(--color-accent)] transition-colors w-full text-left leading-tight"
          >
            <span className="break-words">{current.text}</span>
            <span className="text-[var(--color-fg-muted)] text-xs font-normal block sm:inline sm:ml-1 mt-0.5">→ întreabă</span>
          </button>
        </div>
        <button
          onClick={next}
          aria-label="alt prompt"
          title="alt prompt"
          className="tap shrink-0 rounded-lg flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
    </Card>
  );
}
