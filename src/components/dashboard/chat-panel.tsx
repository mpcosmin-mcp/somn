'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT, type ChatToggleDetail } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';

/**
 * Hipnos chat — slide-in panel from the LEFT.
 *
 * No floating bubble. The trigger lives in the left sidebar (`ChatTrigger`
 * is rendered there). When toggled, this panel slides out from the left,
 * sitting flush against (or replacing on mobile) the sidebar.
 *
 * Width: 380px on lg, 460px on xl. Full-screen overlay on small viewports.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ChatToggleDetail>).detail;
      if (detail?.force === 'open') setOpen(true);
      else if (detail?.force === 'close') setOpen(false);
      else setOpen(o => !o);
      if (detail?.prompt) setPendingPrompt(detail.prompt);
    };
    window.addEventListener(CHAT_EVENT, handler);
    return () => window.removeEventListener(CHAT_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hydrated || !user) return null;

  return (
    <>
      {/* Backdrop dim — covers whole viewport */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden
      />

      {/* Panel: slides in from the LEFT.
         - Mobile: full-screen (inset-0 with safe-area).
         - lg+: docked next to the sidebar (left:260px / xl:280px), 380-460px wide. */}
      <div
        className={`fixed z-50 flex flex-col bg-[var(--color-bg)] border-r border-[var(--color-border)] shadow-2xl shadow-black/40 overflow-hidden
          inset-0 sm:inset-y-3 sm:left-3 sm:right-auto sm:w-[420px] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-2xl sm:border
          lg:inset-y-4 lg:left-[268px] lg:w-[380px] lg:rounded-2xl
          xl:left-[288px] xl:w-[460px]
          transform-gpu transition-all duration-250 ease-out origin-left
          ${open
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-4 pointer-events-none'}
        `}
        aria-hidden={!open}
        role="dialog"
        aria-label="Chat cu Hipnos"
      >
        <ChatWidget
          user={user}
          onClose={() => setOpen(false)}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt(null)}
        />
      </div>
    </>
  );
}
