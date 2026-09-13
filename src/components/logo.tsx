import { brand } from "../../config/index.ts";
import Image from "next/image";

/**
 * The shop's wordmark, from its own asset folder.
 *
 * Kept as an image rather than as markup because a wordmark is artwork a shop
 * owns, not something a template should try to draw. Each brand supplies
 * public/brand/<key>/logo.png; nothing here knows what is in it.
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
  // Source art is 7329 × 2511 (≈2.92:1) once trimmed.
  const height = Math.round(width / 2.92);

  return (
    <Image
      src={`/brand/${brand.key}/logo.png`}
      alt={brand.name}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
