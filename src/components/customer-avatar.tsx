import { brand } from "../../config/index.ts";
/*
 * The portrait's own palette.
 *
 * These are art, not theme, and they are named rather than themed on purpose:
 * a skin tone that shifted with whatever colour a shop picked for its brand
 * would be worse than one that does not move at all. The guard in
 * tests/no-brand-literals.test.ts is told to allow exactly these three.
 */
const ART = {
  hair: "#3a2416", // brand-literal-ok: illustration, deliberately not a token
  skin: "#f2c199", // brand-literal-ok: illustration, deliberately not a token
  line: "#241408", // brand-literal-ok: illustration, deliberately not a token
};

export function CustomerAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`Illustrated portrait of a happy ${brand.name} customer`}
    >
      <circle cx="100" cy="100" r="96" fill="var(--color-accent-300)" />
      <circle cx="150" cy="46" r="14" fill="var(--color-brand-700)" />
      <circle cx="34" cy="140" r="8" fill="var(--color-brand-700)" />

      {/* head */}
      <ellipse cx="100" cy="92" rx="46" ry="50" fill={ART.hair} />
      {/* face */}
      <ellipse cx="100" cy="104" rx="34" ry="38" fill={ART.skin} />
      {/* hair */}
      <path
        d="M56 92c0-30 20-52 44-52s44 22 44 52c0-10-8-18-10-8-4-16-16-24-34-24s-30 8-34 24c-2-10-10-2-10 8Z"
        fill={ART.line}
      />
      {/* eyes */}
      <circle cx="86" cy="100" r="4.5" fill={ART.line} />
      <circle cx="114" cy="100" r="4.5" fill={ART.line} />
      {/* blush */}
      <circle cx="78" cy="114" r="6" fill="var(--color-brand-300)" opacity="0.6" />
      <circle cx="122" cy="114" r="6" fill="var(--color-brand-300)" opacity="0.6" />
      {/* big happy smile */}
      <path
        d="M80 116c6 12 34 12 40 0"
        stroke={ART.line}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* bowl of noodles under chin, because of course */}
      <path d="M62 156c0 16 17 26 38 26s38-10 38-26Z" fill="var(--color-brand-700)" />
      <ellipse cx="100" cy="156" rx="38" ry="10" fill="#fff" />
      <path
        d="M76 152q6 -8 12 0t12 0t12 0t12 0"
        stroke="var(--color-accent-300)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
