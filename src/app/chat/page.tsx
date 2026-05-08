'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { openChat } from '@/lib/chat-toggle';

/**
 * Legacy /chat URL — kept for backward compat with bookmarks.
 * The chat is now a global side panel; this just opens it and routes to /.
 */
export default function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
    setTimeout(() => openChat(), 100);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[var(--color-fg-muted)] text-sm num">
      ~$ redirecting to /...
    </div>
  );
}
