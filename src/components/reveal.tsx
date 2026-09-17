"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/reduced-motion";

type Direction = "up" | "down" | "left" | "right" | "scale";

const offsets: Record<Direction, { x?: number; y?: number; scale?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 36 },
  right: { x: -36 },
  scale: { scale: 0.94 },
};

export function Reveal({
  children,
  delay = 0,
  direction = "up",
  className,
}: {
  children: ReactNode;
  delay?: number;
  direction?: Direction;
  className?: string;
}) {
  /*
   * Someone who has asked their device for less motion gets the content put
   * in place, with no slide and no fade.
   *
   * The preference changes the TRANSITION and never the initial state, which
   * is the whole fix here. It used to switch `initial` between an offset and
   * `false` — and because the preference is only knowable on the client, the
   * server rendered one and the browser hydrated the other. React reported a
   * mismatch and threw the whole tree away to rebuild it on the client, for
   * exactly the visitors who asked for less work rather than more. Both sides
   * now render the same thing, and the preference only decides how long it
   * takes to arrive: no time at all.
   *
   * `usePrefersReducedMotion` rather than motion's own hook for the same
   * reason — that one reads the media query on the first client render, which
   * is precisely when it must agree with a server that had no media query.
   */
  const still = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={
        still ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
