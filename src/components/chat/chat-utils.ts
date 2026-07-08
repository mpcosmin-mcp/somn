export const REACTIONS = ['👍', '❤️', '😂', '🔥', '😴'] as const;
export const LAST_SEEN_KEY = 'somn-chat-lastseen';

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDate.getTime() === today.getTime()) return 'Azi';
  if (dDate.getTime() === yesterday.getTime()) return 'Ieri';
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}
