import { personColor, FIRST_NAME } from '@/lib/sleep';
import { cn } from '@/lib/utils';

const SIZE = { xs: 'w-5 h-5 text-[8px]', sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-14 h-14 text-sm' } as const;

export function Avi({ name, size = 'sm', className }: { name: string; size?: keyof typeof SIZE; className?: string }) {
  const c = personColor(name);
  const initial = (FIRST_NAME[name] ?? name).slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold tracking-tight shrink-0',
        SIZE[size],
        className,
      )}
      style={{ background: c + '20', color: c, border: `1px solid ${c}40` }}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
