import { validateBrand, PALETTE_KEYS, type BrandConfig } from "./schema.ts";
import { everribbon } from "./brands/everribbon.ts";
import { pepperpan } from "./brands/pepperpan.ts";

/**
 * Every shop this build knows how to be.
 *
 * A registry rather than a dynamic import because the palette has to be in the
 * bundle for the first paint — resolving it at runtime means a flash of the
 * wrong brand on every cold load, which is exactly the thing a shop owner
 * notices and cannot explain.
 */
export const BRANDS: Record<string, BrandConfig> = { everribbon, pepperpan };

/** Used when NEXT_PUBLIC_BRAND is unset — a dev machine, or a one-shop deploy. */
const DEFAULT_BRAND = "everribbon";

export function resolveBrand(key = process.env.NEXT_PUBLIC_BRAND?.trim() || DEFAULT_BRAND): BrandConfig {
  const found = BRANDS[key];
  if (!found) {
    throw new Error(
      `NEXT_PUBLIC_BRAND is "${key}", which is not a shop this build knows. ` +
      `Available: ${Object.keys(BRANDS).join(", ")}.`
    );
  }
  return validateBrand(found);
}

/** The shop this process is serving. Import this; do not re-resolve. */
export const brand = resolveBrand();

/**
 * The brand's palette as the custom properties the stylesheet reads.
 *
 * Tailwind's `@theme` block names tokens and points each at one of these, so a
 * utility class resolves through two hops: `.bg-brand-400` →
 * `var(--color-brand-400)` → `var(--brand-400)` → the hex below. The indirection
 * is the whole trick: it means a shop's colours are injected at render, not
 * compiled in, so one build can serve any brand and a theme can be swapped
 * without a deploy.
 */
export function brandVars(b: BrandConfig = brand): string {
  const lines: string[] = PALETTE_KEYS.map((k) => `--${k}:${b.palette[k]}`);
  // The two the stylesheet cannot decide for itself. See Roles in schema.ts.
  lines.push(`--accent-fill:${b.palette[b.roles.accentFill]}`);
  lines.push(`--on-accent:${b.palette[b.roles.onAccent]}`);
  lines.push(`--font-display:${b.fonts.display}`);
  lines.push(`--font-body:${b.fonts.body}`);
  lines.push(`--font-mono-stack:${b.fonts.mono}`);
  return `:root{${lines.join(";")}}`;
}

export type { BrandConfig, Palette, PaletteKey, Ramp, Step, Roles } from "./schema.ts";
export { validateBrand, PALETTE_KEYS, RAMPS, STEPS, BrandConfigError } from "./schema.ts";
