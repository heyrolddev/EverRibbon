"use client";

import { brand } from "../../config/index.ts";
import Image from "next/image";
import { markFor } from "@/lib/brand-assets";
import { useBrandAssets } from "@/components/brand-assets-provider";

/**
 * The shop's wordmark.
 *
 * Artwork a shop owns, so it is never drawn here — it is uploaded in HQ and
 * read from the settings row, with the config as the floor for a shop that
 * has not uploaded one yet. Asking a developer to commit a PNG is how a shop
 * runs for three months with its name set in a fallback face.
 *
 * Three cases, in order:
 *
 *   the mark for this ground   a gold mark on black and a legible one on
 *                              cream are two different files, and `ground`
 *                              says which this instance sits on
 *   the light mark             when no dark version has been uploaded
 *   the name, set as SVG       when there is no artwork at all
 *
 * The last is not a placeholder. A new shop has no logo on its first day, and
 * a broken image icon in the header of every page is worse than the name set
 * well in the shop's own display face.
 */
export function Logo({
  className = "",
  width = 200,
  priority = false,
  /**
   * What this sits on. `dark` picks the mark drawn for a dark ground; the
   * text fallback takes `currentColor` either way, so the caller's own colour
   * still decides that.
   */
  ground = "light",
}: {
  className?: string;
  width?: number;
  priority?: boolean;
  ground?: "light" | "dark";
}) {
  const mark = markFor(useBrandAssets(), ground);

  if (!mark) {
    // Set as SVG rather than as a styled <span>, because every caller sizes
    // this the way you size artwork — `w-[180px]`, `w-[300px]` — and text in
    // a box that narrow simply overflows it. An SVG with a viewBox scales to
    // whatever width it is given, exactly as the image would have, so the
    // header and the footer keep their layout on the day the real mark
    // arrives and this branch stops running.
    //
    // The viewBox width is an estimate of the name's own width (display faces
    // average a little over half an em per character). It is not measured and
    // does not need to be: `meet` fits the name inside the box either way, so
    // a wrong guess costs a little slack around it and never a squeezed or
    // clipped name.
    const box = Math.max(1, brand.name.trim().length * 0.56);
    return (
      <svg
        viewBox={`0 0 ${box} 1`}
        role="img"
        aria-label={brand.name}
        preserveAspectRatio="xMidYMid meet"
        // Attributes rather than inline style, so a caller's `w-[180px]` still
        // wins — the same way it does over <Image>'s own width. An inline
        // style would beat the class and blow the header open.
        width={width}
        height={Math.round(width / box)}
        className={className}
      >
        <text
          x={box / 2}
          y={0.78}
          fontSize={1}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {brand.name}
        </text>
      </svg>
    );
  }

  return (
    <Image
      src={mark.src}
      alt={brand.name}
      width={width}
      height={Math.round((width * mark.height) / mark.width)}
      priority={priority}
      className={className}
    />
  );
}
