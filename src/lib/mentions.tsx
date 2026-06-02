'use client';
/* ─────────────────────────────────────────────────────────
   @mentions — render comment/reply text with @Firstname picked
   out in that person's color, and a small set of helpers for the
   composer quick-insert chips.

   Display-only: mentions are not stored separately, they're just
   parsed out of the existing text. Nothing touches the KV model.
   ───────────────────────────────────────────────────────── */
import { Fragment, type ReactNode } from 'react';
import { NAMES, FIRST_NAME, personColor } from '@/lib/sleep';

export interface Mentionable {
  first: string;
  full: string;
  color: string;
}

/** The people that can be @-mentioned (the team), with their colors. */
export const MENTIONABLES: Mentionable[] = NAMES.map(full => ({
  first: FIRST_NAME[full] ?? full.split(' ')[0],
  full,
  color: personColor(full),
}));

// Build one regex matching "@First" for any known first name, longest first
// so "@Clara" wins over a hypothetical "@Cla". Case-insensitive, and the
// trailing boundary stops "@Gabi" from also eating "@Gabriela".
const ESCAPED = [...MENTIONABLES]
  .sort((a, b) => b.first.length - a.first.length)
  .map(m => m.first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const MENTION_RE = new RegExp(`@(${ESCAPED.join('|')})\\b`, 'gi');

function colorForFirst(first: string): string {
  const m = MENTIONABLES.find(x => x.first.toLowerCase() === first.toLowerCase());
  return m ? m.color : 'var(--color-accent)';
}

/**
 * Render text, wrapping any @Firstname in a colored, slightly-tinted chip.
 * Falls back to plain text when there are no mentions.
 */
export function MentionText({ text }: { text: string }): ReactNode {
  if (!text) return text;
  MENTION_RE.lastIndex = 0;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`t${i}`}>{text.slice(last, m.index)}</Fragment>);
    const color = colorForFirst(m[1]);
    out.push(
      <span
        key={`m${i}`}
        className="font-bold rounded px-1 -mx-0.5"
        style={{ color, background: `${color}1a` }}
      >
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(<Fragment key={`t${i}`}>{text.slice(last)}</Fragment>);

  return <>{out}</>;
}

/** Append "@First " to an existing composer value, avoiding a double space. */
export function appendMention(value: string, first: string): string {
  const sep = value.length === 0 || value.endsWith(' ') ? '' : ' ';
  return `${value}${sep}@${first} `;
}
