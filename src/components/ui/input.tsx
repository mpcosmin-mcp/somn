'use client';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 px-3 rounded-lg num',
        'bg-[var(--color-card)] text-[var(--color-fg)]',
        'border border-[var(--color-border)]',
        'placeholder:text-[var(--color-fg-dim)]',
        'focus:outline-none focus:border-[var(--color-accent)]',
        'transition-colors',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';
