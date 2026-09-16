import { brand } from "../../config/index.ts";
import Image from "next/image";

/**
 * The shop's wordmark.
 *
 * Kept as an image rather than as markup because a wordmark is artwork a shop
 * owns, not something a template should try to draw. But a new shop does not
 * have that artwork on its first day, and `brand.wordmark: null` is the
 * supported answer for that: the name is set in the shop's display face until
 * the real mark arrives. The alternative — pointing at a file that isn't
 * there — renders a broken image icon in the header and the footer of every
 * page, which is what this replaced.
 *
 * `width` is the drawn width in CSS pixels; the height follows the artwork's
 * own aspect ratio so the space is reserved before the file loads.
 */
export function Logo({
  className = "",
  width = 200,
  priority = false,
}: {
  className?: string;
  width?: number;
  priority?: boolean;
}) {
  const mark = brand.wordmark;

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
