"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { bloom, knotRadius, tailPath } from "@/lib/bloom";
import { usePrefersReducedMotion } from "@/lib/reduced-motion";

/**
 * The thing on the front page.
 *
 * A bloom of ribbon loops around a knot, with two tails falling out of it —
 * a flower and a bow at the same time, which is what this shop makes. Drawn
 * rather than photographed: it is there on a shop's first day, it costs no
 * bytes, it is sharp on any screen, and it takes the brand's own gold from
 * the tokens, so the next shop to use this template gets its own.
 *
 * Three things move, and each one is doing a job:
 *
 *   The rings drift at different speeds and in opposite directions, which is
 *   the difference between something spinning and something alive.
 *
 *   It leans toward the pointer, by more on the near rings than the far ones.
 *   That parallax is the only reason a flat vector reads as having depth.
 *
 *   It draws itself in, petal by petal, once. A hero that is simply there is
 *   a picture; one that arrives is an entrance.
 *
 * All three stop dead for anyone who asked their device for less movement.
 * They still get the whole bloom — reduced motion is not a reason to be shown
 * less, only a reason to be shown it still.
 */

/*
 * The viewBox, and the artwork's own origin inside it.
 *
 * Worth naming rather than inlining. `transform-box` defaults to `view-box`
 * for SVG, so `transform-origin: 0 0` is the viewBox's top-LEFT corner, not
 * the centre the bloom is built around — and everything rotated and scaled
 * about a corner a hundred units away, which drew three rings sliding past
 * each other instead of one flower opening.
 */
const VIEW = { x: -124, y: -124, w: 248, h: 340 };
const ORIGIN = `${-VIEW.x}px ${-VIEW.y}px`;

const RINGS = bloom({ radius: 96, petals: 11 });
// Not the same length, and not the same width. Two tails cut to match are
// two tails nobody tied.
const TAIL_L = tailPath(-1, 190, 26);
const TAIL_R = tailPath(1, 172, 22);
const KNOT = knotRadius(96);

export function RibbonBloom({ className = "" }: { className?: string }) {
  const still = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);

  // −1 to 1 across the element. Sprung, so the bloom settles rather than
  // snapping to the cursor like a crosshair.
  const px = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    if (still) return;
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const release = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <div
      ref={box}
      onPointerMove={track}
      onPointerLeave={release}
      className={`relative ${className}`}
      // Decoration. A screen reader reading out "ribbon bloom" gains nothing
      // it could not get from the heading two inches away.
      aria-hidden
    >
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        className="h-full w-full overflow-visible"
        role="presentation"
      >
        <defs>
          {/*
            The gold, as a fall across the petal rather than a flat fill.
            Metallic ink is only metallic because it is lighter on one edge
            than the other, and a single hex renders as mustard.
          */}
          {/*
            Every stop is on the BRAND ramp, which is the shop's metal. The
            accent ramp is deliberately far from it — plum, here — so that a
            gold badge and a plum alert can never be mistaken for each other,
            and reaching for it in this gradient painted the tails pink.
          */}
          <linearGradient id="bloom-face" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="var(--brand-100)" />
            <stop offset="38%" stopColor="var(--brand-400)" />
            <stop offset="100%" stopColor="var(--brand-800)" />
          </linearGradient>
          <linearGradient id="bloom-tail" x1="0.1" y1="0" x2="1" y2="0.8">
            <stop offset="0%" stopColor="var(--brand-500)" />
            <stop offset="50%" stopColor="var(--brand-200)" />
            <stop offset="100%" stopColor="var(--brand-700)" />
          </linearGradient>
          <radialGradient id="bloom-glow">
            <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.5" />
            <stop offset="70%" stopColor="var(--brand-700)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--brand-900)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The light the gold is catching. Without it the bloom sits on the
            black like a sticker. */}
        <circle cx="0" cy="8" r="150" fill="url(#bloom-glow)" />

        {/* Under the knot, so the loops sit on top of where they are tied. */}
        <g>
          {[TAIL_L, TAIL_R].map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="url(#bloom-tail)"
              opacity={0.85}
              initial={still ? false : { opacity: 0, y: -24 }}
              animate={{ opacity: 0.85, y: 0 }}
              transition={{ duration: 1.1, delay: 0.55 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </g>

        {RINGS.map((ring, r) => (
          <Ring key={ring.id} ring={ring} index={r} still={still} px={px} py={py} />
        ))}

        {/* The knot. Two circles rather than one: the ring is the light
            catching the edge of the wrap, which is the only thing that stops
            a filled circle reading as a button. */}
        <g>
          <circle cx="0" cy="0" r={KNOT} fill="url(#bloom-face)" />
          <circle
            cx="0"
            cy="0"
            r={KNOT * 1.5}
            fill="none"
            stroke="var(--brand-200)"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        </g>
      </svg>
    </div>
  );
}

function Ring({
  ring,
  index,
  still,
  px,
  py,
}: {
  ring: (typeof RINGS)[number];
  index: number;
  still: boolean;
  px: ReturnType<typeof useSpring>;
  py: ReturnType<typeof useSpring>;
}) {
  // The near rings lean further than the far ones. The other way round reads
  // as a mistake rather than as depth.
  const x = useTransform(px, (v) => v * ring.depth);
  const y = useTransform(py, (v) => v * ring.depth * 0.6);

  return (
    <motion.g style={still ? undefined : { x, y }} opacity={ring.opacity}>
      <motion.g
        animate={still ? undefined : { rotate: ring.spin > 0 ? 360 : -360 }}
        transition={{ duration: Math.abs(ring.spin), repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: ORIGIN }}
      >
        {ring.petals.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="url(#bloom-face)"
            fillRule="evenodd"
            stroke="var(--brand-100)"
            strokeOpacity="0.22"
            strokeWidth="0.6"
            initial={still ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              // Outer rings first, then inwards, so it reads as opening.
              delay: index * 0.14 + i * 0.045,
              duration: 0.9,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: ORIGIN }}
          />
        ))}
      </motion.g>
    </motion.g>
  );
}
