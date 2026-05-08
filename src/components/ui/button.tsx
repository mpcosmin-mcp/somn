'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-[var(--color-card)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-fg-dim)]',
  ghost: 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)]',
  destructive: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'secondary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight',
        'transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
