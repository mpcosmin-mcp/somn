/* Global chat panel toggle — fires a custom DOM event so any header button
   from any page can ask the layout-mounted ChatPanel to open/close. */

export const CHAT_EVENT = 'somn-chat-toggle';

export interface ChatToggleDetail {
  force?: 'open' | 'close';
  prompt?: string;   // when set, also auto-send this message after opening
}

export function toggleChat() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

export function openChat() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { force: 'open' } }));
}

export function closeChat() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: { force: 'close' } }));
}

/** Open chat panel and auto-send the given prompt as a user message. */
export function chatSend(prompt: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_EVENT, {
    detail: { force: 'open', prompt },
  }));
}
