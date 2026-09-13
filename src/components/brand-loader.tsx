/**
 * The intro mark, while the page is arriving.
 *
 * The shop this template came from drew its own: a flame leaping out of a pan,
 * peppercorns tossing in it. That was the right call for a noodle stall and
 * exactly the wrong thing to put in a template — its own source comment said
 * as much, that it was the one thing that shop does, drawn. A ribbon shop
 * cannot ship a wok, and neither can the next buyer.
 *
 * So what ships is the shape every shop has: a ring drawn in the brand's own
 * accent, opening as it turns. A shop that wants its own drawing replaces
 * this file — the seam is one component, not a search through the intro.
 *
 * Inline SVG animated in CSS rather than a library: it is a few hundred bytes,
 * it paints before hydration, and it is the first thing anyone sees.
 */
export function BrandLoader({ size = 92, className = "" }: { size?: number; className?: string }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 92 92"
      fill="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      {/* The track, so the ring reads as a ring rather than as a stray arc. */}
      <circle cx="46" cy="46" r={r} stroke="var(--line)" strokeWidth="3" />
      <circle
        cx="46"
        cy="46"
        r={r}
        stroke="var(--accent-fill)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        className="brand-loader-arc"
      />
      <style>{`
        .brand-loader-arc {
          transform-origin: 46px 46px;
          animation: brand-loader-spin 1.4s linear infinite,
                     brand-loader-draw 1.9s ease-in-out infinite;
        }
        @keyframes brand-loader-spin { to { transform: rotate(360deg); } }
        @keyframes brand-loader-draw {
          0%   { stroke-dashoffset: ${circumference * 0.98}; }
          50%  { stroke-dashoffset: ${circumference * 0.25}; }
          100% { stroke-dashoffset: ${circumference * 0.98}; }
        }
        /* Someone who asked not to be spun at still needs to see progress,
           so the ring holds a partial arc rather than disappearing. */
        @media (prefers-reduced-motion: reduce) {
          .brand-loader-arc {
            animation: none;
            stroke-dashoffset: ${circumference * 0.3};
          }
        }
      `}</style>
    </svg>
  );
}
