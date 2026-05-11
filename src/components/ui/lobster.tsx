/* somn's AI mascot — a sleepy capybara. Friendly, vibey, dev-loved meme
   energy. The closed crescent eyes + floating Z's nail the sleep theme.
   Component name stays `Lobster` for backward compat with imports; export
   is also as `Mascot` for new code. */

interface Props {
  size?: number;
  className?: string;
  /** Capy body color (default warm tan) */
  color?: string;
  /** Show floating Z's animating (busy/talking state) */
  talking?: boolean;
}

export function Lobster({ size = 40, className, color = '#b88a5a', talking }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-label="somn AI mascot"
      role="img"
    >
      {/* Subtle dark ground beneath for depth */}
      <ellipse cx="32" cy="58" rx="20" ry="2" fill="#000" opacity="0.15" />

      {/* Ears (left + right), behind the head */}
      <ellipse cx="18" cy="20" rx="5" ry="5.5" fill={color} />
      <ellipse cx="46" cy="20" rx="5" ry="5.5" fill={color} />
      {/* Inner ear shadow */}
      <ellipse cx="18" cy="21" rx="2.5" ry="3" fill="#5d4523" opacity="0.55" />
      <ellipse cx="46" cy="21" rx="2.5" ry="3" fill="#5d4523" opacity="0.55" />

      {/* Head — rounded square (capybara signature) */}
      <rect x="11" y="20" width="42" height="34" rx="18" fill={color} />

      {/* Cheek tufts (slightly darker, optional polish) */}
      <ellipse cx="14" cy="36" rx="3" ry="5" fill="#8e6a40" opacity="0.4" />
      <ellipse cx="50" cy="36" rx="3" ry="5" fill="#8e6a40" opacity="0.4" />

      {/* Sleepy crescent eyes — closed and content */}
      <path
        d="M22 32 Q26 35 30 32"
        stroke="#1f1f1f"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34 32 Q38 35 42 32"
        stroke="#1f1f1f"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Nose snout — small rounded rectangle */}
      <rect x="27" y="40" width="10" height="6" rx="3" fill="#3d2f1f" opacity="0.85" />

      {/* Subtle smile under the nose */}
      <path
        d="M28 48 Q32 51 36 48"
        stroke="#3d2f1f"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Floating Z's — sleep signal (animated when talking) */}
      <g className={talking ? 'animate-pulse' : undefined}>
        <text
          x="50"
          y="14"
          fill="#a3e635"
          fontSize="11"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
        >z</text>
        <text
          x="56"
          y="7"
          fill="#a3e635"
          fontSize="7"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
          opacity="0.7"
        >z</text>
      </g>
    </svg>
  );
}

/* Cleaner alias for new imports */
export { Lobster as Mascot };
