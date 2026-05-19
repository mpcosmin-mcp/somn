import { personColor, FIRST_NAME } from '@/lib/sleep';
import { cn } from '@/lib/utils';

/**
 * Round avatar. Falls back to a colored initial if the image isn't present.
 *
 * Variants:
 *   • 'face' (default) — square crop biased to the upper-center of the poster,
 *     so the face fills the circle. Used everywhere except the login picker.
 *   • 'full' — shows the entire poster (with disco frame + title), no crop.
 *     Used on the login picker where the avatar gets a generous square area.
 *
 * Image lookup: `/avatars/<firstname-lower>.jpg` (petrica/clara/gabi). Drop
 * the source JPG in `public/avatars/` with that name and it shows up.
 */

const SIZE = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-sm',
  xl: 'w-24 h-24 text-xl',
  '2xl': 'w-32 h-32 text-2xl',
} as const;

type Size = keyof typeof SIZE;
type Variant = 'face' | 'full';

export function Avi({
  name,
  size = 'sm',
  variant = 'face',
  className,
}: {
  name: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const c = personColor(name);
  const fn = FIRST_NAME[name] ?? name.split(' ')[0];
  const initial = fn.slice(0, 1).toUpperCase();
  const src = `/avatars/${fn.toLowerCase()}.jpg`;

  // Face variant: crop tight to upper-middle so the face fills the circle.
  // Full variant: scale-down the whole poster into the circle so nothing is lost.
  const imgStyle =
    variant === 'face'
      ? { objectFit: 'cover' as const, objectPosition: '50% 22%', transform: 'scale(1.65)' }
      : { objectFit: 'cover' as const, objectPosition: 'center' };

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full font-bold tracking-tight shrink-0 overflow-hidden',
        SIZE[size],
        className,
      )}
      style={{ background: c + '20', color: c, border: `1px solid ${c}40` }}
      aria-label={name}
    >
      {/* Fallback initial sits behind; the image covers it when it loads. */}
      <span aria-hidden>{initial}</span>
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 w-full h-full"
        style={imgStyle}
        onError={(e) => {
          // No image for this user — hide the broken icon so the initial shows through.
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
