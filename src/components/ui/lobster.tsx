/* somn's AI mascot. A small friendly lobster — IT people love absurd thematic
   mascots, and red on dark mode looks great. Uses currentColor for accents so
   we can recolor via parent CSS. */

interface Props {
  size?: number;
  className?: string;
  /** Override the lobster body color (default: tomato red) */
  color?: string;
  /** Show a tiny chat dot in the corner (busy / talking state) */
  talking?: boolean;
}

export function Lobster({ size = 40, className, color = '#ef4444', talking }: Props) {
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
      {/* Antennae */}
      <path
        d="M22 16 L16 6 M42 16 L48 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="6" r="1.5" fill={color} />
      <circle cx="48" cy="6" r="1.5" fill={color} />

      {/* Left claw */}
      <ellipse cx="11" cy="26" rx="7" ry="5" fill={color} />
      <ellipse cx="11" cy="26" rx="3.5" ry="2.5" fill="#7f1d1d" opacity="0.4" />
      <path
        d="M6 24 L4 22 M6 28 L4 30"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Right claw */}
      <ellipse cx="53" cy="26" rx="7" ry="5" fill={color} />
      <ellipse cx="53" cy="26" rx="3.5" ry="2.5" fill="#7f1d1d" opacity="0.4" />
      <path
        d="M58 24 L60 22 M58 28 L60 30"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Body */}
      <ellipse cx="32" cy="32" rx="14" ry="13" fill={color} />

      {/* Body segments */}
      <path
        d="M19 32 Q32 36 45 32"
        stroke="#7f1d1d"
        strokeWidth="1"
        opacity="0.4"
        fill="none"
      />
      <path
        d="M21 38 Q32 42 43 38"
        stroke="#7f1d1d"
        strokeWidth="1"
        opacity="0.4"
        fill="none"
      />

      {/* Tail fan */}
      <path
        d="M22 45 Q32 56 42 45 Q42 50 38 53 Q32 56 26 53 Q22 50 22 45 Z"
        fill={color}
      />

      {/* Eyes — friendly */}
      <circle cx="26" cy="28" r="3" fill="white" />
      <circle cx="38" cy="28" r="3" fill="white" />
      <circle cx="26.5" cy="28.5" r="1.4" fill="#1f1f1f" />
      <circle cx="38.5" cy="28.5" r="1.4" fill="#1f1f1f" />
      {/* Eye highlights */}
      <circle cx="27" cy="27.5" r="0.6" fill="white" />
      <circle cx="39" cy="27.5" r="0.6" fill="white" />

      {/* Mouth — slight smile */}
      <path
        d="M28 34 Q32 36 36 34"
        stroke="#1f1f1f"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Optional talking dot */}
      {talking && (
        <circle cx="56" cy="10" r="4" fill="#a3e635">
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}
