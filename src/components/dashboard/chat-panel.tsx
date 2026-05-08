'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user';
import { CHAT_EVENT } from '@/lib/chat-toggle';
import { ChatWidget } from '@/components/dashboard/chat-widget';

const OPEN_KEY = 'somn_chat_panel_open';

/**
 * Right-side slide-out chat panel. Mounted in root layout so it persists
 * across page navigations. Toggleable from anywhere via toggleChat() helper
 * (custom event). On lg+ screens, body content shifts left when open.
 */
export function ChatPanel() {
  const { user, hydrated } = useUser();
  const [open, setOpen] = useState(false);
  const [panelHydrated, setPanelHydrated] = useState(false);

  // Read saved open state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPEN_KEY);
      if (saved === '1') setOpen(true);
    } catch { /* ignore */ }
    setPanelHydrated(true);
  }, []);

  // Listen for global toggle events
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ force?: 'open' | 'close' }>).detail;
      if (detail?.force === 'open') setOpen(true);
      else if (detail?.force === 'close') setOpen(false);
      else setOpen(o => !o);
    };
    window.addEventListener(CHAT_EVENT, handler);
    return () => window.removeEventListener(CHAT_EVENT, handler);
  }, []);

  // Persist + apply body data attribute (for layout shift on desktop)
  useEffect(() => {
    if (!panelHydrated) return;
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
    document.body.dataset.chatPanel = open ? 'open' : 'closed';
    return () => { document.body.dataset.chatPanel = 'closed'; };
  }, [open, panelHydrated]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Don't render anything if no user yet (avoids flash)
  if (!hydrated || !user) return null;

  return (
    <>
      {/* Backdrop on mobile only */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-0 right-0 bottom-0 z-50
          w-full sm:w-[380px] lg:w-[360px]
          bg-[var(--color-bg)] border-l border-[var(--color-border)]
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-hidden={!open}
      >
        <ChatWidget user={user} onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
