'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FIRST_NAME, personColor } from '@/lib/sleep';
import { Avi } from '@/components/ui/avi';
import type { ChatMessage } from '@/app/api/chat/route';
import { REACTIONS, formatTime } from '@/components/chat/chat-utils';

/**
 * Single chat bubble — iMessage style, colored by sender.
 * Hover on desktop → emoji picker + delete-own action.
 * Reaction chips shown below the bubble.
 */
export function ChatBubble({ message, isMine, showAvatar, onReact, onDelete, currentUser }: {
  message: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
  onReact: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  currentUser: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const c = personColor(message.from);
  const fn = FIRST_NAME[message.from] ?? message.from.split(' ')[0];
  const reactions = message.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-7 shrink-0">
        {showAvatar ? <Avi name={message.from} size="sm" /> : null}
      </div>
      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} min-w-0 max-w-[75%]`}>
        {showAvatar && (
          <div className={`flex items-baseline gap-1.5 mb-0.5 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
            <span className="text-[11px] font-bold" style={{ color: c }}>{fn}</span>
            <span className="text-[9px] num text-[var(--color-fg-dim)]">{formatTime(message.ts)}</span>
          </div>
        )}
        <div className={`group relative rounded-2xl px-3 py-1.5 text-sm leading-snug break-words whitespace-pre-wrap ${
          isMine
            ? 'rounded-br-md text-white'
            : 'rounded-bl-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)]'
        }`} style={isMine ? {
          background: `linear-gradient(135deg, ${c}dd, ${c}88)`,
        } : undefined}>
          {message.text}
          <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? 'right-full mr-1' : 'left-full ml-1'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-1 py-0.5 shadow-lg`}>
            <button
              onClick={() => setShowPicker(p => !p)}
              className="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--color-surface)] transition-colors"
              aria-label="Adaugă reacție"
            >
              😀
            </button>
            {isMine && (
              <button
                onClick={() => onDelete(message.id)}
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-bad)] transition-colors p-0.5"
                aria-label="Șterge mesaj"
              >
                <Trash2 size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {showPicker && (
          <>
            <button
              aria-label="închide"
              className="fixed inset-0 z-10"
              onClick={() => setShowPicker(false)}
            />
            <div className={`relative z-20 mt-1 flex gap-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full px-1.5 py-1 shadow-lg`}>
              {REACTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => { onReact(message.id, e); setShowPicker(false); }}
                  className="text-base hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}

        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-0.5 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, users]) => {
              const active = users.includes(currentUser);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`text-[10px] rounded-full px-1.5 py-0.5 border transition-colors ${
                    active
                      ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 text-[var(--color-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)]/40'
                  }`}
                  title={users.map(u => FIRST_NAME[u] ?? u).join(', ')}
                >
                  <span>{emoji}</span>
                  <span className="num ml-0.5 font-bold">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
